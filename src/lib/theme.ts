/** 메인 컬러 (설정 → 화면). 색 값은 styles/tokens.css의 [data-accent] 블록에 있어요. */
export const ACCENTS = [
  { id: "green", label: "초록", sw: "#0a9a68" },
  { id: "blue", label: "파랑", sw: "#2f6bdb" },
  { id: "purple", label: "보라", sw: "#7650e0" },
  { id: "pink", label: "분홍", sw: "#d6406f" },
  { id: "orange", label: "주황", sw: "#c95a14" },
  { id: "gray", label: "회색", sw: "#69727d" },
  { id: "black", label: "검정", sw: "#23282b" },
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];
export const accentOf = (id: string | undefined | null): AccentId => (ACCENTS.some((a) => a.id === id) ? (id as AccentId) : "green");
export const accentLabel = (id: string | undefined | null) => ACCENTS.find((a) => a.id === accentOf(id))!.label;

export function applyAccent(id: string | undefined | null) {
  document.documentElement.dataset.accent = accentOf(id);
}
