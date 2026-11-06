import { describe, expect, it } from "vitest";
import { bankruptLoss, buildPublicWish, nextTier, PUBLIC_WISH_MAX, tierOf } from "./space";

describe("스페이스 방 단계", () => {
  it("동전 수로 단계가 정해져요", () => {
    expect([0, 9, 10, 29, 30, 69, 70, 149, 150, 999].map(tierOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
  it("다음 단계까지 남은 동전", () => {
    expect(nextTier(0)).toEqual({ left: 10, ratio: 0, name: "골판지 하우스" });
    expect(nextTier(20)).toEqual({ left: 10, ratio: 0.5, name: "반지하 단칸방" });
    expect(nextTier(150)).toBeNull();
  });
  it("파산하면 30%를 잃고, 동전이 있으면 최소 1개", () => {
    expect(bankruptLoss(0)).toBe(0);
    expect(bankruptLoss(1)).toBe(1);
    expect(bankruptLoss(10)).toBe(3);
    expect(bankruptLoss(151)).toBe(46);
  });
});

describe("친구에게 보여줄 갖고 싶은 물건", () => {
  const t0 = new Date("2026-11-06T10:00:00+09:00").getTime();
  const items = [
    { id: "a", name: "에어팟 프로", price: 359000, wait: 72, addedAt: t0, status: "waiting" },
    { id: "b", name: "운동화", price: 129000, wait: 24, addedAt: t0, status: "waiting" },
    { id: "c", name: "키보드", price: 89000, wait: 24, addedAt: t0 - 5 * 864e5, status: "skipped", decidedAt: t0 - 864e5 },
  ];
  it("이름·끝나는 날·상태만 보내고 가격은 절대 안 보내요", () => {
    const out = buildPublicWish(items);
    expect(out).toEqual([
      { n: "운동화", d: "2026-11-07", s: "wait" },
      { n: "에어팟 프로", d: "2026-11-09", s: "wait" },
      { n: "키보드", d: "2026-11-02", s: "skip" },
    ]);
    const raw = JSON.stringify(out);
    for (const p of ["359000", "129000", "89000", "price", "id"]) expect(raw).not.toContain(p);
  });
  it("최대 10개, 이름은 30자까지", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ name: "가".repeat(40), price: 1, wait: 24, addedAt: t0 + i, status: "waiting" }));
    const out = buildPublicWish(many);
    expect(out.length).toBe(PUBLIC_WISH_MAX);
    expect(out[0].n.length).toBe(30);
  });
});
