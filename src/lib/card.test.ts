import { describe, expect, it } from "vitest";
import { cardCycle, cardSpend } from "./card";
import { addDays } from "./date";
import { item } from "./testUtils";

describe("cardCycle: 카드 결제 주기", () => {
  it("마감일이 결제일보다 앞이면 같은 달 마감분", () => {
    // 11/25 결제 = 10/13 ~ 11/12 사용분
    expect(cardCycle(2026, 10, 12, 25)).toEqual({ from: "2026-10-13", to: "2026-11-12" });
  });

  it("마감일이 결제일보다 뒤면 지난달 마감분", () => {
    // 11/14 결제, 마감 25일 = 9/26 ~ 10/25 사용분
    expect(cardCycle(2026, 10, 25, 14)).toEqual({ from: "2026-09-26", to: "2026-10-25" });
  });

  it("마감일과 결제일이 같으면 지난달 마감분", () => {
    expect(cardCycle(2026, 10, 15, 15)).toEqual({ from: "2026-09-16", to: "2026-10-15" });
  });

  it("마감일이 뒤인 경우 연초 결제는 지난해 사용분", () => {
    // 2027/1/14 결제 = 2026/11/26 ~ 12/25 사용분
    expect(cardCycle(2027, 0, 25, 14)).toEqual({ from: "2026-11-26", to: "2026-12-25" });
    // 2027/2/14 결제 = 2026/12/26 ~ 2027/1/25
    expect(cardCycle(2027, 1, 25, 14)).toEqual({ from: "2026-12-26", to: "2027-01-25" });
  });

  it("마감일 31일은 짧은 달 마지막 날로 맞춰요", () => {
    // 3/14 결제, 마감 31일 = 2/1 ~ 2/28 사용분
    expect(cardCycle(2027, 2, 31, 14)).toEqual({ from: "2027-02-01", to: "2027-02-28" });
    // 4/14 결제 = 3/1 ~ 3/31
    expect(cardCycle(2027, 3, 31, 14)).toEqual({ from: "2027-03-01", to: "2027-03-31" });
  });

  it("이어지는 달의 결제 주기는 겹치거나 비지 않아요", () => {
    for (const [cut, pay] of [[12, 25], [25, 14], [31, 10], [1, 20], [28, 5]]) {
      for (let m = 0; m < 14; m++) {
        const a = cardCycle(2026, m, cut, pay), b = cardCycle(2026, m + 1, cut, pay);
        expect(b.from).toBe(addDays(a.to, 1));
      }
    }
  });
});

describe("cardSpend", () => {
  it("기간 안 신용카드 결제액만 더해요 (친구 몫 포함)", () => {
    const days = {
      "2026-10-12": { items: [item(9999, { pay: "card" })], limit: null, noSpend: false },
      "2026-10-13": { items: [item(10000, { pay: "card", mine: 5000 }), item(3000)], limit: null, noSpend: false },
      "2026-11-12": { items: [item(2000, { pay: "card" })], limit: null, noSpend: false },
      "2026-11-13": { items: [item(7777, { pay: "card" })], limit: null, noSpend: false },
    };
    expect(cardSpend(days, "2026-10-13", "2026-11-12")).toBe(12000);
  });
});
