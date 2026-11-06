import { addDays } from "./date";
import type { DaysMap, Key } from "./types";

export const NUDGE_AFTER_DAYS = 7; // 첫 기록 뒤 7일이 지나면
export const NUDGE_SNOOZE_DAYS = 14; // '다음에'를 누르면 2주 뒤 한 번만 다시

/** 홈에 '기록을 보관하세요' 카드를 보여줄지: 로그인 안 했고, 기록이 7일 넘게 쌓였고, 최근 2주 안에 '다음에'를 누르지 않았을 때 */
export function shouldNudge(o: { loggedIn: boolean; days: DaysMap; today: Key; snoozedOn: Key | null }): number {
  if (o.loggedIn) return 0;
  const keys = Object.keys(o.days).filter((k) => o.days[k]?.items?.length).sort();
  if (!keys.length || keys[0] > addDays(o.today, -NUDGE_AFTER_DAYS)) return 0;
  if (o.snoozedOn && o.snoozedOn > addDays(o.today, -NUDGE_SNOOZE_DAYS)) return 0;
  return keys.reduce((n, k) => n + o.days[k].items.length, 0);
}
