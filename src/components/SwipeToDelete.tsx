import { useRef, useState, type ReactNode, type PointerEvent } from "react";
import { Trash2 } from "lucide-react";

const REVEAL = 88;
const TRIGGER = 32;

export function SwipeToDelete({ children, onDelete, disabled }: { children: ReactNode; onDelete: () => void; disabled?: boolean }) {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);

  if (disabled) return <>{children}</>;

  function onDown(e: PointerEvent<HTMLDivElement>) {
    startX.current = e.clientX;
    startOffset.current = offset;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    const next = Math.min(0, Math.max(-REVEAL, startOffset.current + dx));
    setOffset(next);
  }
  function onUp() {
    if (startX.current == null) return;
    startX.current = null;
    setOffset(offset < -TRIGGER ? -REVEAL : 0);
  }

  return (
    <div className="relative touch-pan-y">
      <button
        type="button"
        onClick={() => { onDelete(); setOffset(0); }}
        className="absolute right-0 top-0 bottom-0 w-[88px] rounded-2xl bg-destructive text-destructive-foreground flex items-center justify-center font-medium text-sm gap-1.5"
        aria-label="Delete"
        tabIndex={offset < -TRIGGER ? 0 : -1}
      >
        <Trash2 className="h-4 w-4" /> Delete
      </button>
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ transform: `translateX(${offset}px)`, transition: startX.current == null ? "transform 200ms" : "none" }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}
