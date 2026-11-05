import { dOf } from "./date";
import type { Data, Key, Settings } from "./types";

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

export function loadData(today: Key): { data: Data; ok: boolean } {
  try {
    return { data: normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"), today), ok: true };
  } catch {
    return { data: EMPTY(), ok: false };
  }
}

export function saveData(data: Data): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
