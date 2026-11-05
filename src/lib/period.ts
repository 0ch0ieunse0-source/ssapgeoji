import { addDays, dateFor, dOf } from "./date";
import type { Key, Period, Plan, Settings } from "./types";

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
}

/** 기간 안의 평일·주말·약속 날 수 (약속 날은 평일·주말에서 빠져요) */
export function countsFor(p: Period, appts: Key[] | undefined): Counts {
  const set = new Set(appts || []);
  let wd = 0, we = 0, ap = 0;
  for (let k = p.start; k <= p.end; k = addDays(k, 1)) {
    const w = dOf(k).getDay();
    if (set.has(k)) ap++;
    else if (w === 0 || w === 6) we++;
    else wd++;
  }
  return { wd, we, ap, n: wd + we + ap };
}

/** 하루 한도 자동 배분: 생활비의 95%에서 약속 날 몫을 빼고, 주말은 평일의 1.5배. 500원 단위로 내려요. */
export function splitFor(total: number, apptLimit: number, c: Counts) {
  const budget = total * 0.95 - c.ap * apptLimit;
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
  if (cfg.autoLimits) Object.assign(plan, splitFor(plan.total, plan.apptLimit, countsFor(p, cfg.appts)));
  return plan;
}

/** 저장된 계획이 있으면 그걸, 없으면 지금 설정으로 새로 만든 계획 */
export const planFor = (periods: Record<Key, Plan>, cfg: Settings, p: Period): Plan =>
  periods[p.start] || makePlan(cfg, p);

export interface DayInfo {
  key: Key;
  date: Date;
  wd: number; // 0 = 일요일
  base: number; // 기본 한도
  tag: "" | "주말" | "약속";
}

export function daysFor(p: Period, plan: Plan, appts: Key[] | undefined): DayInfo[] {
  const appt = new Set(appts || []);
  const out: DayInfo[] = [];
  for (let k = p.start; k <= p.end; k = addDays(k, 1)) {
    const d = dOf(k), wd = d.getDay(), we = wd === 0 || wd === 6;
    let base = we ? plan.weekend : plan.weekday;
    let tag: DayInfo["tag"] = we ? "주말" : "";
    if (appt.has(k)) {
      base = plan.apptLimit;
      tag = "약속";
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
