/**
 * 남은 돈을 어떻게 할지 (설정 → 하루 한도)
 * - reserve(예비비에 모으기, 기본): 하루 한도는 그대로. 덜 쓴 돈은 예비비에 모이고, 더 쓴 돈은 예비비에서 빠져요.
 * - spread(남은 날에 나눠 쓰기): 지난날 덜 쓴 돈(더 쓴 돈)을 오늘부터 남은 날 한도에 나눠 더해요(빼요).
 *
 * 저장하는 건 설정의 `leftover` 한 칸뿐이에요. 한도는 그때그때 계산하고, 기록은 건드리지 않아요.
 * 지난날은 늘 원래 한도로 계산해요. 그래서 어제 나눠 받은 돈을 다 썼으면 그만큼 남은 날 몫이 줄어 합계가 맞아요.
 */
import { limitOf, loggedDay, spentOf } from "./ledger";
import type { DayInfo } from "./period";
import { tripLogged, tripSpent } from "./trip";
import type { DaysMap, Key, Settings } from "./types";

export type Leftover = "spread" | "reserve";
export const leftoverOf = (cfg: Pick<Settings, "leftover"> | null | undefined): Leftover => (cfg?.leftover === "spread" ? "spread" : "reserve");

/**
 * 오늘 전, 기록을 남긴 날마다 (한도 − 쓴 돈)의 합계. 덜 쓰면 +, 더 쓰면 −.
 * 기록이 없는 날은 빼요(안 쓴 건지 안 적은 건지 몰라서). '생활비 안에서' 여행은 끝난 날에 (예산 − 쓴 돈)을 한 번 넣어요.
 */
export function pastDiff(m: DaysMap, days: DayInfo[], today: Key): number {
  let s = 0;
  days.forEach((d) => {
    if (d.key >= today) return;
    if (d.trip) {
      const t = d.trip;
      if (d.key === t.end && t.fund === "living" && tripLogged(m, t)) s += t.budget - tripSpent(m, t);
      return;
    }
    if (loggedDay(m, d.key)) s += limitOf(m, d) - spentOf(m, d.key);
  });
  return s;
}

/** 나눠 받을 수 있는 날: 오늘부터, 여행·'0으로 처리'·한도를 직접 바꾼 날은 빼요 */
const canSpread = (m: DaysMap, d: DayInfo, today: Key) => d.key >= today && !d.trip && !d.pre && !(m[d.key] && typeof m[d.key].limit === "number");

export interface Spread {
  days: DayInfo[];
  /** 남은 날에 실제로 나눠 준 금액 합계 (100원 단위로 내리고 남은 건 예비비에 그대로 있어요) */
  given: number;
  /** 나눠 받은 날 수 */
  n: number;
}

/**
 * pool을 남은 날 한도 비율대로 나눠 더해요 (주말·약속처럼 한도가 큰 날이 더 받아요).
 * 100원 단위로 내리고, 모자랄 때도 하루 한도가 0 밑으로 가지 않아요.
 */
export function spreadPool(days: DayInfo[], m: DaysMap, today: Key, pool: number): Spread {
  const idx = days.map((d, i) => (canSpread(m, d, today) ? i : -1)).filter((i) => i >= 0);
  if (!idx.length || !pool) return { days, given: 0, n: 0 };
  const W = idx.reduce((s, i) => s + Math.max(0, days[i].base), 0);
  const out = days.slice();
  let given = 0;
  idx.forEach((i) => {
    const d = days[i];
    const w = W > 0 ? Math.max(0, d.base) / W : 1 / idx.length;
    const raw = pool * w;
    const add = raw >= 0 ? Math.floor(raw / 100) * 100 : Math.max(-d.base, -Math.ceil(-raw / 100) * 100);
    if (!add) return;
    given += add;
    out[i] = { ...d, base: d.base + add, flex: add };
  });
  return { days: out, given, n: idx.length };
}

export interface FlexInfo {
  mode: Leftover;
  /** 처음 예비비: 그 달 생활비 − 하루 한도 합계 (원래 한도 기준) */
  base: number;
  /** 지난날 덜 쓴 돈(+)·더 쓴 돈(−) 합계 */
  diff: number;
  /** 이 달에 저축통장으로 옮긴 돈 */
  moved: number;
  /** 남은 날에 나눠 준 돈 (나눠 쓰기일 때만) */
  given: number;
  /** 나눠 받은 날 수 */
  n: number;
  /** 지금 예비비 */
  reserve: number;
}

/**
 * 한 달 화면에 쓸 한도와 예비비.
 * 나눠 쓰기는 이번 달(오늘이 있는 달)에만 해요. 지난달·다음 달은 원래 한도 그대로예요.
 */
export function applyFlex(
  plain: DayInfo[],
  m: DaysMap,
  today: Key,
  opt: { mode: Leftover; budget: number; moved: number; isCur: boolean },
): { days: DayInfo[]; info: FlexInfo } {
  const base = opt.budget - plain.reduce((s, d) => s + limitOf(m, d), 0);
  const started = plain.length > 0 && plain[0].key < today;
  const diff = started ? pastDiff(m, plain, today) : 0;
  if (opt.mode === "spread" && opt.isCur) {
    const pool = diff - opt.moved;
    const sp = spreadPool(plain, m, today, pool);
    return { days: sp.days, info: { mode: "spread", base, diff, moved: opt.moved, given: sp.given, n: sp.n, reserve: base + pool - sp.given } };
  }
  return { days: plain, info: { mode: opt.mode, base, diff, moved: opt.moved, given: 0, n: 0, reserve: base + diff - opt.moved } };
}
