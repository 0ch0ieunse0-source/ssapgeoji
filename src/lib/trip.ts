/**
 * 여행: 여러 날을 한 덩어리 예산으로 관리해요 (그 기간에는 하루 한도를 나누지 않아요).
 * - living(생활비 안에서): 여행 예산이 그 달 생활비의 일부예요. 다른 날 한도가 그만큼 줄어요.
 * - separate(따로 모아 둔 돈): 생활비와 별개예요. 다른 날 한도는 그대로이고, 여행에서 쓴 돈은 생활비에서 빠지지 않아요.
 */
import { addDays, dOf } from "./date";
import { getDay, spentOf } from "./ledger";
import type { DaysMap, Key, Period } from "./types";

export type TripFund = "living" | "separate";
export interface Trip {
  id: string;
  name: string;
  start: Key;
  end: Key;
  budget: number;
  fund: TripFund;
}

export const tripLength = (t: Trip) => Math.round((dOf(t.end).getTime() - dOf(t.start).getTime()) / 86400000) + 1;
export const tripOn = (trips: Trip[] | undefined, k: Key) => (trips || []).find((t) => t.start <= k && k <= t.end);

/** 생활비 계산용 하루 몫: 예산을 여행 날 수로 나눠요 (합계가 예산과 정확히 같게). 따로 모아 둔 돈이면 0 */
export function tripAlloc(t: Trip, k: Key): number {
  if (t.fund !== "living") return 0;
  const n = tripLength(t);
  const i = Math.round((dOf(k).getTime() - dOf(t.start).getTime()) / 86400000);
  if (i < 0 || i >= n) return 0;
  return Math.floor((t.budget * (i + 1)) / n) - Math.floor((t.budget * i) / n);
}

/** 여행 기간에 쓴 돈 (내 몫) */
export function tripSpent(m: DaysMap, t: Trip): number {
  let s = 0;
  for (let k = t.start; k <= t.end; k = addDays(k, 1)) s += spentOf(m, k);
  return s;
}
export const tripLogged = (m: DaysMap, t: Trip) => {
  for (let k = t.start; k <= t.end; k = addDays(k, 1)) if (getDay(m, k).items.length || getDay(m, k).noSpend) return true;
  return false;
};

/** 생활비 계산용 기록: '따로 모아 둔 돈' 여행 날의 지출은 빼요 (화면 목록은 원래 기록을 써요) */
export function livingMap(m: DaysMap, trips: Trip[] | undefined): DaysMap {
  const sep = (trips || []).filter((t) => t.fund === "separate");
  if (!sep.length) return m;
  const out: DaysMap = { ...m };
  Object.keys(m).forEach((k) => {
    if (sep.some((t) => t.start <= k && k <= t.end)) out[k] = { ...m[k], items: [], noSpend: false };
  });
  return out;
}

export const tripsOverlap = (trips: Trip[], start: Key, end: Key, exceptId?: string) =>
  trips.some((t) => t.id !== exceptId && !(end < t.start || start > t.end));

export const tripInPeriod = (t: Trip, p: Period) => !(t.end < p.start || t.start > p.end);
