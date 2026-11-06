import { describe, expect, it } from "vitest";
import { homeOrder, homeVisible, moveItem } from "./home";

describe("홈 카드 순서", () => {
  it("저장한 게 없으면 기본 순서", () => {
    expect(homeOrder(undefined)).toEqual(["stats", "today", "rank", "report", "card", "owe"]);
  });
  it("저장한 순서를 따르고, 모르는 이름·중복은 빼요", () => {
    expect(homeOrder(["owe", "today", "x", "today", "stats", "rank", "report", "card"])).toEqual(["owe", "today", "stats", "rank", "report", "card"]);
  });
  it("새로 생긴 카드는 기본 순서의 앞 카드 바로 뒤에 들어가요", () => {
    expect(homeOrder(["report", "today", "stats"])).toEqual(["report", "card", "owe", "today", "rank", "stats"]);
  });
  it("숨긴 카드는 빼고 보여줘요", () => {
    expect(homeVisible(["owe", "stats"], ["rank", "card"])).toEqual(["owe", "stats", "today", "report"]);
  });
  it("옮기기", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  });
});
