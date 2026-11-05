import { describe, expect, it } from "vitest";
import { EMPTY, normalize } from "./storage";

describe("normalize: 저장 데이터·백업 파일 맞추기", () => {
  it("이상한 값이면 빈 데이터", () => {
    expect(normalize(null, "2026-11-05")).toEqual(EMPTY());
    expect(normalize("hello", "2026-11-05")).toEqual(EMPTY());
  });
  it("예전 버전(기간 1회) 설정을 매달 반복으로 옮겨요", () => {
    const s = normalize({ settings: { start: "2026-03-10", end: "2026-04-09", total: 1, weekday: 10000, balance: 500000 } }, "2026-11-05").settings!;
    expect(s.cycleDay).toBe(10);
    expect(s.autoLimits).toBe(false);
    expect(s.balanceDate).toBe("2026-03-10");
    expect(s.firstStart).toBe("2026-03-10");
    expect("start" in s).toBe(false);
    expect("end" in s).toBe(false);
  });
  it("평일 한도가 없으면 자동 배분, 잔액 날짜가 없으면 오늘", () => {
    const s = normalize({ settings: { cycleDay: 25, total: 1, balance: 0 } }, "2026-11-05").settings!;
    expect(s.autoLimits).toBe(true);
    expect(s.balanceDate).toBe("2026-11-05");
    expect(s.firstStart).toBeNull();
  });
  it("모양이 틀린 부분은 빈 값으로", () => {
    const d = normalize({ settings: { cycleDay: 1 }, flows: { custom: "x" }, goal: { snaps: 1 }, wish: {}, savings: { moves: [{ id: "a" }] } }, "2026-11-05");
    expect(d.flows).toEqual({ over: {}, custom: [] });
    expect(d.goal).toEqual({ snaps: [] });
    expect(d.wish).toEqual({ items: [] });
    expect(d.savings.moves).toHaveLength(1);
  });
});
