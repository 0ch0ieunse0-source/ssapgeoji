/** 친구 랭킹: 서버 호출과 이 폰에 저장하는 랭킹 정보 (금액은 다루지 않아요) */
import { buildScorePayload, type RankRow, type SeasonScore } from "../lib/rank";
import type { Period } from "../lib/types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../rankConfig";

const KEY = "ssapgeoji-rank";
export interface RankLocal {
  code: string;
  secret: string; // 내 점수를 나만 바꿀 수 있게 하는 비밀 열쇠 (이 폰에만 있어요)
  nickname: string;
  friends: string[];
  submitted: string | null; // 마지막으로 올린 시즌 시작일
}

export function loadRank(): RankLocal | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && typeof v.code === "string" && typeof v.secret === "string" ? { friends: [], submitted: null, ...v } : null;
  } catch {
    return null;
  }
}
export function saveRank(r: RankLocal | null) {
  try {
    if (r) localStorage.setItem(KEY, JSON.stringify(r));
    else localStorage.removeItem(KEY);
  } catch {
    /* 저장이 막혀 있으면 다음에 다시 만들어요 */
  }
}

async function rpc<T>(fn: string, body: unknown): Promise<T> {
  const r = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/" + fn, {
    method: "POST",
    // 예전 anon key(eyJ…)는 Authorization에도 넣고, 새 publishable key(sb_publishable_…)는 apikey에만 넣어요
    headers: {
      apikey: SUPABASE_ANON_KEY,
      ...(SUPABASE_ANON_KEY.startsWith("eyJ") ? { Authorization: "Bearer " + SUPABASE_ANON_KEY } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.text().catch(() => "")) || String(r.status));
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}

const newSecret = () => {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
};

export async function createProfile(nickname: string): Promise<RankLocal> {
  const secret = newSecret();
  const code = await rpc<string>("geoji_create", { p_nickname: nickname, p_secret: secret });
  const r: RankLocal = { code, secret, nickname, friends: [], submitted: null };
  saveRank(r);
  return r;
}

/** 발표된 시즌 성적 올리기 — buildScorePayload로 만든 값만 보내요 */
export async function submitScore(r: RankLocal, season: Period, score: SeasonScore) {
  await rpc("geoji_submit", buildScorePayload(r.code, r.secret, r.nickname, season, score));
}

export const fetchRows = (codes: string[]) => (codes.length ? rpc<RankRow[]>("geoji_get", { p_codes: codes }) : Promise.resolve([] as RankRow[]));

export async function deleteProfile(r: RankLocal) {
  await rpc("geoji_delete", { p_code: r.code, p_secret: r.secret });
  saveRank(null);
}

export type PokeKind = "cheer" | "poke";
export interface InboxItem {
  from_nickname: string;
  kind: PokeKind;
  created_at: string;
}
/** 응원·콕 보내기 — 친구 코드와 종류만 보내요. "ok" 또는 "already"(오늘 이미 보냄) */
export const sendPoke = (r: RankLocal, to: string, kind: PokeKind) =>
  rpc<string>("geoji_poke", { p_code: r.code, p_secret: r.secret, p_to: to, p_kind: kind });
/** 받은 응원·콕 (읽음 처리돼요) */
export const fetchInbox = (r: RankLocal) => rpc<InboxItem[]>("geoji_inbox", { p_code: r.code, p_secret: r.secret });
