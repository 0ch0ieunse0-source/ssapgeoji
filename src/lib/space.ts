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

// ── 스페이스 공개 설정 (기본은 모두 공개, 마이페이지에서 하나씩 끌 수 있어요) ──
export const SPACE_SHOW = [
  { key: "wish", label: "갖고 싶은 물건", desc: "물건 이름과 남은 기다림만. 가격은 안 보여요" },
  { key: "avatar", label: "프로필 사진", desc: "끄면 닉네임 첫 글자로 보여요" },
  { key: "grade", label: "등급 · 지킴률", desc: "예: 알뜰거지 82%. 랭킹에는 그대로 보여요" },
  { key: "broke", label: "파산 표시", desc: "💀 파산, 파산해서 잃은 동전" },
  { key: "visits", label: "최근 동전 · 한마디", desc: "누가 동전을 주고 갔는지, 남긴 한마디" },
] as const;
export type SpaceShowKey = (typeof SPACE_SHOW)[number]["key"];
export type SpaceShow = Record<SpaceShowKey, boolean>;
export const SHOW_ALL: SpaceShow = { wish: true, avatar: true, grade: true, broke: true, visits: true };

export interface PublicWish {
  n: string; // 물건 이름 (30자까지)
  d: string; // 기다림이 끝나는 날 (YYYY-MM-DD)
  s: "wait" | "skip" | "bought";
}
export const PUBLIC_WISH_MAX = 10;

/** 친구에게 보여줄 '갖고 싶은 물건' — 이름·끝나는 날·상태만 (가격·메모 등은 절대 넣지 않아요) */
export function buildPublicWish(items: { name: string; price?: number; wait: number; addedAt: number; status: string; decidedAt?: number }[]): PublicWish[] {
  const day = (ms: number) => {
    const d = new Date(ms);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  const waiting = items.filter((w) => w.status === "waiting").sort((a, b) => a.addedAt + a.wait * 36e5 - (b.addedAt + b.wait * 36e5));
  const done = items.filter((w) => w.status === "skipped" || w.status === "bought").sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0));
  return [...waiting, ...done].slice(0, PUBLIC_WISH_MAX).map((w) => ({
    n: String(w.name || "").trim().slice(0, 30),
    d: day(w.addedAt + w.wait * 36e5),
    s: w.status === "waiting" ? "wait" : w.status === "bought" ? "bought" : "skip",
  }));
}
