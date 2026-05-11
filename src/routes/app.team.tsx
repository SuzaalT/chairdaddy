import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/hooks/use-team";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageIcon, MapPin, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/team")({ component: Team });

type Msg = { id: string; user_id: string; content: string | null; image_url: string | null; created_at: string };
type Loc = { user_id: string; lat: number | null; lng: number | null; sharing: boolean; updated_at: string };
type Member = { user_id: string; role: string; profile?: { full_name: string | null; email: string | null } };

function Team() {
  const { team } = useTeam();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [locs, setLocs] = useState<Record<string, Loc>>({});
  const [text, setText] = useState("");
  const [sharing, setSharing] = useState(false);
  const watchId = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!team) return;
    supabase.from("chat_messages").select("*").eq("team_id", team.id).order("created_at", { ascending: true }).limit(200)
      .then(({ data }) => setMsgs((data as Msg[]) ?? []));
    supabase.from("team_members").select("user_id, role").eq("team_id", team.id).then(async ({ data }) => {
      const ids = (data ?? []).map((m) => m.user_id);
      if (ids.length === 0) return setMembers([]);
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      setMembers((data ?? []).map((m) => ({ ...m, profile: profs?.find((p) => p.id === m.user_id) ?? undefined })));
    });
    supabase.from("member_locations").select("*").eq("team_id", team.id).then(({ data }) => {
      const map: Record<string, Loc> = {};
      (data as Loc[] | null)?.forEach((l) => { map[l.user_id] = l; });
      setLocs(map);
    });

    const ch = supabase.channel(`team:${team.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `team_id=eq.${team.id}` },
        (p) => setMsgs((prev) => [...prev, p.new as Msg]))
      .on("postgres_changes", { event: "*", schema: "public", table: "member_locations", filter: `team_id=eq.${team.id}` },
        (p) => setLocs((prev) => ({ ...prev, [(p.new as Loc).user_id]: p.new as Loc })))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [team]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [msgs.length]);

  async function send() {
    if (!team || !user || !text.trim()) return;
    await supabase.from("chat_messages").insert({ team_id: team.id, user_id: user.id, content: text });
    setText("");
  }

  async function sendImage(file: File) {
    if (!team || !user) return;
    const path = `${team.id}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("chat-photos").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("chat-photos").getPublicUrl(path);
    await supabase.from("chat_messages").insert({ team_id: team.id, user_id: user.id, image_url: data.publicUrl });
  }

  function toggleSharing() {
    if (!team || !user) return;
    if (sharing) {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setSharing(false);
      supabase.from("member_locations").upsert({ team_id: team.id, user_id: user.id, sharing: false, updated_at: new Date().toISOString() });
      return;
    }
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        supabase.from("member_locations").upsert({
          team_id: team.id, user_id: user.id, lat: p.coords.latitude, lng: p.coords.longitude,
          sharing: true, updated_at: new Date().toISOString(),
        });
      },
      (e) => toast.error(e.message),
      { enableHighAccuracy: true, maximumAge: 15000 }
    );
    setSharing(true);
  }

  function nameFor(uid: string) {
    const m = members.find((x) => x.user_id === uid);
    return m?.profile?.full_name || m?.profile?.email || "Member";
  }

  return (
    <div className="flex flex-col h-[calc(100vh-150px)]">
      <div className="px-4 pt-4">
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <div className="mt-3 rounded-2xl bg-card border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Members</p>
            <Button size="sm" variant={sharing ? "default" : "outline"} onClick={toggleSharing}>
              <MapPin className="h-3.5 w-3.5 mr-1" />{sharing ? "Sharing on" : "Share my location"}
            </Button>
          </div>
          <ul className="space-y-1.5">
            {members.map((m) => {
              const loc = locs[m.user_id];
              const fresh = loc?.updated_at && (Date.now() - new Date(loc.updated_at).getTime()) < 5 * 60 * 1000;
              return (
                <li key={m.user_id} className="flex items-center justify-between text-sm">
                  <span>{m.profile?.full_name || m.profile?.email} <span className="text-xs text-muted-foreground">· {m.role}</span></span>
                  <span className={"text-xs " + (loc?.sharing && fresh ? "text-[oklch(0.5_0.16_152)]" : "text-muted-foreground")}>
                    {loc?.sharing && fresh && loc.lat != null ? `${loc.lat.toFixed(3)}, ${loc.lng?.toFixed(3)}` : "offline"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {msgs.map((m) => {
          const mine = m.user_id === user?.id;
          return (
            <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
              <div className={"max-w-[78%] rounded-2xl px-3 py-2 " + (mine ? "bg-primary text-primary-foreground" : "bg-card border border-border")}>
                {!mine && <p className="text-[10px] opacity-70 mb-0.5">{nameFor(m.user_id)}</p>}
                {m.image_url && <img src={m.image_url} alt="" className="rounded-lg max-h-64 mb-1" />}
                {m.content && <p className="text-sm whitespace-pre-wrap">{m.content}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-border bg-background flex gap-2 items-center">
        <label className="h-10 w-10 rounded-full bg-muted grid place-items-center cursor-pointer">
          <ImageIcon className="h-4 w-4" />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && sendImage(e.target.files[0])} />
        </label>
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message your team…" />
        <Button size="icon" onClick={send} disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
