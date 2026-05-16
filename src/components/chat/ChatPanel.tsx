import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTeam } from "@/hooks/use-team";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageIcon, Send, X, Download, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = {
  id: string;
  user_id: string;
  team_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  read_by: string[] | null;
};
type Member = { user_id: string; role: string; full_name: string | null; email: string | null };

const PAGE = 50;

function dayKey(iso: string) { return new Date(iso).toDateString(); }
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
}
function timeLabel(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

export function ChatPanel({ members }: { members: Member[] }) {
  const { team } = useTeam();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [viewer, setViewer] = useState<string | null>(null);
  const [signedImages, setSignedImages] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve chat-photos to signed URLs (bucket is private)
  useEffect(() => {
    const marker = "/chat-photos/";
    const pending = msgs
      .map((m) => m.image_url)
      .filter((u): u is string => !!u && !signedImages[u]);
    if (pending.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates: Record<string, string> = {};
      for (const url of pending) {
        const idx = url.indexOf(marker);
        if (idx === -1) { updates[url] = url; continue; }
        const path = url.slice(idx + marker.length).split("?")[0];
        const { data } = await supabase.storage.from("chat-photos").createSignedUrl(path, 60 * 60);
        updates[url] = data?.signedUrl ?? url;
      }
      if (!cancelled) setSignedImages((p) => ({ ...p, ...updates }));
    })();
    return () => { cancelled = true; };
  }, [msgs, signedImages]);

  const memberById = (uid: string) => members.find((m) => m.user_id === uid);
  const nameFor = (uid: string) => { const m = memberById(uid); return m?.full_name || m?.email || "Member"; };

  // Initial load
  useEffect(() => {
    if (!team) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("team_id", team.id)
        .order("created_at", { ascending: false })
        .limit(PAGE);
      if (cancelled) return;
      const list = ((data as Msg[] | null) ?? []).slice().reverse();
      setMsgs(list);
      setHasMore((data?.length ?? 0) >= PAGE);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    })();
    return () => { cancelled = true; };
  }, [team]);

  // Realtime + presence
  useEffect(() => {
    if (!team || !user) return;
    const ch = supabase
      .channel(`chat:${team.id}`, { config: { presence: { key: user.id } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `team_id=eq.${team.id}` },
        (p) => setMsgs((prev) => prev.some((m) => m.id === (p.new as Msg).id) ? prev : [...prev, p.new as Msg]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `team_id=eq.${team.id}` },
        (p) => setMsgs((prev) => prev.map((m) => m.id === (p.new as Msg).id ? (p.new as Msg) : m)))
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState() as Record<string, Array<{ typing?: boolean; user_id?: string }>>;
        const typing: string[] = [];
        for (const [uid, metas] of Object.entries(state)) {
          if (uid === user.id) continue;
          if (metas.some((m) => m.typing)) typing.push(uid);
        }
        setTypingUsers(typing);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await ch.track({ user_id: user.id, typing: false });
      });
    presenceRef.current = ch;
    return () => { supabase.removeChannel(ch); presenceRef.current = null; };
  }, [team, user]);

  // Auto-scroll on new messages if near bottom
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  // Mark unread as read
  useEffect(() => {
    if (!user || msgs.length === 0) return;
    const unread = msgs.filter((m) => m.user_id !== user.id && !(m.read_by ?? []).includes(user.id));
    if (unread.length === 0) return;
    (async () => {
      for (const m of unread) {
        const next = Array.from(new Set([...(m.read_by ?? []), user.id]));
        await supabase.from("chat_messages").update({ read_by: next }).eq("id", m.id);
      }
    })();
  }, [msgs, user]);

  async function loadMore() {
    if (!team || loadingMore || !hasMore || msgs.length === 0) return;
    setLoadingMore(true);
    const oldest = msgs[0].created_at;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("team_id", team.id)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    const older = ((data as Msg[] | null) ?? []).slice().reverse();
    setMsgs((prev) => [...older, ...prev]);
    setHasMore((data?.length ?? 0) >= PAGE);
    setLoadingMore(false);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }

  function onScroll() {
    const el = scrollRef.current; if (!el) return;
    if (el.scrollTop < 80 && hasMore && !loadingMore) loadMore();
  }

  async function send() {
    if (!team || !user || !text.trim()) return;
    const body = text.trim();
    setText("");
    presenceRef.current?.track({ user_id: user.id, typing: false });
    const { error } = await supabase.from("chat_messages").insert({ team_id: team.id, user_id: user.id, content: body });
    if (error) toast.error(error.message);
  }

  async function sendImage(file: File) {
    if (!team || !user) return;
    const path = `${team.id}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("chat-photos").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("chat-photos").getPublicUrl(path);
    await supabase.from("chat_messages").insert({ team_id: team.id, user_id: user.id, image_url: data.publicUrl });
  }

  function onTyping(v: string) {
    setText(v);
    if (!presenceRef.current || !user) return;
    presenceRef.current.track({ user_id: user.id, typing: v.length > 0 });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      presenceRef.current?.track({ user_id: user.id, typing: false });
    }, 1500);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // Build render list with grouping + day separators
  const items: Array<{ type: "day"; key: string; label: string } | { type: "msg"; msg: Msg; groupedTop: boolean; groupedBottom: boolean }> = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const prev = msgs[i - 1];
    const next = msgs[i + 1];
    if (!prev || dayKey(prev.created_at) !== dayKey(m.created_at)) {
      items.push({ type: "day", key: `d-${dayKey(m.created_at)}`, label: dayLabel(m.created_at) });
    }
    const within = (a: Msg, b: Msg) => Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 2 * 60 * 1000;
    const groupedTop = !!prev && prev.user_id === m.user_id && dayKey(prev.created_at) === dayKey(m.created_at) && within(prev, m);
    const groupedBottom = !!next && next.user_id === m.user_id && dayKey(next.created_at) === dayKey(m.created_at) && within(m, next);
    items.push({ type: "msg", msg: m, groupedTop, groupedBottom });
  }

  return (
    <>
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-3">
        {hasMore && (
          <div className="text-center py-2">
            <button onClick={loadMore} disabled={loadingMore} className="text-xs text-muted-foreground">
              {loadingMore ? "Loading…" : "Load older messages"}
            </button>
          </div>
        )}
        {items.map((it) => {
          if (it.type === "day") {
            return (
              <div key={it.key} className="flex justify-center my-3">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full">{it.label}</span>
              </div>
            );
          }
          const m = it.msg;
          const mine = m.user_id === user?.id;
          const others = members.filter((x) => x.user_id !== user?.id);
          const readByOther = (m.read_by ?? []).some((uid) => uid !== m.user_id);
          const allOthersRead = others.length > 0 && others.every((o) => (m.read_by ?? []).includes(o.user_id));
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start", it.groupedBottom ? "mb-0.5" : "mb-2")}>
              <div className={cn("max-w-[78%] flex flex-col", mine ? "items-end" : "items-start")}>
                {!mine && !it.groupedTop && <p className="text-[10px] text-muted-foreground mb-0.5 px-2">{nameFor(m.user_id)}</p>}
                <div
                  className={cn(
                    "px-3 py-2",
                    mine ? "bg-primary text-primary-foreground" : "bg-card border border-border",
                    // iMessage-style corner rounding for grouped bubbles
                    mine
                      ? cn("rounded-2xl", it.groupedTop && "rounded-tr-md", it.groupedBottom && "rounded-br-md")
                      : cn("rounded-2xl", it.groupedTop && "rounded-tl-md", it.groupedBottom && "rounded-bl-md"),
                  )}
                >
                  {m.image_url && (
                    <button onClick={() => setViewer(m.image_url!)} className="block">
                      <img src={m.image_url} alt="" className="rounded-lg max-h-64 mb-1 cursor-zoom-in" />
                    </button>
                  )}
                  {m.content && <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>}
                </div>
                {!it.groupedBottom && (
                  <div className={cn("flex items-center gap-1 mt-0.5 px-2 text-[10px] text-muted-foreground", mine ? "justify-end" : "justify-start")}>
                    <span>{timeLabel(m.created_at)}</span>
                    {mine && (
                      allOthersRead ? <CheckCheck className="h-3 w-3 text-[oklch(0.55_0.18_240)]" />
                      : readByOther ? <CheckCheck className="h-3 w-3" />
                      : <Check className="h-3 w-3" />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {typingUsers.length > 0 && (
          <div className="flex justify-start mb-2">
            <div className="bg-card border border-border rounded-2xl px-3 py-2 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-bounce" />
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-2.5 border-t border-border bg-background flex gap-2 items-center">
        <label className="h-10 w-10 rounded-full bg-muted grid place-items-center cursor-pointer shrink-0">
          <ImageIcon className="h-4 w-4" />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && sendImage(e.target.files[0])} />
        </label>
        <Input value={text} onChange={(e) => onTyping(e.target.value)} onKeyDown={onKey} placeholder="iMessage" className="rounded-full" />
        <Button size="icon" onClick={send} disabled={!text.trim()} className="rounded-full shrink-0"><Send className="h-4 w-4" /></Button>
      </div>

      {viewer && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={() => setViewer(null)}>
          <div className="flex justify-between items-center p-4">
            <a href={viewer} download target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="text-white p-2 rounded-full hover:bg-white/10">
              <Download className="h-5 w-5" />
            </a>
            <button className="text-white p-2 rounded-full hover:bg-white/10"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 grid place-items-center p-4">
            <img src={viewer} alt="" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}
    </>
  );
}
