import { dOf } from "./date";
import { merge3 } from "./merge";
import type { Data, Key, Settings } from "./types";

// 앱 이름이 바뀌어도 기존 기록을 그대로 읽도록 예전 이름을 유지해요. 바꾸면 모두의 기록이 사라진 것처럼 보여요.
export const STORAGE_KEY = "aggim-v1";

export const EMPTY = (): Data => ({
  v: 2,
  settings: null,
  periods: {},
  days: {},
  flows: { over: {}, custom: [] },
  goal: { snaps: [] },
  wish: { items: [] },
  savings: { moves: [] },
});

/** 저장된 값이나 백업 파일을 지금 구조로 맞춰요 (예전 버전 데이터도 옮겨요) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalize(raw: any, today: Key): Data {
  const s = EMPTY();
  if (!raw || typeof raw !== "object") return s;
  if (raw.settings && typeof raw.settings === "object") {
    const c = Object.assign({}, raw.settings);
    if (!c.cycleDay) c.cycleDay = c.start ? dOf(c.start).getDate() : 1; // 예전 버전(기간 1회) 옮기기
    if (c.autoLimits == null) c.autoLimits = !c.weekday;
    if (typeof c.balance === "number" && !c.balanceDate) c.balanceDate = c.start || today;
    if (c.firstStart == null) c.firstStart = c.start || null;
    delete c.start;
    delete c.end;
    s.settings = c as Settings;
  }
  if (raw.periods && typeof raw.periods === "object") s.periods = raw.periods;
  if (raw.days && typeof raw.days === "object") s.days = raw.days;
  if (raw.flows) s.flows = { over: raw.flows.over || {}, custom: Array.isArray(raw.flows.custom) ? raw.flows.custom : [] };
  if (raw.goal && Array.isArray(raw.goal.snaps)) s.goal = raw.goal;
  if (raw.wish && Array.isArray(raw.wish.items)) s.wish = raw.wish;
  if (raw.savings && Array.isArray(raw.savings.moves)) s.savings = raw.savings;
  return s;
}

/** 디자인 테스트 버전(/test/)은 진짜 기록을 한 번 복사해 와서 따로 저장해요. 진짜 기록(aggim-v1)에는 절대 쓰지 않아요. */
export const IS_PREVIEW = import.meta.env.VITE_PREVIEW === "1";
const PREVIEW_KEY = "ssapgeoji-preview";
const KEY = IS_PREVIEW ? PREVIEW_KEY : STORAGE_KEY;
/** 이 화면이 실제로 쓰는 저장 키 (테스트 버전은 따로) */
export const DATA_KEY = KEY;

/** 읽지 못한 기록 원본을 따로 보관하는 키 (덮어써서 잃어버리지 않게) */
export const BROKEN_KEY = KEY + "-broken";

export interface Loaded {
  data: Data;
  ok: boolean;
  /** 저장된 기록이 있었는데 읽지 못했어요 (원본은 BROKEN_KEY에 옮겨 뒀어요) */
  broken: boolean;
  /** 읽은 그대로의 글자 (다른 창이 저장했는지 비교할 때 써요) */
  raw: string | null;
}

/** 저장소 글자를 기록으로 바꿔요. 읽지 못하면 null */
export function parseStored(raw: string | null, today: Key): Data | null {
  if (raw == null) return EMPTY();
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    return normalize(v, today);
  } catch {
    return null;
  }
}

/** 읽지 못한 원본을 따로 보관해요. 이미 보관한 게 있으면 시간을 붙여 하나 더 둬요 */
function keepBroken(raw: string) {
  try {
    const old = localStorage.getItem(BROKEN_KEY);
    if (old === raw) return;
    localStorage.setItem(old == null ? BROKEN_KEY : BROKEN_KEY + "-" + Date.now(), raw);
  } catch {
    /* 저장 공간이 없으면 어쩔 수 없어요 */
  }
}

export function loadData(today: Key): Loaded {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY) ?? (IS_PREVIEW ? localStorage.getItem(STORAGE_KEY) : null);
  } catch {
    return { data: EMPTY(), ok: false, broken: false, raw: null };
  }
  const data = parseStored(raw, today);
  if (data) return { data, ok: true, broken: false, raw };
  keepBroken(raw!);
  return { data: EMPTY(), ok: true, broken: true, raw };
}

/** 지금 저장소에 있는 글자 (다른 창이 바꿨는지 볼 때) */
export function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * 저장하기 전에, 다른 창(탭)이 그사이 저장한 게 있으면 합쳐요.
 * base = 이 창이 마지막으로 읽거나 쓴 기록, local = 이 창에서 고친 기록, disk = 지금 저장소 글자.
 * 다른 창이 안 바꿨으면 local 그대로. 읽을 수 없는 글자면 local 그대로(원본은 따로 보관).
 */
export function withDisk(base: Data, local: Data, disk: string | null, lastRaw: string | null, today: Key): Data {
  if (disk === lastRaw || disk == null) return local;
  const remote = parseStored(disk, today);
  if (!remote) {
    keepBroken(disk);
    return local;
  }
  return merge3(base, local, remote);
}

/** 저장하고, 저장한 글자를 돌려줘요. 실패하면 null */
export function saveData(data: Data): string | null {
  try {
    const raw = JSON.stringify(data);
    localStorage.setItem(KEY, raw);
    return raw;
  } catch {
    return null;
  }
}

/** 기록 사본 만들기. 예전 아이폰(iOS 15.3 이하)엔 structuredClone이 없어서 JSON으로 복사해요 (기록은 JSON이라 똑같아요) */
export const cloneData = <T>(d: T): T => (typeof structuredClone === "function" ? structuredClone(d) : (JSON.parse(JSON.stringify(d)) as T));
