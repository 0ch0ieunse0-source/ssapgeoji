/** 친구 몫 나누기: 차수별 정산 (차수마다 금액 ÷ 인원을 더해서 내 몫) */
export interface Round {
  amount: number;
  people: number; // 나 포함
}
export const MAX_ROUNDS = 5;

export function splitRounds(rounds: Round[]) {
  const valid = rounds.filter((r) => r.amount > 0);
  const per = valid.map((r) => Math.round(r.amount / Math.max(1, r.people)));
  const total = valid.reduce((s, r) => s + r.amount, 0);
  const mine = Math.min(total, per.reduce((s, x) => s + x, 0));
  return { valid, per, total, mine };
}

/** 내역에 붙이는 짧은 표시: "1·2차" */
export const roundsLabel = (n: number) => (n > 1 ? Array.from({ length: n }, (_, i) => i + 1).join("·") + "차" : "");
