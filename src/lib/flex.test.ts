import { describe, expect, it } from "vitest";
import { applyFlex, leftoverOf, pastDiff, spreadPool } from "./flex";
import { limitOf } from "./ledger";
import { daysFor, periodOf } from "./period";
import { item } from "./testUtils";
import type { DaysMap } from "./types";

// 2026-11: 1일(일)~30일(월). 평일 1만원, 주말 1.5만원, 생활비 40만원
const p = periodOf("2026-11-04", 1);
const plan = { total: 400000, apptLimit: 0, auto: false, weekday: 10000, weekend: 15000 };
const plain = daysFor(p, plan, []);
const sum = (ds: typeof plain, m: DaysMap) => ds.reduce((s, d) => s + limitOf(m, d), 0);

describe("남은 돈 설정", () => {
  it("없으면 예비비에 모으기", () => {
    expect(leftoverOf(undefined)).toBe("reserve");
    expect(leftoverOf({})).toBe("reserve");
    expect(leftoverOf({ leftover: "spread" })).toBe("spread");
  });
});

describe("지난날 덜 쓴 돈·더 쓴 돈", () => {
  const m: DaysMap = {
    "2026-11-02": { items: [item(1000)], limit: null, noSpend: false }, // 월 1만 → +9,000
    "2026-11-03": { items: [item(13000)], limit: null, noSpend: false }, // 화 1만 → −3,000
    "2026-11-04": { items: [item(5000)], limit: null, noSpend: false }, // 오늘은 빼요
  };
  it("기록한 지난날만, 더 쓴 날은 빼요", () => {
    expect(pastDiff(m, plain, "2026-11-04")).toBe(6000);
  });
  it("무지출로 표시한 날은 한도 전부, 기록 없는 날은 넣지 않아요", () => {
    const m2: DaysMap = { "2026-11-01": { items: [], limit: null, noSpend: true } };
    expect(pastDiff(m2, plain, "2026-11-04")).toBe(15000);
    expect(pastDiff({}, plain, "2026-11-20")).toBe(0);
  });
});

describe("남은 날에 나눠 쓰기", () => {
  it("평일 1만원 중 1천원만 쓰면 9천원이 남은 날에 나뉘어 한도가 늘어요", () => {
    const m: DaysMap = { "2026-11-02": { items: [item(1000)], limit: null, noSpend: false } };
    const { days, info } = applyFlex(plain, m, "2026-11-03", { mode: "spread", budget: 400000, moved: 0, isCur: true });
    expect(info.diff).toBe(9000);
    const tue = days.find((d) => d.key === "2026-11-03")!;
    const sat = days.find((d) => d.key === "2026-11-07")!;
    expect(tue.base).toBeGreaterThan(10000);
    expect(sat.flex!).toBeGreaterThan(tue.flex!); // 주말은 한도가 커서 더 받아요
    // 지난날은 그대로
    expect(days.find((d) => d.key === "2026-11-02")!.base).toBe(10000);
    // 나눠 준 돈 + 예비비 = 원래 예비비 + 9천원 (돈이 새거나 생기지 않아요)
    expect(info.given).toBeLessThanOrEqual(9000);
    expect(info.given + info.reserve).toBe(info.base + 9000);
    expect(sum(days, m) - sum(plain, m)).toBe(info.given);
  });
  it("더 쓰면 남은 날 한도가 줄고, 0 밑으로는 안 가요", () => {
    const m: DaysMap = { "2026-11-02": { items: [item(1000000)], limit: null, noSpend: false } };
    const { days, info } = applyFlex(plain, m, "2026-11-03", { mode: "spread", budget: 400000, moved: 0, isCur: true });
    days.filter((d) => d.key >= "2026-11-03").forEach((d) => expect(d.base).toBe(0));
    expect(info.reserve).toBeLessThan(0);
  });
  it("한도를 직접 바꾼 날·여행 날은 나눠 받지 않아요", () => {
    const m: DaysMap = {
      "2026-11-02": { items: [], limit: null, noSpend: true },
      "2026-11-05": { items: [], limit: 20000, noSpend: false },
    };
    const trips = [{ id: "t", name: "제주", start: "2026-11-10", end: "2026-11-12", budget: 90000, fund: "living" as const }];
    const ds = daysFor(p, plan, [], trips);
    const sp = spreadPool(ds, m, "2026-11-03", 10000);
    expect(sp.days.find((d) => d.key === "2026-11-05")!.flex).toBeUndefined();
    expect(sp.days.find((d) => d.key === "2026-11-11")!.flex).toBeUndefined();
    expect(sp.n).toBe(28 - 1 - 3);
  });
  it("저축통장으로 옮긴 돈만큼 덜 나눠요", () => {
    const m: DaysMap = { "2026-11-02": { items: [], limit: null, noSpend: true } };
    const a = applyFlex(plain, m, "2026-11-03", { mode: "spread", budget: 400000, moved: 0, isCur: true }).info;
    const b = applyFlex(plain, m, "2026-11-03", { mode: "spread", budget: 400000, moved: 10000, isCur: true }).info;
    expect(b.given).toBe(0);
    expect(a.given).toBeGreaterThan(0);
  });
  it("지난달·다음 달은 원래 한도", () => {
    const m: DaysMap = { "2026-11-02": { items: [item(1000)], limit: null, noSpend: false } };
    const { days } = applyFlex(plain, m, "2026-11-03", { mode: "spread", budget: 400000, moved: 0, isCur: false });
    expect(days).toBe(plain);
  });
});

describe("예비비에 모으기", () => {
  it("한도는 그대로, 덜 쓴 돈은 예비비에 더하고 더 쓴 돈·옮긴 돈은 빼요", () => {
    const m: DaysMap = {
      "2026-11-02": { items: [item(1000)], limit: null, noSpend: false },
      "2026-11-03": { items: [item(12000)], limit: null, noSpend: false },
    };
    const { days, info } = applyFlex(plain, m, "2026-11-04", { mode: "reserve", budget: 400000, moved: 3000, isCur: true });
    expect(days).toBe(plain);
    expect(info.base).toBe(400000 - sum(plain, m));
    expect(info.reserve).toBe(info.base + 9000 - 2000 - 3000);
  });
});
