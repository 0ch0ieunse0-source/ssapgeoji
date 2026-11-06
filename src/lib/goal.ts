import { dOf } from "./date";
import type { Key, Settings, Snap } from "./types";

// 칸이 비어 있어도(예전 기록·백업) 0으로 봐요
export const snapValue = (s: Snap) => (Number(s.cash) || 0) + (Number(s.cy) || 0) + (Number(s.etf) || 0);

/**
 * 저축 목표 계산. cfg.goalAmt와 cfg.goalDate가 있을 때만 부르세요.
 * now는 오늘 0시 Date.
 */
export function computeGoal(cfg: Settings, rawSnaps: Snap[], now: Date, curStart: Key) {
  const GOAL = cfg.goalAmt!, gEnd = dOf(cfg.goalDate!);
  const snaps = rawSnaps.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = snaps[snaps.length - 1] || null;
  const base = typeof cfg.balance === "number" ? cfg.balance : 0;
  const current = latest ? snapValue(latest) : base;

  // 목표 경로: 첫 기록(없으면 처음 시작한 날)에서 목표 날짜까지 직선
  const t0 = dOf(snaps.length ? snaps[0].date : cfg.firstStart || curStart).getTime();
  const t1 = gEnd.getTime();
  const startVal = snaps.length ? snapValue(snaps[0]) : base;
  const frac = t1 > t0 ? Math.max(0, Math.min(1, (now.getTime() - t0) / (t1 - t0))) : 1;
  const pace = startVal + (GOAL - startVal) * frac;

  // 남은 월급날 수 (월급날이 없으면 남은 달 수)
  let monthsLeft = 0;
  if (cfg.payday) {
    const d = new Date(now.getFullYear(), now.getMonth(), cfg.payday);
    if (d < now) d.setMonth(d.getMonth() + 1);
    while (d <= gEnd) { monthsLeft++; d.setMonth(d.getMonth() + 1); }
  } else {
    monthsLeft = Math.max(0, (gEnd.getFullYear() - now.getFullYear()) * 12 + gEnd.getMonth() - now.getMonth());
  }

  return {
    goal: GOAL,
    goalEnd: gEnd,
    snaps,
    latest,
    base,
    current,
    t0,
    t1,
    startVal,
    pace,
    progress: Math.min(100, (current / GOAL) * 100),
    byPayday: !!cfg.payday,
    monthsLeft,
    remain: GOAL - current,
    monthly: Math.max(0, (GOAL - current) / Math.max(1, monthsLeft)),
    gap: current - pace,
  };
}
