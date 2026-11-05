import { addDays, dateFor, dOf } from "./date";
import { cardCycle, cardSpend } from "./card";
import { everyItem, isNoSpend, limitOf, mineOf, paidOf, spentOf } from "./ledger";
import type { DayInfo } from "./period";
import type { Data, DaysMap, FlowStatus, Key, Period, Settings } from "./types";

export const LOW_BALANCE = 300000;

export interface FlowItem {
  id: string;
  date: Key;
  label: string;
  type: "in" | "out" | "card";
  amount: number;
  status: FlowStatus;
  note?: string;
  cycle?: { from: Key; to: Key };
  auto?: boolean;
}

/** fromK가 있는 달부터 toK가 있는 달까지 [년, 월(0부터)] 목록 */
export function months(fromK: Key, toK: Key): [number, number][] {
  const out: [number, number][] = [];
  const a = dOf(fromK), b = dOf(toK);
  let y = a.getFullYear(), m = a.getMonth();
  while (y < b.getFullYear() || (y === b.getFullYear() && m <= b.getMonth())) {
    out.push([y, m]);
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return out;
}

/** 돈 일정을 어디까지 보여줄지: 이번 달이 끝난 뒤 첫 월급날 (월급이 없으면 기간 끝 + 7일) */
export function horizonEnd(cfg: Settings, cur: Period): Key {
  if (cfg.payday && cfg.salary) {
    const d = dOf(cur.end);
    let c = dateFor(d.getFullYear(), d.getMonth(), cfg.payday);
    if (c <= cur.end) c = dateFor(d.getFullYear(), d.getMonth() + 1, cfg.payday);
    return c;
  }
  return addDays(cur.end, 7);
}

/** 월급·고정지출·카드값 자동 일정 + 직접 추가한 일정 (날짜순, 같은 날이면 들어오는 돈 먼저) */
export function flowItems(data: Data, cfg: Settings, cur: Period, includeAll: boolean): FlowItem[] {
  const from = includeAll ? cur.start : cfg.balanceDate ? addDays(cfg.balanceDate, 1) : cur.start;
  const hEnd = horizonEnd(cfg, cur);
  const out: FlowItem[] = [];
  months(from, hEnd).forEach(([y, m]) => {
    if (cfg.payday && cfg.salary) {
      const k = dateFor(y, m, cfg.payday);
      if (k >= from && k <= hEnd)
        out.push({ id: "pay-" + k, date: k, label: "월급", type: "in", amount: cfg.salary, note: "예상 실수령액", auto: true, status: "plan" });
    }
    (cfg.fixed || []).forEach((f) => {
      const k = dateFor(y, m, f.day);
      if (k >= from && k <= hEnd)
        out.push({ id: "fx-" + f.id + "-" + k, date: k, label: f.name, type: "out", amount: f.amount, auto: true, status: "plan" });
    });
    if (cfg.cardPay && cfg.cardCut) {
      const k = dateFor(y, m, cfg.cardPay);
      if (k >= from && k <= hEnd)
        out.push({ id: "card-" + k, date: k, label: "카드값", type: "card", amount: 0, cycle: cardCycle(y, m, cfg.cardCut, cfg.cardPay), auto: true, status: "plan" });
    }
  });
  out.forEach((it) => {
    const o = data.flows.over[it.id] || {};
    it.status = o.status || "plan";
    if (typeof o.amount === "number") it.amount = o.amount;
  });
  data.flows.custom
    .filter((c) => c.date >= from && c.date <= addDays(hEnd, 31))
    .forEach((c) => out.push(Object.assign({ status: "plan" as FlowStatus }, c)));
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.type === "in" ? -1 : 1));
}

/** 통장에 더해지는(+) 또는 빠지는(-) 금액. 카드값은 칸에 넣은 금액 + 그 기간 신용카드 생활비 */
export function flowAmount(it: FlowItem, m: DaysMap): number {
  if (it.type === "card") return -(it.amount + cardSpend(m, it.cycle!.from, it.cycle!.to));
  return it.type === "in" ? it.amount : -it.amount;
}

/** 잔액을 맞춘 다음 날부터 k까지 체크카드로 쓴 돈 + 이번 달 남은 날의 남은 한도 */
export function lifeOutUntil(k: Key, cfg: Settings, m: DaysMap, curDays: DayInfo[], today: Key): number {
  let s = 0;
  Object.keys(m).forEach((dk) => {
    if (dk > cfg.balanceDate! && dk <= k && dk < today) s += paidOf(m, dk, "check");
  });
  curDays.forEach((d) => {
    if (d.key >= today && d.key <= k)
      s += paidOf(m, d.key, "check") + (isNoSpend(m, d.key) ? 0 : Math.max(0, limitOf(m, d) - spentOf(m, d.key)));
  });
  return s;
}

/** 잔액을 맞춘 뒤 k까지 친구한테 받은 돈 */
export const receivedUntil = (k: Key, cfg: Settings, m: DaysMap) =>
  everyItem(m).reduce(
    (s, { it }) =>
      s + (it.received && it.receivedOn && it.receivedOn > cfg.balanceDate! && it.receivedOn <= k ? it.amount - mineOf(it) : 0),
    0,
  );

export interface FlowRow {
  it: FlowItem;
  amt: number;
  bal: number;
}

/** 일정마다 통장 예상 잔액, 마지막 잔액, 가장 적을 때 (잔액이 설정된 경우에만 부르세요) */
export function computeFlow(data: Data, cfg: Settings, cur: Period, curDays: DayInfo[], today: Key) {
  const items = flowItems(data, cfg, cur, false);
  const balance = cfg.balance ?? 0;
  let run = 0, minBal = Infinity, lastBal = balance;
  let minAt: FlowItem | null = null;
  const rows: FlowRow[] = items.map((it) => {
    const amt = flowAmount(it, data.days);
    if (it.status !== "skip") run += amt;
    const bal = balance + run - lifeOutUntil(it.date, cfg, data.days, curDays, today) + receivedUntil(it.date, cfg, data.days);
    if (it.status !== "skip") {
      lastBal = bal;
      if (bal < minBal) { minBal = bal; minAt = it; }
    }
    return { it, amt, bal };
  });
  const last = items.filter((i) => i.status !== "skip").pop() || null;
  return { rows, lastBal, minBal, minAt: minAt as FlowItem | null, last, low: minAt != null && minBal < LOW_BALANCE };
}
