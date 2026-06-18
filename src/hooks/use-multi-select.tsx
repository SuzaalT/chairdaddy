import { useCallback, useEffect, useRef, useState } from "react";

export function useMultiSelect() {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const enter = useCallback((id?: string) => {
    setActive(true);
    if (id) setSelected(new Set([id]));
  }, []);

  const exit = useCallback(() => {
    setActive(false);
    setSelected(new Set());
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const setAll = useCallback((ids: string[], on: boolean) => {
    setSelected(on ? new Set(ids) : new Set());
  }, []);

  useEffect(() => {
    if (!active) return;
    const onPop = (e: PopStateEvent) => { e.preventDefault(); exit(); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [active, exit]);

  return { active, selected, enter, exit, toggle, setAll };
}

export function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggered = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    triggered.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      triggered.current = true;
      onLongPress();
      if (navigator.vibrate) try { navigator.vibrate(20); } catch {}
    }, ms);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!startPos.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    if (dx * dx + dy * dy > 64) clear();
  };
  const onPointerUp = () => clear();
  const onPointerCancel = () => clear();
  const onContextMenu = (e: React.MouseEvent) => { e.preventDefault(); };

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu },
    didLongPress: () => triggered.current,
  };
}
