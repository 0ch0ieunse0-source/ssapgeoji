import { describe, expect, it } from "vitest";
import { daysFor, periodOf } from "./period";
import { movedIn, savedDays, savedTotal, waitLeft } from "./savings";
import { item } from "./testUtils";
import type { DaysMap, Wish } from "./types";

const p = periodOf("2026-11-04", 1);
const plan = { total: 0, apptLimit: 0, auto: false, weekday: 10000, weekend: 10000 };
const days = daysFor(p, plan, []);

describe("아낀 돈", () => {
  const m: DaysMap = {
    "2026-11-01": { items: [item(3000)], limit: null, noSpend: false }, // 7,000 아낌
    "2026-11-02": { items: [], limit: 15000, noSpend: true }, // 무지출, 한도 바꿈 → 15,000
    "2026-11-03": { items: [item(12000)], limit: null, noSpend: false }, // 초과 → 0
    "2026-11-04": { items: [item(1000)], limit: null, noSpend: false }, // 오늘은 빼요
    // 11/5 이후는 기록 없음
  };
  it("기록을 남긴 지난날만, 한도보다 덜 쓴 만큼", () => {
    expect(savedDays(m, days, "2026-11-04").map((x) => [x.d.key, x.v])).toEqual([
      ["2026-11-01", 7000],
      ["2026-11-02", 15000],
      ["2026-11-03", 0],
    ]);
    expect(savedTotal(m, days, "2026-11-04")).toBe(22000);
  });
  it("기록 없는 날은 넣지 않아요", () => {
    expect(savedTotal({}, days, "2026-11-20")).toBe(0);
  });
  it("친구 몫은 빼고 내 몫만 봐요", () => {
    const m2: DaysMap = { "2026-11-01": { items: [item(16000, { mine: 4000 })], limit: null, noSpend: false } };
    expect(savedTotal(m2, days, "2026-11-04")).toBe(6000);
  });
});

describe("옮긴 돈", () => {
  it("기간 표시가 없으면 날짜로 기간을 찾아요", () => {
    const moves = [
      { id: "a", date: "2026-11-03", period: "2026-11-01", amount: 5000 },
      { id: "b", date: "2026-11-20", amount: 3000 },
      { id: "c", date: "2026-11-02", period: "2026-10-01", amount: 9999 },
      { id: "d", date: "2026-12-01", amount: 1 },
    ];
    expect(movedIn(moves, p, 1)).toBe(8000);
  });
});

describe("사고 싶은 것 대기 시간", () => {
  const w = (wait: number): Wish => ({ id: "w", name: "니트", price: 1, wait, addedAt: 0, status: "waiting" });
  const H = 3600000;
  it("남은 시간 글자", () => {
    expect(waitLeft(w(24), 0)).toBe("1일 남음");
    expect(waitLeft(w(24), H)).toBe("23시간 남음");
    expect(waitLeft(w(72), H)).toBe("2일 23시간 남음");
    expect(waitLeft(w(72), 1)).toBe("3일 남음");
  });
  it("다 기다렸으면 null", () => {
    expect(waitLeft(w(24), 24 * H)).toBeNull();
  });
});

describe("가격에 맞춘 대기 기간", () => {
  it("5만·30만·100만원 기준", async () => {
    const { waitForPrice, waitLabel } = await import("./savings");
    expect([0, 49999, 50000, 299999, 300000, 999999, 1000000, 5000000].map(waitForPrice)).toEqual([24, 24, 72, 72, 168, 168, 720, 720]);
    expect([24, 72, 168, 336, 720].map(waitLabel)).toEqual(["하루", "3일", "1주", "2주", "1달"]);
  });
  it("1달 대기 남은 시간 글자", () => {
    expect(waitLeft({ id: "w", name: "노트북", price: 1500000, wait: 720, addedAt: 0, status: "waiting" }, 3600000)).toBe("29일 23시간 남음");
  });
});
