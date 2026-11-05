import { describe, expect, it } from "vitest";
import { NOTICES, unreadIds, type Notice } from "./notices";

const L: Notice[] = ["c", "b", "a"].map((id) => ({ id, date: "2026-11-05", title: id, body: [] }));

describe("공지사항", () => {
  it("하나씩 열어 본 공지만 읽음", () => {
    expect(unreadIds(L, [], null)).toEqual(["c", "b", "a"]);
    expect(unreadIds(L, ["b"], null)).toEqual(["c", "a"]);
    expect(unreadIds(L, ["a", "b", "c"], null)).toEqual([]);
    expect(unreadIds([], [], null)).toEqual([]);
  });
  it("예전 방식으로 본 공지와 그보다 오래된 공지는 읽음", () => {
    expect(unreadIds(L, [], "b")).toEqual(["c"]);
    expect(unreadIds(L, ["c"], "b")).toEqual([]);
    expect(unreadIds(L, [], "지워진-id")).toEqual(["c", "b", "a"]);
  });
  it("공지 id는 겹치지 않고 최신이 맨 위", () => {
    expect(new Set(NOTICES.map((n) => n.id)).size).toBe(NOTICES.length);
    const dates = NOTICES.map((n) => n.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
