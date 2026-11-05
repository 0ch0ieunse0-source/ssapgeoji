import { describe, expect, it } from "vitest";
import { computeFlow, flowItems, horizonEnd, months } from "./flow";
import { daysFor, periodOf, planFor } from "./period";
import { dataWith, item, makeCfg } from "./testUtils";
import type { Data, Settings } from "./types";

// 2026-11-10(화) 기준, 1일 시작, 하루 한도 모두 10,000원
const TODAY = "2026-11-10";
const baseCfg = (over: Partial<Settings> = {}) =>
  makeCfg({
    balance: 1000000,
    balanceDate: TODAY,
    payday: 25,
    salary: 2000000,
    fixed: [{ id: "rent", name: "월세", day: 15, amount: 500000 }],
    ...over,
  });

function run(data: Data, cfg: Settings, today = TODAY) {
  const cur = periodOf(today, cfg.cycleDay);
  const curDays = daysFor(cur, planFor(data.periods, cfg, cur), cfg.appts);
  return computeFlow(data, cfg, cur, curDays, today);
}
const rowsOf = (r: ReturnType<typeof run>) => r.rows.map((x) => [x.it.date, x.it.label, x.amt, x.bal]);

describe("horizonEnd / months", () => {
  const cur = periodOf(TODAY, 1);
  it("월급이 있으면 이번 달이 끝난 뒤 첫 월급날까지", () => {
    expect(horizonEnd(baseCfg(), cur)).toBe("2026-12-25");
    expect(horizonEnd(baseCfg({ payday: 31 }), cur)).toBe("2026-12-31");
  });
  it("월급이 없으면 기간 끝 + 7일", () => {
    expect(horizonEnd(baseCfg({ payday: null }), cur)).toBe("2026-12-07");
  });
  it("연말 기간이면 다음 해 1월 월급날까지", () => {
    expect(horizonEnd(baseCfg(), periodOf("2026-12-10", 1))).toBe("2027-01-25");
    expect(months("2026-12-11", "2027-01-25")).toEqual([[2026, 11], [2027, 0]]);
  });
});

describe("flowItems", () => {
  it("잔액을 맞춘 다음 날부터, 같은 날이면 들어오는 돈 먼저", () => {
    const cfg = baseCfg({ cardPay: 25, cardCut: 12 });
    const data = dataWith({
      flows: {
        over: {},
        custom: [
          { id: "c1", date: "2026-11-10", label: "오늘 일정", type: "out", amount: 1, status: "plan" },
          { id: "c2", date: "2026-12-30", label: "선물", type: "out", amount: 50000, status: "plan" },
        ],
      },
    });
    const items = flowItems(data, cfg, periodOf(TODAY, 1), false);
    expect(items.map((i) => i.id)).toEqual([
      "fx-rent-2026-11-15", "pay-2026-11-25", "card-2026-11-25",
      "fx-rent-2026-12-15", "pay-2026-12-25", "card-2026-12-25", "c2",
    ]);
    expect(items[2].cycle).toEqual({ from: "2026-10-13", to: "2026-11-12" });
  });
  it("includeAll이면 이번 달 처음부터", () => {
    const items = flowItems(dataWith(), baseCfg({ fixed: [{ id: "a", name: "통신비", day: 3, amount: 1 }] }), periodOf(TODAY, 1), true);
    expect(items[0].id).toBe("fx-a-2026-11-03");
  });
});

describe("computeFlow: 날짜별 예상 잔액", () => {
  it("기본: 남은 날 한도만큼 미리 빼요", () => {
    const r = run(dataWith(), baseCfg());
    expect(rowsOf(r)).toEqual([
      // 1,000,000 - 500,000 - (11/10~15 6일 × 10,000)
      ["2026-11-15", "월세", -500000, 440000],
      // + 2,000,000 - (11/10~25 16일 × 10,000)
      ["2026-11-25", "월급", 2000000, 2340000],
      // 다음 달 생활비는 계산에 없어요: 이번 달 남은 21일분만 빼요
      ["2026-12-15", "월세", -500000, 1790000],
      ["2026-12-25", "월급", 2000000, 3790000],
    ]);
    expect(r.lastBal).toBe(3790000);
    expect(r.minBal).toBe(440000);
    expect(r.minAt?.label).toBe("월세");
    expect(r.low).toBe(false);
    expect(r.last?.id).toBe("pay-2026-12-25");
  });

  it("카드값, 한도 초과, 받은 돈, 직접 넣은 카드 금액까지", () => {
    const cfg = baseCfg({ cardPay: 25, cardCut: 12 });
    const data = dataWith({
      days: {
        "2026-11-03": { items: [item(20000, { mine: 5000, received: true, receivedOn: "2026-11-12" })], limit: null, noSpend: false },
        "2026-11-05": { items: [item(30000, { pay: "card" })], limit: null, noSpend: false },
        "2026-11-10": { items: [item(15000)], limit: null, noSpend: false }, // 한도보다 5,000원 더 씀
      },
      flows: { over: { "card-2026-11-25": { amount: 100000 } }, custom: [] },
    });
    expect(rowsOf(run(data, cfg))).toEqual([
      // 1,000,000 - 500,000 - (15,000 + 5일×10,000) + 받은 돈 15,000
      ["2026-11-15", "월세", -500000, 450000],
      ["2026-11-25", "월급", 2000000, 2350000],
      // 카드값 = 칸에 넣은 100,000 + 10/13~11/12 신용카드 생활비 30,000
      ["2026-11-25", "카드값", -130000, 2220000],
      ["2026-12-15", "월세", -500000, 1670000],
      ["2026-12-25", "월급", 2000000, 3670000],
      ["2026-12-25", "카드값", -0, 3670000],
    ]);
  });

  it("무지출로 표시한 남은 날은 빼지 않아요", () => {
    const data = dataWith({ days: { "2026-11-12": { items: [], limit: null, noSpend: true } } });
    expect(run(data, baseCfg()).rows[0].bal).toBe(450000);
  });

  it("잔액을 맞춘 날이 지났으면 그 뒤 체크카드 사용액을 빼요", () => {
    const cfg = baseCfg({ balanceDate: "2026-11-05", payday: null, salary: null });
    const data = dataWith({
      days: {
        "2026-11-05": { items: [item(99999)], limit: null, noSpend: false }, // 맞춘 날 당일은 이미 반영
        "2026-11-07": { items: [item(8000), item(5000, { pay: "card" })], limit: null, noSpend: false },
      },
    });
    // 1,000,000 - 500,000 - 8,000 - (11/10~15 6일 × 10,000)
    expect(rowsOf(run(data, cfg))).toEqual([["2026-11-15", "월세", -500000, 432000]]);
  });

  it("제외한 일정은 잔액에 넣지 않아요", () => {
    const data = dataWith({ flows: { over: { "fx-rent-2026-11-15": { status: "skip" } }, custom: [] } });
    const r = run(data, baseCfg());
    expect(r.rows[0].it.status).toBe("skip");
    expect(rowsOf(r).map((x) => x[3])).toEqual([940000, 2840000, 2340000 - 50000, 4290000]);
    expect(r.minAt?.id).toBe("fx-rent-2026-12-15");
  });

  it("30만 원 아래로 내려가면 잔액 부족 경고", () => {
    const r = run(dataWith(), baseCfg({ balance: 400000 }));
    expect(r.minBal).toBe(-160000);
    expect(r.minAt?.id).toBe("fx-rent-2026-11-15");
    expect(r.low).toBe(true);
  });
});
