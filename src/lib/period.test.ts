import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import { budgetOf, countsFor, daysFor, makePlan, periodOf, preZero, shiftPeriod, splitFor, weeksOf } from "./period";
import { makeCfg } from "./testUtils";

describe("periodOf: 한 달 기간", () => {
  it("1일 시작이면 달력 한 달", () => {
    expect(periodOf("2026-11-05", 1)).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });

  it("10일 시작이면 10일부터 다음 달 9일까지", () => {
    expect(periodOf("2026-11-10", 10)).toEqual({ start: "2026-11-10", end: "2026-12-09" });
    expect(periodOf("2026-11-09", 10)).toEqual({ start: "2026-10-10", end: "2026-11-09" });
  });

  describe("시작일이 31일인데 그 달에 31일이 없을 때", () => {
    it("30일까지인 달은 30일에 시작해요", () => {
      // 11월에는 31일이 없어서 11/30에 시작
      expect(periodOf("2026-11-30", 31)).toEqual({ start: "2026-11-30", end: "2026-12-30" });
      // 11/30 전이면 10/31에 시작한 기간이고, 11/30 전날 끝나요
      expect(periodOf("2026-11-15", 31)).toEqual({ start: "2026-10-31", end: "2026-11-29" });
    });

    it("2월은 마지막 날(28일)에 시작해요", () => {
      expect(periodOf("2027-02-15", 31)).toEqual({ start: "2027-01-31", end: "2027-02-27" });
      expect(periodOf("2027-02-28", 31)).toEqual({ start: "2027-02-28", end: "2027-03-30" });
    });

    it("윤년 2월은 29일에 시작해요", () => {
      expect(periodOf("2028-02-29", 31)).toEqual({ start: "2028-02-29", end: "2028-03-30" });
      expect(periodOf("2028-02-28", 31)).toEqual({ start: "2028-01-31", end: "2028-02-28" });
    });

    it("30일 시작도 2월에는 마지막 날로 맞춰요", () => {
      expect(periodOf("2027-02-28", 30)).toEqual({ start: "2027-02-28", end: "2027-03-29" });
      expect(periodOf("2027-02-27", 30)).toEqual({ start: "2027-01-30", end: "2027-02-27" });
    });
  });

  describe("연말에서 연초로 넘어가는 기간", () => {
    it("12/25 시작 기간은 다음 해 1/24까지", () => {
      expect(periodOf("2026-12-30", 25)).toEqual({ start: "2026-12-25", end: "2027-01-24" });
      expect(periodOf("2027-01-05", 25)).toEqual({ start: "2026-12-25", end: "2027-01-24" });
    });
    it("1일 시작이면 1/1에 새 기간", () => {
      expect(periodOf("2027-01-01", 1)).toEqual({ start: "2027-01-01", end: "2027-01-31" });
      expect(periodOf("2026-12-31", 1)).toEqual({ start: "2026-12-01", end: "2026-12-31" });
    });
    it("31일 시작이면 12/31~1/30", () => {
      expect(periodOf("2027-01-10", 31)).toEqual({ start: "2026-12-31", end: "2027-01-30" });
    });
  });
});

describe("shiftPeriod: 지난달·다음 달", () => {
  it("연말을 넘어 앞뒤로 움직여요", () => {
    const p = periodOf("2026-12-30", 25);
    expect(shiftPeriod(p, 1, 25)).toEqual({ start: "2027-01-25", end: "2027-02-24" });
    expect(shiftPeriod(p, -1, 25)).toEqual({ start: "2026-11-25", end: "2026-12-24" });
    const jan = periodOf("2027-01-15", 1);
    expect(shiftPeriod(jan, -1, 1)).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });

  it("31일 시작으로 2월을 지나가도 빈 날 없이 이어져요", () => {
    const jan = periodOf("2027-01-31", 31);
    const feb = shiftPeriod(jan, 1, 31);
    expect(jan).toEqual({ start: "2027-01-31", end: "2027-02-27" });
    expect(feb).toEqual({ start: "2027-02-28", end: "2027-03-30" });
    expect(shiftPeriod(feb, -1, 31)).toEqual(jan);
  });

  it.each([1, 15, 28, 29, 30, 31])("%i일 시작: 2년 동안 기간이 겹치거나 비지 않아요", (cd) => {
    let p = periodOf("2026-01-15", cd);
    for (let i = 0; i < 24; i++) {
      const next = shiftPeriod(p, 1, cd);
      expect(next.start).toBe(addDays(p.end, 1));
      expect(shiftPeriod(next, -1, cd)).toEqual(p);
      expect(next.end >= next.start).toBe(true);
      p = next;
    }
  });
});

describe("countsFor", () => {
  it("2026년 11월: 평일 21일, 주말 9일", () => {
    expect(countsFor(periodOf("2026-11-05", 1), [])).toEqual({ wd: 21, we: 9, ap: 0, n: 30 });
  });
  it("약속 날은 평일·주말에서 빠지고, 기간 밖 약속은 세지 않아요", () => {
    // 11/6 금요일, 11/7 토요일, 12/1은 기간 밖
    expect(countsFor(periodOf("2026-11-05", 1), ["2026-11-06", "2026-11-07", "2026-12-01"])).toEqual({ wd: 20, we: 8, ap: 2, n: 30 });
  });
});

describe("splitFor: 하루 한도 자동 배분", () => {
  it("95%에서 약속 몫을 빼고 평일 1 : 주말 1.5로 500원 단위", () => {
    // (400000*0.95 - 30000) / (20 + 1.5*9) = 350000 / 33.5 = 10447.7 → 10000
    expect(splitFor(400000, 30000, { wd: 20, we: 9, ap: 1, n: 30 })).toEqual({ weekday: 10000, weekend: 15000 });
    // 600000*0.95 / (22 + 13.5) = 16056.3 → 16000, 주말 24000
    expect(splitFor(600000, 0, { wd: 22, we: 9, ap: 0, n: 31 })).toEqual({ weekday: 16000, weekend: 24000 });
  });
  it("주말은 평일×1.5를 500원 단위로 내려요", () => {
    // 220000*0.95 / (20+15) = 5971 → 5500, 주말 8250 → 8000
    expect(splitFor(220000, 0, { wd: 20, we: 10, ap: 0, n: 30 })).toEqual({ weekday: 5500, weekend: 8000 });
  });
  it("약속 몫이 생활비보다 크면 0원", () => {
    expect(splitFor(100000, 50000, { wd: 20, we: 8, ap: 2, n: 30 })).toEqual({ weekday: 0, weekend: 0 });
  });
  it("모든 날이 약속이어도 0으로 나누지 않아요", () => {
    expect(splitFor(100000, 1000, { wd: 0, we: 0, ap: 3, n: 3 })).toEqual({ weekday: 92000, weekend: 138000 });
  });
});

describe("makePlan / daysFor / weeksOf", () => {
  const p = periodOf("2026-11-05", 1);
  it("자동 배분이면 약속 날을 빼고 나눠요", () => {
    const cfg = makeCfg({ autoLimits: true, total: 400000, apptLimit: 30000, appts: ["2026-11-06"] });
    expect(makePlan(cfg, p)).toEqual({ total: 400000, apptLimit: 30000, auto: true, weekday: 10000, weekend: 15000 });
  });
  it("직접 입력이면 그대로", () => {
    const cfg = makeCfg({ weekday: 12000, weekend: 20000 });
    expect(makePlan(cfg, p)).toMatchObject({ auto: false, weekday: 12000, weekend: 20000 });
  });
  it("약속 날은 약속 한도, 주말은 주말 한도", () => {
    const plan = { total: 1, apptLimit: 30000, auto: false, weekday: 10000, weekend: 15000 };
    const days = daysFor(p, plan, ["2026-11-06"]);
    expect(days).toHaveLength(30);
    expect(days[0]).toMatchObject({ key: "2026-11-01", wd: 0, base: 15000, tag: "주말" });
    expect(days[1]).toMatchObject({ key: "2026-11-02", wd: 1, base: 10000, tag: "" });
    expect(days[5]).toMatchObject({ key: "2026-11-06", base: 30000, tag: "약속" });
  });
  it("주는 월요일마다 새로 시작해요", () => {
    const plan = { total: 1, apptLimit: 0, auto: false, weekday: 1, weekend: 1 };
    const weeks = weeksOf(daysFor(p, plan, []));
    // 11/1(일) 혼자 첫 주, 11/2(월)~11/8, … 11/30(월) 마지막 주
    expect(weeks.map((w) => w.length)).toEqual([1, 7, 7, 7, 7, 1]);
    expect(weeks[1][0].key).toBe("2026-11-02");
  });
});

describe("처음 쓰기 전 날 (0으로 처리를 고른 사람만)", () => {
  const p = periodOf("2026-11-05", 1);
  const plan = { total: 400000, apptLimit: 30000, auto: false, weekday: 10000, weekend: 15000 };
  it("고르지 않으면(그대로) 아무것도 안 바뀌어요", () => {
    expect(preZero(makeCfg({ joinDate: "2026-11-05" }), {})).toBeUndefined();
    expect(preZero(makeCfg({ joinDate: "2026-11-05", preStart: "keep" }), {})).toBeUndefined();
  });
  it("0으로 처리: 이전 날은 한도 0, 그 한도만큼 그 달 생활비에서 빼요 (다른 날 한도는 그대로)", () => {
    const isPre = preZero(makeCfg({ joinDate: "2026-11-05", preStart: "zero" }), {});
    const days = daysFor(p, plan, ["2026-11-03"], undefined, isPre);
    // 11/1(일) 15,000 + 11/2(월) 10,000 + 11/3(약속) 30,000 + 11/4(수) 10,000 = 65,000
    expect(days.filter((d) => d.pre).map((d) => [d.key, d.base, d.preBase])).toEqual([
      ["2026-11-01", 0, 15000], ["2026-11-02", 0, 10000], ["2026-11-03", 0, 30000], ["2026-11-04", 0, 10000],
    ]);
    expect(days.find((d) => d.key === "2026-11-05")).toMatchObject({ base: 10000 });
    expect(budgetOf(plan, days)).toBe(335000);
  });
  it("기록·무지출·한도를 직접 넣은 날은 건드리지 않아요", () => {
    const m = {
      "2026-11-02": { items: [], limit: null, noSpend: true },
      "2026-11-03": { items: [], limit: 5000, noSpend: false },
      "2026-11-04": { items: [{ id: "a", amount: 1000, memo: "", cat: "식비", pay: "check" as const, t: 0 }], limit: null, noSpend: false },
    };
    const days = daysFor(p, plan, [], undefined, preZero(makeCfg({ joinDate: "2026-11-05", preStart: "zero" }), m));
    expect(days.filter((d) => d.pre).map((d) => d.key)).toEqual(["2026-11-01"]);
    expect(budgetOf(plan, days)).toBe(385000);
  });
  it("자동 배분 날 수는 그대로 (한 달 전체로 나눠요)", () => {
    expect(countsFor(p, [])).toEqual({ wd: 21, we: 9, ap: 0, n: 30 });
  });
});
