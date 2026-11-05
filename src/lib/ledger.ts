import type { DayRec, DaysMap, Item, Key, Pay } from "./types";

export const emptyDay = (): DayRec => ({ items: [], limit: null, noSpend: false });
export const getDay = (m: DaysMap, k: Key): DayRec => m[k] || emptyDay();
export const setDay = (m: DaysMap, k: Key, patch: Partial<DayRec>) => {
  m[k] = Object.assign(emptyDay(), getDay(m, k), patch);
};

/** 내 몫 (친구 몫을 나누지 않았으면 전체 금액) */
export const mineOf = (it: Item) => (typeof it.mine === "number" ? it.mine : it.amount || 0);

/** 그날 한도: 직접 바꾼 한도가 있으면 그것, 없으면 기본 한도 */
export const limitOf = (m: DaysMap, d: { key: Key; base: number }) => {
  const s = m[d.key];
  return s && typeof s.limit === "number" ? s.limit : d.base;
};

export const spentOf = (m: DaysMap, k: Key) => getDay(m, k).items.reduce((s, it) => s + mineOf(it), 0);

/** 그날 결제수단별로 실제 결제한 금액 (친구 몫 포함) */
export const paidOf = (m: DaysMap, k: Key, pay: Pay) =>
  getDay(m, k).items.reduce((s, it) => s + ((it.pay || "check") === pay ? it.amount || 0 : 0), 0);

export const isNoSpend = (m: DaysMap, k: Key) => getDay(m, k).noSpend && getDay(m, k).items.length === 0;
export const loggedDay = (m: DaysMap, k: Key) => getDay(m, k).items.length > 0 || isNoSpend(m, k);

export const viewItems = (m: DaysMap, days: { key: Key }[]) =>
  days.flatMap((d) => getDay(m, d.key).items.map((it) => ({ it, key: d.key })));
export const everyItem = (m: DaysMap) =>
  Object.keys(m).sort().flatMap((k) => getDay(m, k).items.map((it) => ({ it, key: k })));

/** 아직 못 받은 친구 몫 */
export const owesOf = (m: DaysMap) => everyItem(m).filter(({ it }) => it.amount > mineOf(it) && !it.received);
