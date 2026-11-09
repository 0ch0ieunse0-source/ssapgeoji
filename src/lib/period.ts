import { addDays, dateFor, dOf } from "./date";
import type { DaysMap, Key, Period, Plan, Settings } from "./types";
import { tripAlloc, tripOn, type Trip } from "./trip";

/** k가 들어 있는 한 달 기간. cycleDay일에 시작해서 다음 달 cycleDay 전날에 끝나요. */
export function periodOf(k: Key, cycleDay: number): Period {
  const d = dOf(k);
  let s = dateFor(d.getFullYear(), d.getMonth(), cycleDay);
  if (s > k) s = dateFor(d.getFullYear(), d.getMonth() - 1, cycleDay);
  const sdd = dOf(s);
  return { start: s, end: addDays(dateFor(sdd.getFullYear(), sdd.getMonth() + 1, cycleDay), -1) };
}

/** n > 0이면 다음 기간, 아니면 이전 기간 */
export const shiftPeriod = (p: Period, n: number, cycleDay: number): Period =>
  n > 0 ? periodOf(addDays(p.end, 1), cycleDay) : periodOf(addDays(p.start, -1), cycleDay);

export interface Counts {
  wd: number;
  we: number;
  ap: number;
  n: number;
  /** 여행(생활비 안에서) 날 수와 그 몫 합계 — 이 날들은 평일·주말·약속에서 빠져요 */
  td?: number;
  trip?: number;
}

/**
 * 기간 안의 평일·주말·약속 날 수 (약속 날은 평일·주말에서 빠져요).
 * 여행 중 '생활비 안에서' 날은 따로 세고, '따로 모아 둔 돈' 날은 평소처럼 세요 (다른 날 한도가 그대로이게).
 */
export function countsFor(p: Period, appts: Key[] | undefined, trips?: Trip[]): Counts {
  const set = new Set(appts || []);
  let wd = 0, we = 0, ap = 0, td = 0, trip = 0;
  for (let k = p.start; k <= p.end; k = addDays(k, 1)) {
    const t = tripOn(trips, k);
    if (t && t.fund === "living") {
      td++;
      trip += tripAlloc(t, k);
      continue;
    }
    const w = dOf(k).getDay();
    if (!t && set.has(k)) ap++;
    else if (w === 0 || w === 6) we++;
    else wd++;
  }
  const c: Counts = { wd, we, ap, n: wd + we + ap };
  if (td) Object.assign(c, { td, trip, n: c.n + td });
  return c;
}

/** 하루 한도 자동 배분: 생활비의 95%에서 약속 날 몫을 빼고, 주말은 평일의 1.5배. 500원 단위로 내려요. */
export function splitFor(total: number, apptLimit: number, c: Counts) {
  const budget = total * 0.95 - c.ap * apptLimit - (c.trip || 0);
  const w = Math.max(0, Math.floor(budget / (c.wd + 1.5 * c.we || 1) / 500) * 500);
  return { weekday: w, weekend: Math.floor((w * 1.5) / 500) * 500 };
}

export function makePlan(cfg: Settings, p: Period): Plan {
  const plan: Plan = {
    total: cfg.total,
    apptLimit: cfg.apptLimit || 0,
    auto: !!cfg.autoLimits,
    weekday: cfg.weekday,
    weekend: cfg.weekend,
  };
  if (cfg.autoLimits) Object.assign(plan, splitFor(plan.total, plan.apptLimit, countsFor(p, cfg.appts, cfg.trips)));
  return plan;
}

/** 저장된 계획이 있으면 그걸, 없으면 지금 설정으로 새로 만든 계획 */
export const planFor = (periods: Record<Key, Plan>, cfg: Settings, p: Period): Plan =>
  periods[p.start] || makePlan(cfg, p);

export interface DayInfo {
  key: Key;
  date: Date;
  wd: number; // 0 = 일요일
  base: number; // 기본 한도 (여행 날은 생활비 계산용 몫)
  tag: "" | "주말" | "약속" | "여행";
  trip?: Trip; // 여행 날이면 그 여행
  pre?: boolean; // '0으로 처리'한 처음 쓰기 전 날 (한도 0)
  preBase?: number; // 그날 원래 한도 (그 달 생활비에서 빼는 금액)
  flex?: number; // '남은 날에 나눠 쓰기'로 더해진(빠진) 금액. base에 이미 들어 있어요
}

export function daysFor(p: Period, plan: Plan, appts: Key[] | undefined, trips?: Trip[], isPre?: (k: Key) => boolean): DayInfo[] {
  const appt = new Set(appts || []);
  const out: DayInfo[] = [];
  for (let k = p.start; k <= p.end; k = addDays(k, 1)) {
    const d = dOf(k), wd = d.getDay(), we = wd === 0 || wd === 6;
    const t = tripOn(trips, k);
    if (t) {
      out.push({ key: k, date: d, wd, base: tripAlloc(t, k), tag: "여행", trip: t });
      continue;
    }
    let base = we ? plan.weekend : plan.weekday;
    let tag: DayInfo["tag"] = we ? "주말" : "";
    if (appt.has(k)) {
      base = plan.apptLimit;
      tag = "약속";
    }
    if (isPre?.(k)) {
      out.push({ key: k, date: d, wd, base: 0, tag, pre: true, preBase: base });
      continue;
    }
    out.push({ key: k, date: d, wd, base, tag });
  }
  return out;
}

/** 월요일마다 새 주를 시작해요 (첫 주는 기간 시작일부터) */
export function weeksOf(days: DayInfo[]): DayInfo[][] {
  const weeks: DayInfo[][] = [];
  days.forEach((d) => {
    const last = weeks[weeks.length - 1];
    if (!last || d.wd === 1) weeks.push([d]);
    else last.push(d);
  });
  return weeks;
}

/** start~end에 걸친 한 달 기간들 */
export function periodsTouching(start: Key, end: Key, cycleDay: number): Period[] {
  const out: Period[] = [];
  for (let p = periodOf(start, cycleDay); p.start <= end; p = shiftPeriod(p, 1, cycleDay)) out.push(p);
  return out;
}

/** 약속·여행을 바꾼 뒤, 저장해 둔 '자동 배분' 계획을 다시 나눠요 (직접 입력한 한도는 그대로) */
export function resplitPlans(periods: Record<Key, Plan>, cfg: Settings, ps: Period[]) {
  ps.forEach((p) => {
    const pl = periods[p.start];
    if (pl && pl.auto) Object.assign(pl, splitFor(pl.total, pl.apptLimit, countsFor(p, cfg.appts, cfg.trips)));
  });
}

/**
 * 처음 쓰기 전 날 중 '0으로 처리'할 날 (설정에서 0으로 처리를 고른 사람만).
 * 기록·무지출·한도를 직접 넣은 날은 건드리지 않아요.
 */
export function preZero(cfg: Settings, m: DaysMap): ((k: Key) => boolean) | undefined {
  if (cfg.preStart !== "zero" || !cfg.joinDate) return undefined;
  const join = cfg.joinDate;
  return (k) => {
    if (k >= join) return false;
    const r = m[k];
    return !(r && (r.items?.length || r.noSpend || typeof r.limit === "number"));
  };
}

/** 그 달 생활비: '0으로 처리'한 날의 원래 한도만큼 빼요 */
export const budgetOf = (plan: Plan, days: DayInfo[]) => plan.total - days.reduce((s, d) => s + (d.preBase || 0), 0);
