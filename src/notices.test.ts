import { describe, expect, it } from "vitest";
import { NOTICES, unreadCount, type Notice } from "./notices";

const L: Notice[] = ["c", "b", "a"].map((id) => ({ id, date: "2026-11-05", title: id, body: [] }));

describe("공지사항", () => {
  it("안 읽은 공지 수", () => {
    expect(unreadCount(L, null)).toBe(3);
    expect(unreadCount(L, "a")).toBe(2);
    expect(unreadCount(L, "c")).toBe(0);
    expect(unreadCount(L, "지워진-id")).toBe(3);
  });
  it("공지 id는 겹치지 않고 최신이 맨 위", () => {
    expect(new Set(NOTICES.map((n) => n.id)).size).toBe(NOTICES.length);
    const dates = NOTICES.map((n) => n.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
