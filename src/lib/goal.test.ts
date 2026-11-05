import { describe, expect, it } from "vitest";
import { dOf } from "./date";
import { computeGoal } from "./goal";
import { makeCfg } from "./testUtils";

const cfg = (over = {}) => makeCfg({ goalAmt: 10000000, goalDate: "2027-11-05", balance: 2000000, firstStart: "2026-11-01", ...over });
const snap = (date: string, cash: number, cy = 0, etf = 0) => ({ id: date, date, cash, cy, etf });

describe("목표 계산", () => {
  it("첫 기록 날에는 목표 경로와 차이가 0", () => {
    const g = computeGoal(cfg(), [snap("2026-11-05", 600000, 300000, 100000)], dOf("2026-11-05"), "2026-11-01");
    expect(g.current).toBe(1000000);
    expect(g.progress).toBe(10);
    expect(g.remain).toBe(9000000);
    expect(g.pace).toBe(1000000);
    expect(g.gap).toBe(0);
    expect(g.byPayday).toBe(false);
    expect(g.monthsLeft).toBe(12);
    expect(g.monthly).toBe(750000);
  });

  it("목표 경로는 첫 기록에서 목표 날짜까지 직선", () => {
    const snaps = [snap("2027-05-05", 5000000), snap("2026-11-05", 1000000)]; // 순서가 섞여 있어도 돼요
    const g = computeGoal(cfg(), snaps, dOf("2027-05-05"), "2026-11-01");
    const frac = 181 / 365;
    expect(g.latest?.date).toBe("2027-05-05");
    expect(g.pace).toBeCloseTo(1000000 + 9000000 * frac, 3);
    expect(g.gap).toBeCloseTo(5000000 - (1000000 + 9000000 * frac), 3);
    expect(g.monthsLeft).toBe(6);
    expect(g.monthly).toBeCloseTo(5000000 / 6, 3);
  });

  it("기록이 없으면 통장 잔액과 처음 시작한 날로 계산", () => {
    const g = computeGoal(cfg(), [], dOf("2026-11-01"), "2026-11-01");
    expect(g.current).toBe(2000000);
    expect(g.startVal).toBe(2000000);
    expect(g.t0).toBe(dOf("2026-11-01").getTime());
    expect(g.gap).toBe(0);
  });

  it("월급날이 있으면 남은 월급날 수로 나눠요", () => {
    const now = dOf("2026-11-05"), s = [snap("2026-11-05", 1000000)];
    expect(computeGoal(cfg({ payday: 25 }), s, now, "2026-11-01").monthsLeft).toBe(12);
    expect(computeGoal(cfg({ payday: 1 }), s, now, "2026-11-01").monthsLeft).toBe(12); // 11/1은 지났어요
    expect(computeGoal(cfg({ payday: 5 }), s, now, "2026-11-01").monthsLeft).toBe(13); // 오늘 포함
    expect(computeGoal(cfg({ payday: 25 }), s, now, "2026-11-01").byPayday).toBe(true);
  });

  it("목표를 넘으면 남은 금액이 음수, 한 달에 모을 돈은 0", () => {
    const g = computeGoal(cfg(), [snap("2027-01-01", 12000000)], dOf("2027-01-01"), "2026-11-01");
    expect(g.remain).toBe(-2000000);
    expect(g.monthly).toBe(0);
    expect(g.progress).toBe(100);
  });

  it("목표 날짜가 지나면 목표 경로는 목표 금액", () => {
    const g = computeGoal(cfg(), [snap("2026-11-05", 1000000)], dOf("2028-01-01"), "2026-11-01");
    expect(g.pace).toBe(10000000);
    expect(g.monthsLeft).toBe(0);
    expect(g.monthly).toBe(9000000);
  });
});
