import { describe, expect, it } from "vitest";
import { countsFor, daysFor, makePlan, periodOf, splitFor } from "./period";
import { scoreFor } from "./rank";
import { savedDays } from "./savings";
import { dataWith, item, makeCfg } from "./testUtils";
import { livingMap, tripAlloc, tripLength, tripOn, tripsOverlap, tripSpent, type Trip } from "./trip";

const busan: Trip = { id: "t1", name: "부산 여행", start: "2026-11-20", end: "2026-11-23", budget: 300001, fund: "living" };
const jeju: Trip = { ...busan, id: "t2", name: "제주", start: "2026-11-10", end: "2026-11-11", budget: 200000, fund: "separate" };
const nov = periodOf("2026-11-05", 1);

describe("여행 기본", () => {
  it("기간과 날짜 찾기", () => {
    expect(tripLength(busan)).toBe(4);
    expect(tripOn([busan], "2026-11-22")?.id).toBe("t1");
    expect(tripOn([busan], "2026-11-24")).toBeUndefined();
  });
  it("생활비 몫은 예산을 나눠도 합계가 정확히 예산", () => {
    const parts = ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"].map((k) => tripAlloc(busan, k));
    expect(parts.reduce((a, b) => a + b, 0)).toBe(300001);
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
    expect(tripAlloc(jeju, "2026-11-10")).toBe(0); // 따로 모아 둔 돈
  });
  it("겹치는 여행 확인", () => {
    expect(tripsOverlap([busan], "2026-11-23", "2026-11-25")).toBe(true);
    expect(tripsOverlap([busan], "2026-11-24", "2026-11-25")).toBe(false);
    expect(tripsOverlap([busan], "2026-11-20", "2026-11-21", "t1")).toBe(false);
  });
});

describe("하루 한도 배분", () => {
  it("생활비 안 여행은 날 수에서 빠지고 예산만큼 덜 나눠요", () => {
    const c = countsFor(nov, [], [busan]);
    // 11월: 평일 21, 주말 9 → 여행 11/20(금)~23(월): 평일 2, 주말 2 빠짐
    expect(c).toEqual({ wd: 19, we: 7, ap: 0, n: 30, td: 4, trip: 300001 });
    // (400000*0.95 - 300001) / (19 + 10.5) = 2711 → 2500
    expect(splitFor(400000, 0, c)).toEqual({ weekday: 2500, weekend: 3500 });
  });
  it("따로 모아 둔 돈 여행은 다른 날 한도가 그대로", () => {
    expect(countsFor(nov, [], [jeju])).toEqual(countsFor(nov, [], []));
    const cfg = makeCfg({ autoLimits: true, total: 400000, trips: [jeju] });
    expect(makePlan(cfg, nov)).toEqual(makePlan(makeCfg({ autoLimits: true, total: 400000 }), nov));
  });
  it("여행 날은 '여행'으로, 약속보다 여행이 먼저", () => {
    const plan = { total: 1, apptLimit: 30000, auto: false, weekday: 10000, weekend: 15000 };
    const days = daysFor(nov, plan, ["2026-11-21", "2026-11-05"], [busan, jeju]);
    const at = (k: string) => days.find((d) => d.key === k)!;
    expect(at("2026-11-21")).toMatchObject({ tag: "여행", trip: { id: "t1" } });
    expect(at("2026-11-10")).toMatchObject({ tag: "여행", base: 0 });
    expect(at("2026-11-05")).toMatchObject({ tag: "약속", base: 30000 });
    expect(at("2026-11-12")).toMatchObject({ tag: "", base: 10000 });
  });
  it("여행이 두 달에 걸치면 각 달에 든 날 수만큼", () => {
    const t: Trip = { ...busan, start: "2026-11-29", end: "2026-12-02", budget: 400000 };
    expect(countsFor(nov, [], [t]).trip).toBe(200000);
    expect(countsFor(periodOf("2026-12-05", 1), [], [t]).trip).toBe(200000);
  });
});

describe("생활비 계산용 기록", () => {
  const days = {
    "2026-11-10": { items: [item(50000)], limit: null, noSpend: false }, // 제주(따로)
    "2026-11-12": { items: [item(9000)], limit: null, noSpend: false },
  };
  it("따로 모아 둔 돈 여행 날의 지출은 빼요", () => {
    const L = livingMap(days, [jeju]);
    expect(L["2026-11-10"].items).toEqual([]);
    expect(L["2026-11-12"].items).toHaveLength(1);
    expect(livingMap(days, [busan])).toBe(days); // 따로 모은 여행이 없으면 그대로
  });
  it("여행에서 쓴 돈은 여행 전체를 더해요", () => {
    expect(tripSpent(days, jeju)).toBe(50000);
  });
});

describe("아낀 돈과 랭킹", () => {
  const plan = { total: 1, apptLimit: 0, auto: false, weekday: 10000, weekend: 10000 };
  const m = {
    "2026-11-20": { items: [item(100000)], limit: null, noSpend: false },
    "2026-11-22": { items: [item(150000)], limit: null, noSpend: false },
    "2026-11-19": { items: [item(4000)], limit: null, noSpend: false },
  };
  it("생활비 여행은 끝난 다음 (예산 − 쓴 돈)을 끝난 날에 한 번", () => {
    const d = daysFor(nov, plan, [], [busan]);
    expect(savedDays(m, d, "2026-11-23").map((x) => [x.d.key, x.v])).toEqual([["2026-11-19", 6000]]); // 아직 안 끝남
    expect(savedDays(m, d, "2026-11-24").map((x) => [x.d.key, x.v, x.trip?.id])).toEqual([["2026-11-19", 6000, undefined], ["2026-11-23", 50001, "t1"]]);
  });
  it("랭킹: 여행 예산 안이면 여행 날 모두 지킴", () => {
    const cfg = makeCfg({ weekday: 10000, weekend: 10000, trips: [busan] });
    const season = { start: "2026-11-16", end: "2026-11-29" };
    expect(scoreFor(dataWith({ days: m }), cfg, season).pct).toBe(100);
    const over = { ...m, "2026-11-23": { items: [item(60000)], limit: null, noSpend: false } }; // 합계 310,000 > 300,001
    // 기록한 날 4일(19, 20, 22, 23) 중 여행 날 3일은 모두 못 지킴
    expect(scoreFor(dataWith({ days: over }), cfg, season).pct).toBe(25);
  });
});
