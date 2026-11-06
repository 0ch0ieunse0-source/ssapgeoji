/** 메인 컬러 (설정 → 화면). 색 값은 styles/tokens.css의 [data-accent] 블록에 있어요. */
export const ACCENTS = [
  { id: "green", label: "그린", sw: "#3dae4f" },
  { id: "blue", label: "블루", sw: "#0083ff" },
  { id: "purple", label: "퍼플", sw: "#735df6" },
  { id: "pink", label: "라즈베리", sw: "#f0005a" },
  { id: "orange", label: "오렌지", sw: "#f97114" },
  { id: "black", label: "다크", sw: "#2b2024" },
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];
// 예전 '회색'을 고른 사람은 '다크'로 옮겨요 (테마를 6가지로 줄였어요)
const OLD: Record<string, AccentId> = { gray: "black" };
export const accentOf = (id: string | undefined | null): AccentId =>
  ACCENTS.some((a) => a.id === id) ? (id as AccentId) : (id && OLD[id]) || "green";
export const accentLabel = (id: string | undefined | null) => ACCENTS.find((a) => a.id === accentOf(id))!.label;

export function applyAccent(id: string | undefined | null) {
  document.documentElement.dataset.accent = accentOf(id);
}
