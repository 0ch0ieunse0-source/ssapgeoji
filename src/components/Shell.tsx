import { sd } from "../lib/date";
import { IS_PREVIEW } from "../lib/storage";
import { currentUnread } from "../notices";
import { shiftPeriod } from "../lib/period";
import { useApp, type ViewName } from "../state/app";
import { Icon } from "./common";

function NoticeButton() {
  const { go } = useApp();
  const unread = currentUnread().length;
  return (
    <button
      className="gear"
      aria-label={unread ? "공지사항, 새 소식 " + unread + "개" : "공지사항"}
      onClick={() => go("notice")}
    >
      {Icon.bell}
      {unread > 0 && <span className="dot" aria-hidden="true" />}
    </button>
  );
}

export function TopBar() {
  const { model } = useApp();
  const name = model?.cfg.name;
  return (
    <div className="top">
      <h1>{name ? name + "님의 거지노트" : "거지노트"}</h1>
      <div className="top-r">{model && <NoticeButton />}</div>
    </div>
  );
}

/** 통장 탭 안의 세 화면 (돈 일정 · 목표 · 아끼기) */
export const BANK_ROUTES: ViewName[] = ["flow", "goal", "save"];
const BANK_LAST = "ssapgeoji-bank-last";
export function BankTabs() {
  const { route, go } = useApp();
  const items: [ViewName, string][] = [
    ["flow", "돈 일정"],
    ["goal", "목표"],
    ["save", "아끼기"],
  ];
  return (
    <div className="seg bank-tabs" role="tablist" aria-label="통장">
      {items.map(([v, label]) => (
        <button
          key={v}
          role="tab"
          aria-selected={route === v}
          aria-pressed={route === v}
          onClick={() => {
            try {
              sessionStorage.setItem(BANK_LAST, v);
            } catch {
              /* 기억 못 해도 괜찮아요 */
            }
            go(v);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
const lastBank = (): ViewName => {
  try {
    const v = sessionStorage.getItem(BANK_LAST) as ViewName | null;
    return v && BANK_ROUTES.includes(v) ? v : "flow";
  } catch {
    return "flow";
  }
};

export function Banner() {
  const { storageOk } = useApp();
  if (IS_PREVIEW)
    return (
      <div className="banner preview-banner" role="note">
        디자인 테스트 버전이에요. 처음 열 때 기록을 복사해 왔고, 여기서 바꾼 건 진짜 앱에 반영되지 않아요.
      </div>
    );
  if (storageOk) return null;
  return (
    <div className="banner" role="alert">
      이 브라우저에서는 저장이 안 돼요. 시크릿 창이면 일반 창으로 열어주세요. 지금 적는 기록은 창을 닫으면 사라져요.
    </div>
  );
}

export function PeriodNav() {
  const { model, setView, shiftView } = useApp();
  if (!model) return null;
  const { view, cur, cfg, isCur } = model;
  const cd = cfg.cycleDay;
  const prevBlocked = !!(cfg.firstStart && shiftPeriod(view, -1, cd).end < cfg.firstStart);
  const prev = () => shiftView(-1);
  const next = () => shiftView(1);
  return (
    <div className="pnav">
      <button className="pbtn" aria-label="이전 달" disabled={prevBlocked} onClick={prev}>
        {Icon.prev}
      </button>
      <div className="pmid" aria-live="polite">
        <b>{sd(view.start) + " ~ " + sd(view.end)}</b>
        <span className={isCur ? "badge" : "badge warn"}>{isCur ? "이번 달" : view.start < cur.start ? "지난 달" : "다음 달 미리 보기"}</span>
        {!isCur && (
          <button className="today-btn" onClick={() => setView(null)}>
            오늘
          </button>
        )}
      </div>
      <button className="pbtn" aria-label="다음 달" disabled={view.start > cur.start} onClick={next}>
        {Icon.next}
      </button>
    </div>
  );
}

// 아래 탭: 홈 · 가계부 · 통장(돈 일정·목표·아끼기) · 스페이스 · 마이페이지
const TABS: { v: ViewName; label: string; icon: JSX.Element; also: ViewName[] }[] = [
  { v: "home", label: "홈", icon: Icon.home, also: [] },
  { v: "ledger", label: "가계부", icon: Icon.ledger, also: [] },
  { v: "flow", label: "통장", icon: Icon.bank, also: BANK_ROUTES },
  { v: "space", label: "스페이스", icon: Icon.space, also: ["rank"] },
  { v: "setup", label: "마이페이지", icon: Icon.user, also: ["notice"] },
];

export function Dock() {
  const { route, go, openEntry } = useApp();
  return (
    <div className="dock">
      <div className="dock-in">
        {(route === "home" || route === "ledger") && (
          <button className="fab" aria-label="쓴 돈 적기" onClick={() => openEntry()}>
            {Icon.plus}쓴 돈 적기
          </button>
        )}
        <nav className="tabbar" role="tablist" aria-label="메뉴">
          {TABS.map((t) => (
            <button
              key={t.v}
              className="tab"
              role="tab"
              aria-selected={route === t.v || t.also.includes(route)}
              onClick={() => go(t.v === "flow" ? lastBank() : t.v)}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function Toast() {
  const { toastState } = useApp();
  return (
    <div className={"toast" + (toastState?.err ? " err" : "")} role="status" aria-live="polite" hidden={!toastState}>
      {toastState?.text}
    </div>
  );
}
