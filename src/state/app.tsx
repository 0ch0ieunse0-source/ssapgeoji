import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { detectBrowser } from "../lib/browser";
import { hasNoticeRecord, markAllNoticesRead } from "../notices";
import { kOf, startOfToday } from "../lib/date";
import { getDay, setDay } from "../lib/ledger";
import { daysFor, makePlan, periodOf, planFor, shiftPeriod, weeksOf, type DayInfo } from "../lib/period";
import { livingMap } from "../lib/trip";
import { loadData, saveData } from "../lib/storage";
import type { Data, DaysMap, Key, Period, Plan, Settings } from "../lib/types";

export type ViewName = "home" | "ledger" | "save" | "flow" | "goal" | "setup" | "notice" | "rank";
export const VIEWS: ViewName[] = ["home", "ledger", "save", "flow", "goal", "setup", "notice", "rank"];

/** 설정이 끝난 뒤 화면에서 쓰는 값 (지금 보고 있는 달 기준) */
export interface Model {
  cfg: Settings;
  cur: Period; // 오늘이 들어 있는 달
  view: Period; // ‹ › 로 보고 있는 달
  plan: Plan;
  days: DayInfo[];
  weeks: DayInfo[][];
  isCur: boolean;
  refKey: Key; // 홈에서 보여줄 날 (이번 달이면 오늘)
  dayByKey: (k: Key) => DayInfo | undefined;
  /** 생활비 계산용 기록 ('따로 모아 둔 돈' 여행 날 지출은 빠져요). 목록·삭제는 S.days를 써요 */
  L: DaysMap;
}

export interface EntryPreset {
  amount?: number;
  memo?: string;
  cat?: string;
}
interface EntryState {
  open: boolean;
  day: Key;
  pre?: EntryPreset;
  nonce: number;
}

interface AppValue {
  S: Data;
  storageOk: boolean;
  now: Date; // 오늘 0시
  today: Key;
  tick: number; // 1분마다 바뀌어요 (대기 목록 남은 시간)
  model: Model | null;
  route: ViewName;
  /** "#setup/budget" 처럼 / 뒤에 붙은 하위 페이지 이름 */
  sub: string;
  /** 페이지의 뒤로가기: 앱 안에서 왔으면 이전 화면, 링크로 바로 왔으면 fallback */
  goBack: (fallback: ViewName | string) => void;
  /** 데이터를 고치고 바로 저장해요 */
  update: (fn: (d: Data) => void) => void;
  replace: (d: Data) => void;
  setView: (p: Period | null) => void;
  go: (v: ViewName | "" | `${ViewName}/${string}`) => void;
  toast: (text: string, err?: boolean) => void;
  toastState: { text: string; err: boolean; n: number } | null;
  entry: EntryState;
  openEntry: (k?: Key, pre?: EntryPreset) => void;
  closeEntry: () => void;
  dayKey: Key | null;
  openDay: (k: Key) => void;
  closeDay: () => void;
  toggleNoSpend: (k: Key) => void;
  formNonce: number;
  bumpForm: () => void;
  guide: { open: boolean; safariOnly: boolean };
  openGuide: () => void;
  closeGuide: () => void;
  /** 사용법 마지막 장까지 봤으면(건너뛰기 포함) 다시 안 보여줘요 */
  markGuideSeen: () => void;
}

const ONBOARD_KEY = "ssapgeoji-onboarded";
const INAPP_OK_KEY = "ssapgeoji-inapp-ok";
const safeGet = (st: () => Storage, k: string) => {
  try {
    return st().getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (st: () => Storage, k: string) => {
  try {
    st().setItem(k, "1");
  } catch {
    /* 저장이 막힌 브라우저면 다음에 다시 보여줘요 */
  }
};
function initialGuide() {
  if (typeof window === "undefined") return { open: false, safariOnly: false };
  // 홈 화면 아이콘으로 열었으면 이미 Safari에서 사용법을 본 사람이라 다시 보여주지 않아요
  // (아이폰은 Safari와 홈 화면 앱의 저장 공간이 따로라 표시가 안 넘어가요)
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const seen = standalone || safeGet(() => localStorage, ONBOARD_KEY) === "1";
  const inApp = !!detectBrowser(navigator.userAgent).inApp;
  const inAppOk = safeGet(() => sessionStorage, INAPP_OK_KEY) === "1";
  return { open: !seen || (inApp && !inAppOk), safariOnly: seen && inApp };
}

const Ctx = createContext<AppValue | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppProvider 밖이에요");
  return v;
}
export function useModel() {
  const { model } = useApp();
  if (!model) throw new Error("설정이 없어요");
  return model;
}

const readHash = () => (typeof location === "undefined" ? "" : location.hash.slice(1));

export function AppProvider({ children }: { children: ReactNode }) {
  // 오늘 날짜. 앱을 켜 둔 채 자정이 지나도 다음 날로 넘어가도록 다시 확인해요.
  const [now, setNow] = useState(startOfToday);
  const today = kOf(now);
  const [init] = useState(() => loadData(today));
  const [S, setS] = useState<Data>(init.data);
  const [storageOk, setStorageOk] = useState(init.ok);
  const sRef = useRef(S);
  const [viewP, setViewP] = useState<Period | null>(null);
  const [hash, setHash] = useState(readHash);
  const [tick, setTick] = useState(0);
  const [toastState, setToast] = useState<AppValue["toastState"]>(null);
  const toastTimer = useRef<number>();
  const [entry, setEntry] = useState<EntryState>({ open: false, day: today, nonce: 0 });
  const [dayKey, setDayKey] = useState<Key | null>(null);
  const [formNonce, setFormNonce] = useState(0);
  const [guide, setGuide] = useState(initialGuide);
  const openGuide = useCallback(() => setGuide({ open: true, safariOnly: false }), []);
  const markGuideSeen = useCallback(() => {
    // 처음 쓰는 사람은 예전 공지를 새 소식으로 보여주지 않아요
    if (safeGet(() => localStorage, ONBOARD_KEY) !== "1" && !hasNoticeRecord()) markAllNoticesRead();
    safeSet(() => localStorage, ONBOARD_KEY);
  }, []);
  const closeGuide = useCallback(() => {
    safeSet(() => localStorage, ONBOARD_KEY);
    if (detectBrowser(navigator.userAgent).inApp) safeSet(() => sessionStorage, INAPP_OK_KEY);
    setGuide({ open: false, safariOnly: false });
  }, []);

  const update = useCallback((fn: (d: Data) => void) => {
    const next = structuredClone(sRef.current);
    fn(next);
    sRef.current = next;
    setS(next);
    setStorageOk(saveData(next));
  }, []);
  const replace = useCallback((d: Data) => {
    sRef.current = d;
    setS(d);
    setStorageOk(saveData(d));
  }, []);

  const toast = useCallback((text: string, err = false) => {
    setToast((t) => ({ text, err, n: (t?.n || 0) + 1 }));
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    const f = () => setHash(readHash());
    window.addEventListener("hashchange", f);
    // 홈 화면 앱은 새로고침 없이 다시 열리는 일이 많아서, 다시 볼 때와 1분마다 날짜가 바뀌었는지 확인해요
    const checkDay = () => {
      const n = startOfToday();
      setNow((prev) => (prev.getTime() === n.getTime() ? prev : n));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") checkDay();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", checkDay);
    window.addEventListener("pageshow", checkDay);
    const iv = window.setInterval(() => {
      checkDay();
      setTick((t) => t + 1);
    }, 60000);
    return () => {
      window.removeEventListener("hashchange", f);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", checkDay);
      window.removeEventListener("pageshow", checkDay);
      window.clearInterval(iv);
    };
  }, []);

  const navFromApp = useRef(false); // 앱 안에서 화면을 옮긴 적이 있는지 (뒤로가기용)
  const go = useCallback((v: string) => {
    navFromApp.current = true;
    location.hash = v;
    setHash(v);
    window.scrollTo(0, 0);
  }, []);

  const model = useMemo<Model | null>(() => {
    const cfg = S.settings;
    if (!cfg) return null;
    const cd = cfg.cycleDay;
    const cur = periodOf(today, cd);
    let view = viewP;
    if (!view || view.start > shiftPeriod(cur, 1, cd).start) view = cur;
    const plan = planFor(S.periods, cfg, view);
    const days = daysFor(view, plan, cfg.appts, cfg.trips);
    const isCur = view.start === cur.start;
    return {
      cfg,
      cur,
      view,
      plan,
      days,
      weeks: weeksOf(days),
      isCur,
      refKey: isCur ? today : view.end < today ? view.end : view.start,
      dayByKey: (k: Key) => days.find((d) => d.key === k),
      L: livingMap(S.days, cfg.trips),
    };
  }, [S, viewP, today]);

  // 프로토타입처럼: 처음 시작한 달을 기억하고, 시작된 달의 한도 계획은 저장해 둬요 (나중에 설정을 바꿔도 지난 달은 그대로)
  useEffect(() => {
    if (!model) return;
    const missing = [model.cur, model.view].filter((p, i, a) => a.findIndex((x) => x.start === p.start) === i && !S.periods[p.start] && p.start <= today);
    if (model.cfg.firstStart && !missing.length) return;
    update((d) => {
      if (!d.settings) return;
      if (!d.settings.firstStart) d.settings.firstStart = model.cur.start;
      missing.forEach((p) => {
        d.periods[p.start] = makePlan(d.settings!, p);
      });
    });
  }, [model, S.periods, today, update]);

  const [base, sub = ""] = hash.split("/");
  const route: ViewName = !S.settings ? "setup" : VIEWS.includes(base as ViewName) ? (base as ViewName) : "home";
  const goBack = useCallback(
    (fallback: string) => {
      if (navFromApp.current) history.back();
      else go(fallback);
    },
    [go],
  );

  const openEntry = useCallback(
    (k?: Key, pre?: EntryPreset) => {
      if (!model) return;
      setEntry((e) => ({ open: true, day: k || model.refKey, pre, nonce: e.nonce + 1 }));
    },
    [model],
  );
  const closeEntry = useCallback(() => setEntry((e) => ({ ...e, open: false })), []);
  const openDay = useCallback((k: Key) => setDayKey(k), []);
  const closeDay = useCallback(() => setDayKey(null), []);
  const toggleNoSpend = useCallback(
    (k: Key) => {
      const on = !getDay(sRef.current.days, k).noSpend;
      update((d) => setDay(d.days, k, { noSpend: on }));
      toast(on ? "무지출로 표시했어요." : "무지출 표시를 지웠어요.");
    },
    [update, toast],
  );

  const value: AppValue = {
    S, storageOk, now, today, tick, model, route, sub: S.settings ? sub : "", goBack,
    update, replace, setView: setViewP, go, toast, toastState,
    entry, openEntry, closeEntry, dayKey, openDay, closeDay, toggleNoSpend,
    formNonce, bumpForm: () => setFormNonce((n) => n + 1),
    guide, openGuide, closeGuide, markGuideSeen,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
