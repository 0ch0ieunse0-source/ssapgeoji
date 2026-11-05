import { periodOf, type DayInfo } from "./period";
import { limitOf, loggedDay, spentOf } from "./ledger";
import { tripLogged, tripSpent, type Trip } from "./trip";
import type { DaysMap, Key, Move, Period, Wish } from "./types";

/**
 * 기록을 남긴 지난날마다 한도보다 덜 쓴 금액 (오늘과 기록 없는 날은 빼요).
 * 여행 날은 하루씩 보지 않고, '생활비 안에서' 여행이 끝난 뒤 (예산 − 쓴 돈)을 끝난 날에 한 번 넣어요.
 */
export function savedDays(m: DaysMap, days: DayInfo[], today: Key): { d: DayInfo; v: number; trip?: Trip }[] {
  const out: { d: DayInfo; v: number; trip?: Trip }[] = [];
  days.forEach((d) => {
    if (d.key >= today) return;
    if (d.trip) {
      const t = d.trip;
      if (d.key === t.end && t.fund === "living" && tripLogged(m, t)) out.push({ d, v: Math.max(0, t.budget - tripSpent(m, t)), trip: t });
      return;
    }
    if (loggedDay(m, d.key)) out.push({ d, v: Math.max(0, limitOf(m, d) - spentOf(m, d.key)) });
  });
  return out;
}

export const savedTotal = (m: DaysMap, days: DayInfo[], today: Key) =>
  savedDays(m, days, today).reduce((s, x) => s + x.v, 0);

/** 이 기간에 저축통장으로 옮긴 기록 */
export const movesIn = (moves: Move[], p: Period, cycleDay: number) =>
  moves.filter((mv) => (mv.period || periodOf(mv.date, cycleDay).start) === p.start);
export const movedIn = (moves: Move[], p: Period, cycleDay: number) =>
  movesIn(moves, p, cycleDay).reduce((s, mv) => s + (mv.amount || 0), 0);

/** 대기 목록 남은 시간 글자. 다 기다렸으면 null */
export function waitLeft(w: Wish, nowMs: number): string | null {
  const ms = w.addedAt + w.wait * 3600000 - nowMs;
  if (ms <= 0) return null;
  const h = Math.ceil(ms / 3600000);
  return h >= 24 ? Math.floor(h / 24) + "일 " + (h % 24 ? (h % 24) + "시간 " : "") + "남음" : h + "시간 남음";
}

/** 사고 싶은 것 대기 기간 (시간) */
export const WAIT_OPTIONS = [
  { h: 24, label: "하루" },
  { h: 72, label: "3일" },
  { h: 168, label: "1주" },
  { h: 336, label: "2주" },
  { h: 720, label: "1달" },
];
/** 가격에 맞춘 기본 대기 기간: 5만원 미만 하루, 30만원 미만 3일, 100만원 미만 1주, 100만원 이상 1달 */
export const waitForPrice = (price: number) => (price >= 1000000 ? 720 : price >= 300000 ? 168 : price >= 50000 ? 72 : 24);
export const waitLabel = (h: number) => WAIT_OPTIONS.find((o) => o.h === h)?.label ?? Math.round(h / 24) + "일";
