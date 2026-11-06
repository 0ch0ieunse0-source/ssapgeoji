import { addDays } from "./date";
import type { DaysMap, Key } from "./types";

export const NUDGE_SNOOZE_DAYS = 14; // X를 누르면 2주 동안 안 보여요

/** 홈 맨 위 로그인 배너: 로그인 안 했고, 최근 2주 안에 X를 누르지 않았을 때. 보여줄 땐 기록 개수(0 이상), 아니면 -1 */
export function loginBanner(o: { loggedIn: boolean; days: DaysMap; today: Key; snoozedOn: Key | null }): number {
  if (o.loggedIn) return -1;
  if (o.snoozedOn && o.snoozedOn > addDays(o.today, -NUDGE_SNOOZE_DAYS)) return -1;
  return Object.values(o.days).reduce((n, d) => n + (d?.items?.length || 0), 0);
}
