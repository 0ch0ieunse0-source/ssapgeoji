import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { detectBrowser } from "../lib/browser";
import { hasNoticeRecord, markAllNoticesRead } from "../notices";
import type { ApptTarget } from "../sheets/ApptSheet";
import { kOf, startOfToday } from "../lib/date";
import { getDay, setDay } from "../lib/ledger";
import { budgetOf, daysFor, makePlan, periodOf, planFor, preZero, resplitPlans, shiftPeriod, weeksOf, type DayInfo } from "../lib/period";
import { livingMap } from "../lib/trip";
import { applyFlex, leftoverOf, type FlexInfo } from "../lib/flex";
import { movedIn } from "../lib/savings";
import { cloneData, DATA_KEY, loadData, parseStored, readRaw, saveData, withDisk } from "../lib/storage";
import { onAppError, reportError } from "../lib/errors";
import { merge3 } from "../lib/merge";
import { errorText, loadSession, logOut, needsPush, pull, push, AccountError } from "./vault";
import type { Data, DaysMap, Key, Period, Plan, Settings } from "../lib/types";

export type ViewName = "home" | "ledger" | "save" | "flow" | "goal" | "setup" | "notice" | "rank" | "settle" | "space";
export const VIEWS: ViewName[] = ["home", "ledger", "save", "flow", "goal", "setup", "notice", "rank", "settle", "space"];

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
  /** 그 달 생활비 ('0으로 처리'한 처음 쓰기 전 날의 한도만큼 빠져요) */
  budget: number;
  /** 예비비와 '남은 날에 나눠 쓰기' 계산 (days의 한도에 이미 들어 있어요) */
  flex: FlexInfo;
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
  /** 이미 적은 기록을 고칠 때: 그 기록의 날짜와 id */
  edit?: { day: Key; id: string };
  nonce: number;
}

export interface AccountState {
  id: string | null;
  status: "idle" | "saving" | "saved" | "error";
  at: number | null;
  msg?: string;
}

interface AppValue {
  account: AccountState;
  /** 계정 로그인·로그아웃 뒤 상태 다시 읽기, 또는 지금 바로 맞추기 */
  syncNow: (kind?: "push" | "pull") => void;
  refreshAccount: () => void;
  S: Data;
  storageOk: boolean;
  /** 저장된 기록을 읽지 못했어요 (원본은 따로 보관) */
  broken: boolean;
  dismissBroken: () => void;
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
  /** 적은 기록 고치기 (쓴 돈 적기 화면이 다 채워진 채로 열려요) */
  editEntry: (k: Key, id: string) => void;
  closeEntry: () => void;
  dayKey: Key | null;
  openDay: (k: Key) => void;
  closeDay: () => void;
  toggleNoSpend: (k: Key) => void;
  /** 지난달(-1)·다음 달(+1)로. 막히면 알려줘요 */
  shiftView: (dir: -1 | 1) => void;
  /** 마지막으로 넘긴 방향 (달력 넘김 효과용) */
  slideDir: -1 | 0 | 1;
  /** 약속·여행 추가·수정 창 */
  appt: ApptTarget;
  openAppt: (t: ApptTarget) => void;
  formNonce: number;
  bumpForm: () => void;
  guide: { open: boolean; safariOnly: boolean };
  /** 사용법 열기 (safariOnly: 홈 화면에 추가하는 법만) */
  openGuide: (safariOnly?: boolean) => void;
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
  const [broken, setBroken] = useState(init.broken);
  const sRef = useRef(S);
  // 이 창이 마지막으로 읽거나 쓴 기록·글자. 다른 창(탭)이 그사이 저장했는지 알아보고 합칠 때 써요.
  const baseRef = useRef<Data>(init.data);
  const rawRef = useRef<string | null>(init.raw);
  const dayRef = useRef(today);
  dayRef.current = today;
  const [viewP, setViewP] = useState<Period | null>(null);
  const [hash, setHash] = useState(readHash);
  const [tick, setTick] = useState(0);
  const [toastState, setToast] = useState<AppValue["toastState"]>(null);
  const toastTimer = useRef<number>();
  const [entry, setEntry] = useState<EntryState>({ open: false, day: today, nonce: 0 });
  const [dayKey, setDayKey] = useState<Key | null>(null);
  const [formNonce, setFormNonce] = useState(0);
  const [guide, setGuide] = useState(initialGuide);
  const openGuide = useCallback((safariOnly = false) => setGuide({ open: true, safariOnly }), []);
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

  // 저장: 다른 창이 그사이 저장했으면 합친 뒤 써요 (덮어써서 다른 창 기록을 지우지 않게). merge=false는 백업 불러오기·전부 지우기처럼 통째로 바꿀 때.
  const persist = useCallback((d: Data, merge = true) => {
    const fin = merge ? withDisk(baseRef.current, d, readRaw(), rawRef.current, dayRef.current) : d;
    sRef.current = fin;
    setS(fin);
    const raw = saveData(fin);
    if (raw != null) {
      rawRef.current = raw;
      baseRef.current = fin;
      // 읽지 못한 기록 안내는 백업을 불러오거나 전부 지울 때까지 남겨요 (원본은 따로 보관돼 있어요)
      if (!merge) setBroken(false);
    }
    setStorageOk(raw != null);
  }, []);
  // 기록 고치기: 사본에서 고친 뒤 문제가 없을 때만 저장해요. 고치다 오류가 나면 원래 기록은 그대로 둬요.
  const update = useCallback((fn: (d: Data) => void) => {
    let next: Data;
    try {
      next = cloneData(sRef.current);
      fn(next);
    } catch (e) {
      reportError(e, "save");
      return;
    }
    persist(next);
  }, [persist]);
  const replace = useCallback((d: Data) => persist(d, false), [persist]);
  // 다른 창(탭)에서 저장하면 이 창도 바로 새 기록으로 바꿔요
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DATA_KEY || e.newValue == null || e.newValue === rawRef.current) return;
      const remote = parseStored(e.newValue, dayRef.current);
      if (!remote) return;
      const fin = merge3(baseRef.current, sRef.current, remote);
      rawRef.current = e.newValue;
      baseRef.current = remote;
      if (JSON.stringify(fin) === JSON.stringify(remote)) {
        sRef.current = remote;
        setS(remote);
      } else persist(fin);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [persist]);

  // ── 계정(선택): 잠근 기록을 서버와 맞춰요. 폰 기록이 먼저고, 서버 것은 합치기만 해요 ──
  const readAccount = (): AccountState => {
    const s = loadSession();
    return { id: s?.id || null, status: "idle", at: s?.syncedAt || null };
  };
  const [account, setAccount] = useState<AccountState>(readAccount);
  const syncing = useRef(false);
  const again = useRef<null | "push" | "pull">(null);
  const todayRef = useRef(today);
  todayRef.current = today;
  const syncNow = useCallback((kind: "push" | "pull" = "push") => {
    if (!loadSession()) return;
    if (syncing.current) {
      again.current = again.current === "pull" ? "pull" : kind;
      return;
    }
    if (kind === "push" && !needsPush(sRef.current)) return;
    syncing.current = true;
    setAccount((a) => ({ ...a, status: "saving" }));
    const start = sRef.current;
    (async () => {
      try {
        const res = kind === "pull" ? await pull(start, todayRef.current) : await push(start, todayRef.current);
        if (res) {
          // 맞추는 동안 이 폰에서 더 적었으면 그것도 같이 살려요
          const fin = sRef.current === start ? res : (merge3(start, sRef.current, res) as Data);
          persist(fin);
        }
        const s = loadSession();
        setAccount({ id: s?.id || null, status: "saved", at: s?.syncedAt || null });
      } catch (e) {
        // 다른 기기에서 비밀번호를 바꿨으면 이 폰은 다시 로그인해야 해요 (폰 기록은 그대로)
        if (e instanceof AccountError && e.message === "denied") {
          logOut();
          setAccount({ id: null, status: "error", at: null, msg: "다른 기기에서 비밀번호를 바꿔서 로그아웃됐어요. 다시 로그인해 주세요. 이 폰 기록은 그대로예요." });
        } else setAccount((a) => ({ ...a, status: "error", msg: errorText(e) }));
      } finally {
        syncing.current = false;
        const k = again.current;
        again.current = null;
        if (k) window.setTimeout(() => syncNow(k), 300);
      }
    })();
  }, []);
  const refreshAccount = useCallback(() => setAccount(readAccount()), []);
  // 적을 때마다 1.5초 뒤 올려요
  useEffect(() => {
    if (!account.id) return;
    const t = window.setTimeout(() => syncNow("push"), 1500);
    return () => window.clearTimeout(t);
  }, [S, account.id, syncNow]);
  // 앱을 열거나 다시 볼 때 서버가 더 새로운지 확인해요
  useEffect(() => {
    if (!account.id) return;
    const onShow = () => document.visibilityState === "visible" && syncNow("pull");
    onShow();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("online", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("online", onShow);
    };
  }, [account.id, syncNow]);

  const toastAt = useRef(0);
  const toast = useCallback((text: string, err = false) => {
    toastAt.current = Date.now();
    setToast((t) => ({ text, err, n: (t?.n || 0) + 1 }));
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  // 버튼을 눌렀는데 오류가 나면 '아무 반응 없음' 대신 화면 아래에 오류 내용을 알려줘요
  useEffect(() => {
    onAppError((m) => toast(m, true));
    const onErr = (e: ErrorEvent) => reportError(e.error || e.message);
    const onRej = (e: PromiseRejectionEvent) => reportError(e.reason);
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      onAppError(null);
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, [toast]);

  useEffect(() => {
    const f = () => {
      setHash(readHash());
      // 화면을 옮기면 앞 화면에서 띄운 알림은 바로 닫아요 (저장하고 넘어가며 띄운 알림은 남겨요)
      if (Date.now() - toastAt.current > 700) setToast(null);
    };
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
    const plain = daysFor(view, plan, cfg.appts, cfg.trips, preZero(cfg, S.days));
    const isCur = view.start === cur.start;
    const L = livingMap(S.days, cfg.trips);
    const budget = budgetOf(plan, plain);
    const { days, info: flex } = applyFlex(plain, L, today, { mode: leftoverOf(cfg), budget, moved: movedIn(S.savings.moves, view, cd), isCur });
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
      L,
      budget,
      flex,
    };
  }, [S, viewP, today]);

  // 프로토타입처럼: 처음 시작한 달을 기억하고, 시작된 달의 한도 계획은 저장해 둬요 (나중에 설정을 바꿔도 지난 달은 그대로)
  useEffect(() => {
    const c = S.settings;
    if (!c || (c.joinDate && c.preStart)) return;
    // 기존 사용자: 시작일을 정하고 '그대로 두기'로. 직전 버전에서 다시 나뉜 그 달 자동 한도는 원래대로 되돌려요
    const first = Object.keys(S.days)
      .filter((k) => S.days[k]?.items?.length || S.days[k]?.noSpend)
      .sort()[0];
    const join = c.joinDate || (first && first < today ? first : today);
    update((d) => {
      if (!d.settings) return;
      d.settings.joinDate = join;
      d.settings.preStart = "keep";
      resplitPlans(d.periods, d.settings, [periodOf(join, d.settings.cycleDay)]);
    });
  }, [S.settings, S.days, today, update]);

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
  const editEntry = useCallback((k: Key, id: string) => setEntry((e) => ({ open: true, day: k, edit: { day: k, id }, nonce: e.nonce + 1 })), []);
  const closeEntry = useCallback(() => setEntry((e) => ({ ...e, open: false })), []);
  const openDay = useCallback((k: Key) => setDayKey(k), []);
  const [appt, setAppt] = useState<ApptTarget>(null);
  const [slideDir, setSlideDir] = useState<-1 | 0 | 1>(0);
  const shiftView = useCallback(
    (dir: -1 | 1) => {
      if (!model) return;
      const { view, cur, cfg } = model;
      const cd = cfg.cycleDay;
      const p = shiftPeriod(view, dir, cd);
      if (dir < 0 && cfg.firstStart && p.end < cfg.firstStart) return toast("더 이전 기록은 없어요.");
      if (dir > 0 && p.start > shiftPeriod(cur, 1, cd).start) return toast("다음 달까지만 미리 볼 수 있어요.");
      setSlideDir(dir);
      setViewP(p);
    },
    [model, toast],
  );
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
    account, syncNow, refreshAccount,
    S, storageOk, broken, dismissBroken: () => setBroken(false), now, today, tick, model, route, sub: S.settings || sub === "account" ? sub : "", goBack,
    update, replace, go, toast, toastState,
    setView: (p: Period | null) => {
      setSlideDir(0);
      setViewP(p);
    },
    shiftView, slideDir, appt, openAppt: setAppt,
    entry, openEntry, editEntry, closeEntry, dayKey, openDay, closeDay, toggleNoSpend,
    formNonce, bumpForm: () => setFormNonce((n) => n + 1),
    guide, openGuide, closeGuide, markGuideSeen,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
