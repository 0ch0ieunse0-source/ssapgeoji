export const won = (n: number) => (n < 0 ? "-" : "") + Math.abs(Math.round(n)).toLocaleString("ko-KR") + "원";
export const short = (n: number) => (n >= 10000 ? Math.round(n / 1000) / 10 + "만" : n.toLocaleString("ko-KR"));
export const man = (v: number) => (v >= 10000 ? Math.round(v / 10000).toLocaleString("ko-KR") + "만" : String(Math.round(v)));
/** 금액 칸에 넣을 수 있는 가장 큰 수 (1조 원 미만, 12자리). 이보다 길면 컴퓨터가 숫자를 정확히 못 다뤄요 */
export const MAX_WON = 999_999_999_999;
/** "12,000원" 같은 글자에서 숫자만 꺼내요. 없으면 0. 소수점 뒤는 버리고(3500.50 → 3500), 12자리까지만 */
export const parse = (s: unknown) => parseInt(String(s ?? "").split(".")[0].replace(/[^0-9]/g, "").slice(0, 12), 10) || 0;
/** 마이너스도 받는 금액 (통장 잔액). "-50,000" → -50000 */
export const parseSigned = (s: unknown) => {
  const n = parse(s);
  return /^\s*[-−]/.test(String(s ?? "")) ? -n : n;
};
/** 마이너스 칸 입력 표시: "-"만 쳤을 때도 지우지 않아요 */
export const fmtSigned = (s: string) => {
  const neg = /^\s*[-−]/.test(s);
  const n = parse(s);
  return neg ? "-" + (n ? n.toLocaleString("ko-KR") : "") : fmt(n);
};
/** 입력칸에 보여줄 금액 (0이면 빈칸) */
export const fmt = (n: number | null | undefined) => (n ? Number(n).toLocaleString("ko-KR") : "");
export const uid6 = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/** 받침에 맞는 조사: eulReul("대구") → "대구를", eulReul("부산 여행") → "부산 여행을" */
export function eulReul(word: string) {
  const c = word.trim().charCodeAt(word.trim().length - 1);
  const batchim = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false;
  return word + (batchim ? "을" : "를");
}
