import { describe, expect, it } from "vitest";
import { bankruptLoss, nextTier, tierOf } from "./space";

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
