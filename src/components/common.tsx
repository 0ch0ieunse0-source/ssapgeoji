import { forwardRef, type InputHTMLAttributes, type KeyboardEvent, type MouseEvent } from "react";
import { catVar } from "../lib/cats";
import { fmt, parse, won } from "../lib/format";
import { catsLabel, mineOf } from "../lib/ledger";
import { roundsLabel } from "../lib/split";
import type { Item } from "../lib/types";

/** 눌러서 여는 줄을 키보드(Enter, Space)로도 열 수 있게 */
export const pressable = (onPress: () => void) => ({
  role: "button" as const,
  tabIndex: 0,
  onClick: onPress,
  onKeyDown: (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPress();
    }
  },
});

export function TxRow({ it, onClick, onDelete }: { it: Item; onClick?: () => void; onDelete?: (e: MouseEvent) => void }) {
  const cv = catVar(it.cat);
  const subs = [catsLabel(it), (it.pay || "check") === "card" ? "신용카드" : "체크·현금"];
  if (it.amount > mineOf(it))
    subs.push("결제 " + won(it.amount) + (it.rounds?.length ? "(" + roundsLabel(it.rounds.length) + ")" : "") + (it.received ? " · 정산 완료" : " · 정산 대기"));
  return (
    <li {...(onClick ? pressable(onClick) : {})}>
      <span className="ico" style={{ background: `color-mix(in srgb, ${cv} 18%, var(--surface))`, color: cv }} aria-hidden="true">
        {(it.cat || "기타").slice(0, 1)}
      </span>
      <span className="t">
        <b>{it.memo || it.cat || "기타"}</b>
        <span>{subs.join(" · ")}</span>
      </span>
      <span className="a">
        <b>-{won(mineOf(it))}</b>
        {onDelete && (
          <button className="del" aria-label={won(it.amount) + " 기록 삭제"} onClick={onDelete}>
            삭제
          </button>
        )}
      </span>
    </li>
  );
}

export function SmallIco({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span className="ico" style={{ background: bg, color: fg, fontSize: "11px" }}>
      {text}
    </span>
  );
}

/** 금액 입력칸: 쓰는 동안 1,000 단위 쉼표를 넣어요 */
type MoneyProps = { value: string; onValue: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">;
export const MoneyInput = forwardRef<HTMLInputElement, MoneyProps>(function MoneyInput({ value, onValue, className = "money", ...rest }, ref) {
  return <input ref={ref} className={className} inputMode="numeric" value={value} onChange={(e) => onValue(fmt(parse(e.target.value)))} {...rest} />;
});

/** 금액 + 음수면 빨간색 (프로토타입 setV) */
export function Won({ n, className, id }: { n: number; className?: string; id?: string }) {
  return (
    <span id={id} className={[className, n < 0 ? "minus" : ""].filter(Boolean).join(" ")}>
      {won(n)}
    </span>
  );
}

/** "12,345원" 큰 숫자 (원은 작게) */
export function BigWon({ n }: { n: number }) {
  return (
    <>
      {(n < 0 ? "-" : "") + Math.abs(Math.round(n)).toLocaleString("ko-KR")}
      <small>원</small>
    </>
  );
}

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "aria-hidden": true } as const;
export const Icon = {
  // 아래 탭: 통장 · 스페이스 · 마이페이지
  bank: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="6" width="17" height="13" rx="3" />
      <path d="M3.5 10h17" />
      <path d="M15.5 14.5h2" />
    </svg>
  ),
  space: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11l8-6.5 8 6.5" />
      <path d="M6 9.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5" />
      <circle cx="12" cy="14.5" r="2" />
    </svg>
  ),
  user: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  ),
  coin: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9.5 9.5h3.75a1.75 1.75 0 0 1 0 3.5h-2.5a1.75 1.75 0 0 0 0 3.5H14.5" />
    </svg>
  ),
  camera: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ),
  // 계정 화면용 라인 아이콘
  lock: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.5v2.5" />
    </svg>
  ),
  cloud: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.6 4.5 4.5 0 0 0 7 18.5z" />
      <path d="M9.5 14l2 2 3.5-3.5" />
    </svg>
  ),
  faceid: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16" />
      <path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 15.5a3.5 3.5 0 0 0 5 0" />
    </svg>
  ),
  check: (
    <svg {...svg} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  eye: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18M10.6 6.1A8.6 8.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.7 3.4M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5a8.8 8.8 0 0 0 4.4-1.2" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  ),
  shield: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6L12 3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  bell: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" />
      <path d="M10 19.5a2 2 0 0 0 4 0" />
    </svg>
  ),
  gear: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
  prev: (
    <svg {...svg} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  ),
  next: (
    <svg {...svg} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5l7 7-7 7" />
    </svg>
  ),
  plus: (
    <svg {...svg} strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  home: (
    <svg {...svg} strokeWidth="2" strokeLinejoin="round">
      <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" />
    </svg>
  ),
  ledger: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round">
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </svg>
  ),
  save: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21v-9M12 12c0-4 3-6.5 8-6.5 0 4.5-3 6.5-8 6.5zM12 14.5C12 11 9.5 9 5 9c0 3.5 2.5 5.5 7 5.5z" />
    </svg>
  ),
  flow: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4" />
    </svg>
  ),
  goal: (
    <svg {...svg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 21V4M6 4h11l-2.5 4L17 12H6" />
    </svg>
  ),
};
