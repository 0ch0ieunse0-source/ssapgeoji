/** 스페이스: 동전 · 프로필 사진 (금액·가계부 기록은 보내지 않아요. 보내는 건 친구 코드, 동전 한마디, 작게 줄인 사진뿐) */
import { COIN_MEMO_MAX, type PublicWish, type SpaceShow } from "../lib/space";
import { rpc, type RankLocal } from "./rank";

export interface SpaceRow {
  code: string;
  nickname: string;
  season: string | null;
  pct: number | null;
  grade: string | null;
  broke: boolean;
  coins: number;
  coin_lost: number;
  avatar: string | null;
}
export interface CoinVisit {
  from_nickname: string;
  memo: string | null;
  day: string;
}

export const fetchSpace = (codes: string[]) => (codes.length ? rpc<SpaceRow[]>("geoji_space_get", { p_codes: codes }) : Promise.resolve([] as SpaceRow[]));
export const fetchVisits = (code: string) => rpc<CoinVisit[]>("geoji_space_coins", { p_code: code });
/** 'ok' | 'already' | 'self' | 'missing' | 'denied' */
export const giveCoin = (r: RankLocal, to: string, memo: string) =>
  rpc<string>("geoji_coin_give", { p_code: r.code, p_secret: r.secret, p_to: to, p_memo: memo.trim().slice(0, COIN_MEMO_MAX) });
export const setAvatar = (r: RankLocal, avatar: string | null) => rpc<string>("geoji_avatar_set", { p_code: r.code, p_secret: r.secret, p_avatar: avatar });

/** 고른 사진을 가운데 정사각형으로 잘라 128px JPEG로 줄여요 (서버 한도 40,000자 안쪽) */
export function shrinkPhoto(file: File, size = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const s = Math.min(img.naturalWidth, img.naturalHeight);
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const g = c.getContext("2d")!;
        g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        let q = 0.82;
        let out = c.toDataURL("image/jpeg", q);
        while (out.length > 38000 && q > 0.3) out = c.toDataURL("image/jpeg", (q -= 0.12));
        resolve(out);
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("사진을 열 수 없어요"));
    };
    img.src = url;
  });
}

// ── 공개 설정 · 갖고 싶은 물건 ──
export interface SpaceExtra {
  code: string;
  wish: PublicWish[] | null;
  visits: boolean;
}
export const fetchExtra = (codes: string[]) => (codes.length ? rpc<SpaceExtra[]>("geoji_space_extra", { p_codes: codes }) : Promise.resolve([] as SpaceExtra[]));
export const fetchMyShow = (r: RankLocal) => rpc<SpaceShow | null>("geoji_space_mine", { p_code: r.code, p_secret: r.secret });
export const saveShow = (r: RankLocal, show: Partial<SpaceShow>) => rpc<string>("geoji_space_set_show", { p_code: r.code, p_secret: r.secret, p_show: show });
/** 갖고 싶은 물건 올리기 — buildPublicWish로 만든 값(이름·날짜·상태)만 보내요 */
export const saveWish = (r: RankLocal, wish: PublicWish[]) => rpc<string>("geoji_wish_set", { p_code: r.code, p_secret: r.secret, p_wish: wish });

const SHOW_KEY = "ssapgeoji-space-show"; // 내 공개 설정 (이 폰에 기억, 꺼 두면 물건 이름을 아예 안 보내요)
const WISH_SENT_KEY = "ssapgeoji-wish-sent";
export function cachedShow(): SpaceShow | null {
  try {
    return JSON.parse(localStorage.getItem(SHOW_KEY) || "null");
  } catch {
    return null;
  }
}
export function cacheShow(s: SpaceShow) {
  try {
    localStorage.setItem(SHOW_KEY, JSON.stringify(s));
  } catch {
    /* 기억 못 해도 서버 설정이 먼저예요 */
  }
}
export const lastWishSent = () => {
  try {
    return localStorage.getItem(WISH_SENT_KEY);
  } catch {
    return null;
  }
};
export const markWishSent = (v: string | null) => {
  try {
    if (v == null) localStorage.removeItem(WISH_SENT_KEY);
    else localStorage.setItem(WISH_SENT_KEY, v);
  } catch {
    /* 다음에 다시 보내요 */
  }
};
