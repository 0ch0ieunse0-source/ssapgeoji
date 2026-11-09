import { useEffect, useRef, useState } from "react";
import { HOME_BLOCKS, homeOrder, moveItem, type HomeBlockId } from "../lib/home";
import { useApp } from "../state/app";
import { Sheet, SheetHead } from "./Sheet";

const nameOf = (id: HomeBlockId) => HOME_BLOCKS.find((b) => b.id === id)!.name;

/** 홈 편집: 손잡이를 끌어 순서를 바꾸고, 스위치로 숨겨요. (손잡이에 초점을 두고 ↑↓ 키로도 옮겨요) */
export function HomeEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { S, update, toast } = useApp();
  const cfg = S.settings;
  const [order, setOrder] = useState<HomeBlockId[]>(() => homeOrder(cfg?.homeOrder));
  const [hidden, setHidden] = useState<string[]>(() => cfg?.homeHidden || []);
  const [drag, setDrag] = useState<HomeBlockId | null>(null);
  const rows = useRef<Partial<Record<HomeBlockId, HTMLLIElement | null>>>({});
  const handles = useRef<Partial<Record<HomeBlockId, HTMLButtonElement | null>>>({});
  const [focusId, setFocusId] = useState<HomeBlockId | null>(null);

  useEffect(() => {
    if (!open) return;
    setOrder(homeOrder(cfg?.homeOrder));
    setHidden(cfg?.homeHidden || []);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (focusId) handles.current[focusId]?.focus();
  }, [order, focusId]);

  // 끄는 손가락 위치보다 위에 있는 (끌고 있는 것 말고) 카드 수 = 들어갈 자리
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const from = order.indexOf(drag);
    const to = order.filter((id) => {
      if (id === drag) return false;
      const r = rows.current[id]?.getBoundingClientRect();
      return !!r && r.top + r.height / 2 < e.clientY;
    }).length;
    if (to !== from) setOrder(moveItem(order, from, to));
  };

  const save = () => {
    update((d) => {
      if (!d.settings) return;
      d.settings.homeOrder = order;
      d.settings.homeHidden = hidden;
    });
    toast("홈 화면을 바꿨어요.");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} labelledBy="homeEditTitle">
      <SheetHead id="homeEditTitle" title="홈 편집" onClose={onClose} />
      <p className="hint">손잡이를 길게 눌러 끌면 순서가 바뀌고, 스위치를 끄면 홈에서 숨겨요. 맨 위 남은 돈 카드는 늘 보여요.</p>
      <ul className={"he-list" + (drag ? " dragging" : "")} onPointerMove={onMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
        {order.map((id, i) => {
          const on = !hidden.includes(id);
          return (
            <li key={id} ref={(el) => (rows.current[id] = el)} className={(drag === id ? "lifted " : "") + (on ? "" : "off")}>
              <button
                ref={(el) => (handles.current[id] = el)}
                className="he-grip"
                aria-label={nameOf(id) + " 순서 바꾸기, " + (i + 1) + "번째. 위아래 화살표 키로 옮겨요"}
                onPointerDown={(e) => {
                  // 손가락이 손잡이 밖으로 나가도 끌기가 끊기지 않게 손잡이가 붙잡고 있어요 (손잡이는 스크롤 안 됨)
                  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                  setDrag(id);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                  e.preventDefault();
                  const to = i + (e.key === "ArrowUp" ? -1 : 1);
                  if (to < 0 || to >= order.length) return;
                  setFocusId(id);
                  setOrder(moveItem(order, i, to));
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 8h14M5 12h14M5 16h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <span className="he-name">{nameOf(id)}</span>
              <label className="switch">
                <input type="checkbox" role="switch" checked={on} aria-label={nameOf(id) + " 보이기"} onChange={() => setHidden(on ? [...hidden, id] : hidden.filter((x) => x !== id))} />
                <span aria-hidden="true" />
              </label>
            </li>
          );
        })}
      </ul>
      <div className="cta-bar">
        <button
          className="btn gray"
          onClick={() => {
            setOrder(homeOrder(null));
            setHidden([]);
          }}
        >
          기본으로
        </button>
        <button className="btn" onClick={save}>
          완료
        </button>
      </div>
    </Sheet>
  );
}
