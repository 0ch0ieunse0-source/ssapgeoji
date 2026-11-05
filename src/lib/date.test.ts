import { describe, expect, it } from "vitest";
import { addDays, dateFor, dOf, kOf, sd } from "./date";
import { parse, won, short, man } from "./format";

describe("날짜 도구", () => {
  it("kOf / dOf는 서로 되돌려요", () => {
    expect(kOf(dOf("2026-02-28"))).toBe("2026-02-28");
  });
  it("addDays는 달과 해를 넘어가요", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });
  it("dateFor는 없는 날을 그 달 마지막 날로 맞춰요", () => {
    expect(dateFor(2026, 10, 31)).toBe("2026-11-30"); // 11월
    expect(dateFor(2027, 1, 31)).toBe("2027-02-28");
    expect(dateFor(2028, 1, 30)).toBe("2028-02-29");
    expect(dateFor(2026, 12, 5)).toBe("2027-01-05"); // 13번째 달 = 다음 해 1월
    expect(dateFor(2027, -1, 31)).toBe("2026-12-31");
  });
  it("sd는 월/일", () => expect(sd("2026-01-05")).toBe("1/5"));
});

describe("금액 표시", () => {
  it("won", () => {
    expect(won(12345)).toBe("12,345원");
    expect(won(-5000)).toBe("-5,000원");
    expect(won(0)).toBe("0원");
  });
  it("parse는 숫자만 꺼내요", () => {
    expect(parse("12,000원")).toBe(12000);
    expect(parse("")).toBe(0);
  });
  it("short / man", () => {
    expect(short(12500)).toBe("1.3만");
    expect(short(9500)).toBe("9,500");
    expect(man(400000)).toBe("40만");
  });
});

describe("조사", () => {
  it("받침에 맞게 을/를", async () => {
    const { eulReul } = await import("./format");
    expect([eulReul("대구"), eulReul("부산 여행"), eulReul("제주")]).toEqual(["대구를", "부산 여행을", "제주를"]);
  });
});
