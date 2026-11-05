import { sd } from "../lib/date";
import { NOTICES, readNoticeSeen, unreadCount } from "../notices";
import { shiftPeriod } from "../lib/period";
import { useApp, type ViewName } from "../state/app";
import { Icon } from "./common";

function NoticeButton() {
  const { go } = useApp();
  const unread = unreadCount(NOTICES, readNoticeSeen());
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
  const { model, go } = useApp();
  const name = model?.cfg.name;
  return (
    <div className="top">
      <h1>{name ? name + "님의 거지노트" : "거지노트"}</h1>
      <div className="top-r">
        <div className="status" data-state="local">
          이 기기에 저장돼요
        </div>
        {model && <NoticeButton />}
        {model && (
          <button className="gear" aria-label="설정" onClick={() => go("setup")}>
            {Icon.gear}
          </button>
        )}
      </div>
    </div>
  );
}

export function Banner() {
  const { storageOk } = useApp();
  if (storageOk) return null;
  return (
    <div className="banner" role="alert">
      이 브라우저에서는 저장이 안 돼요. 시크릿 창이면 일반 창으로 열어주세요. 지금 적는 기록은 창을 닫으면 사라져요.
    </div>
  );
}

export function PeriodNav() {
  const { model, setView, toast } = useApp();
  if (!model) return null;
  const { view, cur, cfg, isCur } = model;
  const cd = cfg.cycleDay;
  const prevBlocked = !!(cfg.firstStart && shiftPeriod(view, -1, cd).end < cfg.firstStart);
  const prev = () => {
    const p = shiftPeriod(view, -1, cd);
    if (cfg.firstStart && p.end < cfg.firstStart) return toast("더 이전 기록은 없어요.");
    setView(p);
  };
  const next = () => {
    const p = shiftPeriod(view, 1, cd);
    if (p.start > shiftPeriod(cur, 1, cd).start) return toast("다음 달까지만 미리 볼 수 있어요.");
    setView(p);
  };
  return (
    <div className="pnav">
      <button className="pbtn" aria-label="이전 달" disabled={prevBlocked} onClick={prev}>
        {Icon.prev}
      </button>
      <div className="pmid" aria-live="polite">
        <b>{sd(view.start) + " ~ " + sd(view.end)}</b>
        <span className={isCur ? "badge" : "badge warn"}>{isCur ? "이번 달" : view.start < cur.start ? "지난 달" : "다음 달 미리 보기"}</span>
      </div>
      <button className="pbtn" aria-label="다음 달" disabled={view.start > cur.start} onClick={next}>
        {Icon.next}
      </button>
    </div>
  );
}

const TABS: { v: ViewName; label: string; icon: JSX.Element }[] = [
  { v: "home", label: "홈", icon: Icon.home },
  { v: "ledger", label: "가계부", icon: Icon.ledger },
  { v: "save", label: "아끼기", icon: Icon.save },
  { v: "flow", label: "돈 일정", icon: Icon.flow },
  { v: "goal", label: "목표", icon: Icon.goal },
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
            <button key={t.v} className="tab" role="tab" aria-selected={route === t.v} onClick={() => go(t.v)}>
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
