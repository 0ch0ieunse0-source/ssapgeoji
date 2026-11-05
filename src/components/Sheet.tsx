import { useEffect, useRef, type ReactNode } from "react";

/**
 * 바텀시트. 열 때 시트 안으로 포커스를 옮기고, 닫으면 원래 자리로 돌려요.
 * Esc, 바깥 누르기, ✕ 로 닫혀요. Tab은 시트 안에서만 돌아요.
 */
export function Sheet({
  open,
  onClose,
  labelledBy,
  children,
  autoFocus = true,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    if (autoFocus) ref.current?.focus();
    return () => {
      const el = lastFocus.current;
      if (el && el.isConnected && el.focus) el.focus();
    };
  }, [open, autoFocus]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // 창이 여러 개 겹쳐 있으면 맨 위 창만 반응해요
      const opened = Array.from(document.querySelectorAll(".scrim:not([hidden])"));
      if (opened[opened.length - 1] !== ref.current?.parentElement) return;
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = Array.from(ref.current.querySelectorAll<HTMLElement>("button, input, select, [tabindex]:not([tabindex='-1'])")).filter(
          (x) => !x.hasAttribute("disabled") && x.offsetParent !== null,
        );
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className="scrim" hidden={!open} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={ref} tabIndex={-1}>
        <div className="grab" />
        {children}
      </section>
    </div>
  );
}

export function SheetHead({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  return (
    <div className="sheet-head">
      <h2 id={id}>{title}</h2>
      <button className="x" aria-label="닫기" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}
