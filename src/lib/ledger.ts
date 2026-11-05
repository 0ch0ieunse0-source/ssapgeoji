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

/** 분류별 내 몫: 차수마다 분류가 있으면 차수별로 나눠요 (합계는 내 몫과 같아요) */
export function catShares(it: Item): { cat: string; v: number }[] {
  const m = mineOf(it);
  const rs = it.rounds;
  if (!rs?.length || !rs.some((r) => r.cat)) return [{ cat: it.cat || "기타", v: m }];
  const w = rs.map((r) => (typeof r.mine === "number" ? r.mine : r.amount));
  const W = w.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return rs.map((r, i) => {
    const v = i === rs.length - 1 ? m - acc : Math.round((m * w[i]) / W);
    acc += v;
    return { cat: r.cat || it.cat || "기타", v };
  });
}
/** 내역에 보일 분류: "식비·카페·간식" (세 개 넘으면 "외") */
export function catsLabel(it: Item): string {
  const cats = [...new Set(catShares(it).map((x) => x.cat))];
  return cats.length > 2 ? cats.slice(0, 2).join("·") + " 외" : cats.join("·");
}
