/** 기능 제안 게시판 (구글 시트 연결) — 화면과 분리한 순수 함수 */
export const BOARD_MAX_TEXT = 300;
export const BOARD_MAX_NAME = 12;
export const BOARD_COOLDOWN_MS = 30 * 1000; // 같은 폰에서 30초에 한 번

export interface BoardPost {
  t: number;
  name: string;
  text: string;
}

/** 서버에서 받은 값을 안전한 모양으로 (모양이 틀린 건 버리고, 최신순) */
export function normalizePosts(raw: unknown): BoardPost[] {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { posts?: unknown }).posts) ? (raw as { posts: unknown[] }).posts : [];
  return list
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({
      t: Number(p.t) || 0,
      name: String(p.name ?? "").slice(0, BOARD_MAX_NAME) || "익명",
      text: String(p.text ?? "").slice(0, BOARD_MAX_TEXT),
    }))
    .filter((p) => p.text.trim() !== "")
    .sort((a, b) => b.t - a.t);
}

/** 올리기 전에 확인. 문제가 없으면 null */
export function checkPost(text: string, lastPostAt: number | null, now: number): string | null {
  if (!text.trim()) return "제안 내용을 적어주세요.";
  if (text.length > BOARD_MAX_TEXT) return BOARD_MAX_TEXT + "자까지 쓸 수 있어요.";
  if (lastPostAt && now - lastPostAt < BOARD_COOLDOWN_MS) return "조금 뒤에 다시 올려주세요.";
  return null;
}

/** "방금", "5분 전", "3시간 전", "11월 5일" */
export function timeAgo(t: number, now: number): string {
  if (!t) return "";
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return m + "분 전";
  if (m < 24 * 60) return Math.floor(m / 60) + "시간 전";
  const d = new Date(t);
  return d.getMonth() + 1 + "월 " + d.getDate() + "일";
}
