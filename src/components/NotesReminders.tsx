import { useEffect, useState } from "react";
import { Plus, Trash2, Check, Eye, EyeOff, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

type NoteType = "pending" | "remember" | "tomorrow";

type Note = {
  id: string;
  title: string;
  description?: string;
  type: NoteType;
  done: boolean;
  createdAt: number;
};

const STORAGE_KEY = "chairflip.notes.v1";

const TYPE_META: Record<NoteType, { label: string; badge: string }> = {
  pending: {
    label: "Pending Work",
    badge: "bg-[oklch(0.95_0.08_60)] text-[oklch(0.4_0.16_60)] border-[oklch(0.85_0.12_60)]",
  },
  remember: {
    label: "Remember",
    badge: "bg-[oklch(0.95_0.07_270)] text-[oklch(0.4_0.16_270)] border-[oklch(0.85_0.12_270)]",
  },
  tomorrow: {
    label: "Tomorrow's To-Do",
    badge: "bg-[oklch(0.95_0.06_200)] text-[oklch(0.38_0.14_220)] border-[oklch(0.85_0.1_210)]",
  },
};

function load(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Note[];
  } catch {
    return [];
  }
}

export function NotesReminders() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<NoteType>("pending");
  const [hideDone, setHideDone] = useState(false);

  useEffect(() => {
    setNotes(load());
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }
  }, [notes]);

  const add = () => {
    const t = title.trim();
    if (!t) return;
    setNotes((prev) => [
      { id: crypto.randomUUID(), title: t, description: description.trim() || undefined, type, done: false, createdAt: Date.now() },
      ...prev,
    ]);
    setTitle("");
    setDescription("");
  };

  const toggle = (id: string) =>
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, done: !n.done } : n)));
  const remove = (id: string) => setNotes((prev) => prev.filter((n) => n.id !== id));

  const visible = (hideDone ? notes.filter((n) => !n.done) : notes)
    .slice()
    .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt);

  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <StickyNote className="h-4 w-4 text-muted-foreground" />
          Notes & Reminders
        </h2>
        {notes.some((n) => n.done) && (
          <button
            onClick={() => setHideDone((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            {hideDone ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {hideDone ? "Show done" : "Hide done"}
          </button>
        )}
      </div>

      <div className="space-y-2 mb-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New note or reminder…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details"
          rows={2}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
        <div className="flex items-center gap-2">
          <div className="flex gap-1 flex-1">
            {(Object.keys(TYPE_META) as NoteType[]).map((k) => (
              <button
                key={k}
                onClick={() => setType(k)}
                className={cn(
                  "text-[11px] px-2 py-1 rounded-full border transition-colors",
                  type === k ? TYPE_META[k].badge : "bg-muted/50 text-muted-foreground border-transparent"
                )}
              >
                {TYPE_META[k].label}
              </button>
            ))}
          </div>
          <button
            onClick={add}
            disabled={!title.trim()}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((n) => (
            <li
              key={n.id}
              className={cn(
                "rounded-lg border border-border bg-background p-3 flex items-start gap-2",
                n.done && "opacity-60"
              )}
            >
              <button
                onClick={() => toggle(n.id)}
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0 rounded-full border grid place-items-center transition-colors",
                  n.done ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary"
                )}
                aria-label="Toggle done"
              >
                {n.done && <Check className="h-3 w-3" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-sm font-medium", n.done && "line-through")}>{n.title}</span>
                  <span className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border", TYPE_META[n.type].badge)}>
                    {TYPE_META[n.type].label}
                  </span>
                </div>
                {n.description && (
                  <p className={cn("text-xs text-muted-foreground mt-1", n.done && "line-through")}>{n.description}</p>
                )}
              </div>
              <button
                onClick={() => remove(n.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive p-1"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
