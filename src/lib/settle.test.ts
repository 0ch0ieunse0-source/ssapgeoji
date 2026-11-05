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
