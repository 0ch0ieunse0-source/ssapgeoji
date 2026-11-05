import { describe, expect, it } from "vitest";
import { checkPost, normalizePosts, timeAgo } from "./board";

describe("기능 제안 게시판", () => {
  it("서버 값 정리: 이상한 값은 버리고 최신순", () => {
    expect(normalizePosts(null)).toEqual([]);
    expect(normalizePosts({ posts: "x" })).toEqual([]);
    expect(
      normalizePosts({ posts: [{ t: 1, name: "", text: "옛날" }, null, { t: 3, name: "가".repeat(20), text: "새거" }, { t: 2, text: "  " }] }),
    ).toEqual([
      { t: 3, name: "가".repeat(12), text: "새거" },
      { t: 1, name: "익명", text: "옛날" },
    ]);
  });
  it("올리기 전 확인", () => {
    expect(checkPost("  ", null, 0)).toBe("제안 내용을 적어주세요.");
    expect(checkPost("가".repeat(301), null, 0)).toBe("300자까지 쓸 수 있어요.");
    expect(checkPost("좋아요", 1000, 20000)).toBe("조금 뒤에 다시 올려주세요.");
    expect(checkPost("좋아요", 1000, 31000)).toBeNull();
    expect(checkPost("좋아요", null, 0)).toBeNull();
  });
  it("시간 표시", () => {
    const now = new Date(2026, 10, 5, 12, 0).getTime();
    expect(timeAgo(now - 10000, now)).toBe("방금");
    expect(timeAgo(now - 5 * 60000, now)).toBe("5분 전");
    expect(timeAgo(now - 3 * 3600000, now)).toBe("3시간 전");
    expect(timeAgo(new Date(2026, 10, 1, 9).getTime(), now)).toBe("11월 1일");
  });
});
