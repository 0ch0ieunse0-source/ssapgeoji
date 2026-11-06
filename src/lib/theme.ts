/** 메인 컬러 (설정 → 화면). 색 값은 styles/tokens.css의 [data-accent] 블록에 있어요. */
export const ACCENTS = [
  { id: "green", label: "초록", sw: "#0c8c61" },
  { id: "blue", label: "파랑", sw: "#2b66e0" },
  { id: "purple", label: "보라", sw: "#6b52dc" },
  { id: "pink", label: "분홍", sw: "#d24f7d" },
  { id: "orange", label: "주황", sw: "#d45a20" },
  { id: "gray", label: "회색", sw: "#566275" },
  { id: "black", label: "검정", sw: "#191f28" },
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];
export const accentOf = (id: string | undefined | null): AccentId => (ACCENTS.some((a) => a.id === id) ? (id as AccentId) : "green");
export const accentLabel = (id: string | undefined | null) => ACCENTS.find((a) => a.id === accentOf(id))!.label;

export function applyAccent(id: string | undefined | null) {
  document.documentElement.dataset.accent = accentOf(id);
}
