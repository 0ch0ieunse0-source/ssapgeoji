import { describe, expect, it } from "vitest";
import { roundsLabel, splitRounds } from "./split";

describe("차수별 정산", () => {
  it("차수마다 금액 ÷ 인원을 더해서 내 몫", () => {
    expect(splitRounds([{ amount: 60000, people: 4 }, { amount: 30000, people: 3 }])).toMatchObject({ total: 90000, mine: 25000, per: [15000, 10000] });
  });
  it("나눠떨어지지 않으면 1원 단위 반올림", () => {
    expect(splitRounds([{ amount: 10000, people: 3 }])).toMatchObject({ total: 10000, mine: 3333, per: [3333] });
  });
  it("금액이 없는 차수는 빼고, 인원이 0이면 1명으로", () => {
    expect(splitRounds([{ amount: 0, people: 4 }, { amount: 5000, people: 0 }])).toMatchObject({ total: 5000, mine: 5000, per: [5000] });
  });
  it("표시", () => {
    expect([roundsLabel(1), roundsLabel(2), roundsLabel(3)]).toEqual(["", "1·2차", "1·2·3차"]);
  });
});
