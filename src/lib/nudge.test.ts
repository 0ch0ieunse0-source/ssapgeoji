import { describe, expect, it } from "vitest";
import { shouldNudge } from "./nudge";
import type { DaysMap } from "./types";

const it0 = { id: "a", amount: 1000, memo: "", cat: "식비", pay: "check" as const, t: 1 };
const days = (keys: string[]): DaysMap => Object.fromEntries(keys.map((k) => [k, { items: [it0, { ...it0, id: "b" }], limit: null, noSpend: false }]));

describe("계정 보관 권유 카드", () => {
  const today = "2026-11-20";
  it("첫 기록 뒤 7일이 지나면 기록 개수와 함께 보여요", () => {
    expect(shouldNudge({ loggedIn: false, days: days(["2026-11-13", "2026-11-19"]), today, snoozedOn: null })).toBe(4);
  });
  it("쓴 지 7일이 안 됐으면 안 보여요", () => {
    expect(shouldNudge({ loggedIn: false, days: days(["2026-11-14"]), today, snoozedOn: null })).toBe(0);
  });
  it("로그인했거나 기록이 없으면 안 보여요", () => {
    expect(shouldNudge({ loggedIn: true, days: days(["2026-11-01"]), today, snoozedOn: null })).toBe(0);
    expect(shouldNudge({ loggedIn: false, days: { "2026-11-01": { items: [], limit: null, noSpend: true } }, today, snoozedOn: null })).toBe(0);
  });
  it("'다음에'를 누르면 2주 동안 안 보이고, 그 뒤 다시 보여요", () => {
    const d = days(["2026-11-01"]);
    expect(shouldNudge({ loggedIn: false, days: d, today, snoozedOn: "2026-11-10" })).toBe(0);
    expect(shouldNudge({ loggedIn: false, days: d, today, snoozedOn: "2026-11-06" })).toBe(2);
  });
});
