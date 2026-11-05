import { describe, expect, it } from "vitest";
import { reloadUrl, shouldNotifyUpdate } from "./update";

describe("새 버전 알림", () => {
  it("버전이 다를 때만", () => {
    expect(shouldNotifyUpdate("b", "a", null)).toBe(true);
    expect(shouldNotifyUpdate("a", "a", null)).toBe(false);
    expect(shouldNotifyUpdate(null, "a", null)).toBe(false);
  });
  it("'그대로 사용'을 누른 버전은 다시 안 알려요 (더 새 버전은 알려요)", () => {
    expect(shouldNotifyUpdate("b", "a", "b")).toBe(false);
    expect(shouldNotifyUpdate("c", "a", "b")).toBe(true);
  });
  it("새로고침 주소는 화면 위치(#)를 유지해요", () => {
    expect(reloadUrl("/ssapgeoji/", "#ledger", "2026-11-05T13:00:00.000Z")).toBe("/ssapgeoji/?v=2026-11-05T13%3A00%3A00.000Z#ledger");
  });
});
