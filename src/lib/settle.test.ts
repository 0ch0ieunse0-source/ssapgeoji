import { describe, expect, it } from "vitest";
import { friendAmounts, perPerson, settleMessage, type SettleInput } from "./settle";

const acc = { bank: "카카오뱅크", number: "3333-01-1234567", holder: "지민", link: "toss.me/jimin" };
const rounds: SettleInput = {
  title: "회식", date: "2026-11-05", total: 90000, mine: 25000, people: 2,
  rounds: [{ amount: 60000, people: 4 }, { amount: 30000, people: 3 }],
  names: ["민수", "현우", "수진", " "], attend: [[true, true], [true, true], [true, false]], account: acc,
};

describe("정산 메시지", () => {
  it("차수별: 참여한 차수만 더해요", () => {
    expect(friendAmounts(rounds)).toEqual([
      { name: "민수", amount: 25000, note: "" },
      { name: "현우", amount: 25000, note: "" },
      { name: "수진", amount: 15000, note: "1차만" },
    ]);
  });
  it("메시지 전체", () => {
    expect(settleMessage(rounds)).toBe(
      [
        "[정산] 회식 (11/5)", "총 90,000원", "1차 60,000원 ÷ 4명 = 15,000원", "2차 30,000원 ÷ 3명 = 10,000원", "",
        "민수 25,000원", "현우 25,000원", "수진 15,000원 (1차만)", "", "💳 카카오뱅크 3333-01-1234567 (지민)", "🔗 toss.me/jimin",
      ].join("\n"),
    );
  });
  it("한 번에: 내 몫을 뺀 나머지를 친구 수로 나눠요", () => {
    const once: SettleInput = { title: "", date: "2026-11-05", total: 30000, mine: 10000, people: 3, rounds: [], names: ["민수", "현우"], account: null };
    expect(friendAmounts(once).map((f) => f.amount)).toEqual([10000, 10000]);
    expect(settleMessage(once)).toBe(["[정산] 정산 (11/5)", "총 30,000원", "30,000원 ÷ 3명", "", "민수 10,000원", "현우 10,000원"].join("\n"));
  });
  it("이름이 없으면 1인당", () => {
    const s: SettleInput = { ...rounds, names: [], account: { bank: "", number: "", holder: "", link: "" } };
    expect(perPerson(s)).toBe(25000);
    expect(settleMessage(s).split("\n").slice(-1)[0]).toBe("1인당 25,000원 (모든 차수 참여 기준)");
  });
});

describe("정산하기 페이지 계산", async () => {
  const { computeShares, settleMessageFrom, attendNote } = await import("./settle");
  it("1/N: 끝전은 내 몫이 맡아서 합계가 총액", () => {
    expect(computeShares({ total: 40000, rounds: [], people: 3 })).toEqual({ shares: [13334, 13333, 13333], mine: 13334, error: null });
  });
  it("100원 올림: 친구 몫을 올리고 그만큼 내 몫이 줄어요", () => {
    expect(computeShares({ total: 40000, rounds: [], people: 3, roundUp100: true }).shares).toEqual([13200, 13400, 13400]);
  });
  it("차수별: 차수마다 참여한 사람끼리 나눠요", () => {
    const r = computeShares({ total: 90000, rounds: [{ amount: 60000 }, { amount: 30000 }], people: 4, attend: [[true, true], [true, true], [true, true], [true, false]] });
    expect(r.shares).toEqual([25000, 25000, 25000, 15000]);
  });
  it("직접 입력: 친구 금액은 그대로, 나는 나머지", () => {
    expect(computeShares({ total: 40000, rounds: [], people: 3, custom: [null, 5000, null] }).shares).toEqual([21667, 5000, 13333]);
    expect(computeShares({ total: 10000, rounds: [], people: 2, custom: [null, 12000] }).error).toBe("친구 몫 합계가 총액보다 많아요.");
  });
  it("메시지와 차수 표시", () => {
    expect(attendNote([true, false], 2)).toBe("1차만");
    expect(attendNote([true, true], 2)).toBe("");
    expect(settleMessageFrom({ title: "치킨", date: "2026-11-05", total: 30000, rounds: [], lines: [{ name: "민수", amount: 10000 }], account: null })).toBe(
      ["[정산] 치킨 (11/5)", "총 30,000원", "", "민수 10,000원"].join("\n"),
    );
  });
});
