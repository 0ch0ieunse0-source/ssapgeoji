import { describe, expect, it } from "vitest";
import { loginBanner } from "./nudge";
import type { DaysMap } from "./types";

const it0 = { id: "a", amount: 1000, memo: "", cat: "식비", pay: "check" as const, t: 1 };
const days = (keys: string[]): DaysMap => Object.fromEntries(keys.map((k) => [k, { items: [it0, { ...it0, id: "b" }], limit: null, noSpend: false }]));

describe("홈 맨 위 로그인 배너", () => {
  const today = "2026-11-20";
  it("로그인 안 했으면 기록 개수와 함께 보여요 (기록이 없어도 보여요)", () => {
    expect(loginBanner({ loggedIn: false, days: days(["2026-11-13", "2026-11-19"]), today, snoozedOn: null })).toBe(4);
    expect(loginBanner({ loggedIn: false, days: {}, today, snoozedOn: null })).toBe(0);
  });
  it("로그인했으면 안 보여요", () => {
    expect(loginBanner({ loggedIn: true, days: days(["2026-11-01"]), today, snoozedOn: null })).toBe(-1);
  });
  it("X를 누르면 2주 동안 안 보이고, 그 뒤 다시 보여요", () => {
    const d = days(["2026-11-01"]);
    expect(loginBanner({ loggedIn: false, days: d, today, snoozedOn: "2026-11-10" })).toBe(-1);
    expect(loginBanner({ loggedIn: false, days: d, today, snoozedOn: "2026-11-06" })).toBe(2);
  });
});
