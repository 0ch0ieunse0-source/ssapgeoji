// 스페이스: 친구에게 받은 동전 수로 방 단계가 정해져요 (동전은 장난 포인트, 진짜 돈과 상관없어요)
export const ROOM_TIERS = [
  { min: 0, name: "길바닥", desc: "신문지 한 장과 찌그러진 깡통" },
  { min: 10, name: "골판지 하우스", desc: "그래도 비는 피해요" },
  { min: 30, name: "반지하 단칸방", desc: "창문으로 발이 지나가요" },
  { min: 70, name: "원룸", desc: "드디어 침대가 생겼어요" },
  { min: 150, name: "거지 펜트하우스", desc: "동전으로 지은 궁전" },
] as const;

export const COIN_MEMO_MAX = 30;
export const BANKRUPT_COIN_CUT = 0.3; // 파산한 시즌엔 동전 30%를 잃어요 (서버 supabase/space.sql과 같아요)

/** 동전 수 → 방 단계(0~4) */
export function tierOf(coins: number): number {
  let t = 0;
  ROOM_TIERS.forEach((r, i) => {
    if (coins >= r.min) t = i;
  });
  return t;
}

/** 다음 단계까지: 남은 동전 수와 진행률(0~1). 마지막 단계면 null */
export function nextTier(coins: number): { left: number; ratio: number; name: string } | null {
  const t = tierOf(coins);
  const next = ROOM_TIERS[t + 1];
  if (!next) return null;
  const from = ROOM_TIERS[t].min;
  return { left: next.min - coins, ratio: (coins - from) / (next.min - from), name: next.name };
}

/** 파산했을 때 잃는 동전 수 (서버 계산과 같아요: 30%, 동전이 있으면 최소 1개) */
export const bankruptLoss = (coins: number) => (coins > 0 ? Math.max(1, Math.ceil(coins * BANKRUPT_COIN_CUT)) : 0);
