import { addDays, dateFor } from "./date";
import { paidOf } from "./ledger";
import type { DaysMap, Key } from "./types";

/**
 * y년 m월(0부터)에 결제하는 카드값의 사용 기간.
 * 마감일이 결제일보다 앞이면 같은 달 마감, 아니면(같거나 뒤면) 지난달 마감분을 내요.
 */
export function cardCycle(y: number, m: number, cut: number, pay: number) {
  const to = cut < pay ? dateFor(y, m, cut) : dateFor(y, m - 1, cut);
  const prev = cut < pay ? dateFor(y, m - 1, cut) : dateFor(y, m - 2, cut);
  return { from: addDays(prev, 1), to };
}

/** fromK~toK 사이 신용카드로 결제한 생활비 (친구 몫 포함) */
export const cardSpend = (m: DaysMap, fromK: Key, toK: Key) =>
  Object.keys(m)
    .filter((k) => k >= fromK && k <= toK)
    .reduce((s, k) => s + paidOf(m, k, "card"), 0);
