import { describe, expect, it } from "vitest";
import { catShares, catsLabel } from "./ledger";
import { item } from "./testUtils";

describe("차수별 분류", () => {
  it("차수 분류가 없으면 기록 분류 하나", () => {
    expect(catShares(item(9000, { cat: "식비" }))).toEqual([{ cat: "식비", v: 9000 }]);
  });
  it("차수마다 내 몫을 나눠 분류해요 (합계는 내 몫)", () => {
    const it2 = item(90000, { cat: "식비", mine: 25000, rounds: [{ amount: 60000, people: 4, cat: "식비", mine: 15000 }, { amount: 30000, people: 3, cat: "카페·간식", mine: 10000 }] });
    expect(catShares(it2)).toEqual([{ cat: "식비", v: 15000 }, { cat: "카페·간식", v: 10000 }]);
    expect(catsLabel(it2)).toBe("식비·카페·간식");
  });
  it("내 몫이 바뀌어도 합계는 내 몫, 끝전은 마지막 차수", () => {
    const it3 = item(90000, { mine: 30001, rounds: [{ amount: 60000, people: 4, cat: "식비", mine: 15000 }, { amount: 30000, people: 3, cat: "약속", mine: 10000 }] });
    const sh = catShares(it3);
    expect(sh.reduce((a, b) => a + b.v, 0)).toBe(30001);
    expect(sh.map((x) => x.v)).toEqual([18001, 12000]);
  });
  it("분류가 3개 넘으면 '외'", () => {
    const r = (cat: string) => ({ amount: 1000, people: 2, cat, mine: 500 });
    expect(catsLabel(item(3000, { mine: 1500, rounds: [r("식비"), r("교통"), r("쇼핑")] }))).toBe("식비·교통 외");
  });
});
