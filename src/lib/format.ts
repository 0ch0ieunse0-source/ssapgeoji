export const won = (n: number) => (n < 0 ? "-" : "") + Math.abs(Math.round(n)).toLocaleString("ko-KR") + "원";
export const short = (n: number) => (n >= 10000 ? Math.round(n / 1000) / 10 + "만" : n.toLocaleString("ko-KR"));
export const man = (v: number) => (v >= 10000 ? Math.round(v / 10000).toLocaleString("ko-KR") + "만" : String(Math.round(v)));
/** "12,000원" 같은 글자에서 숫자만 꺼내요. 없으면 0 */
export const parse = (s: unknown) => parseInt(String(s ?? "").replace(/[^0-9]/g, ""), 10) || 0;
/** 입력칸에 보여줄 금액 (0이면 빈칸) */
export const fmt = (n: number | null | undefined) => (n ? Number(n).toLocaleString("ko-KR") : "");
export const uid6 = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/** 받침에 맞는 조사: eulReul("대구") → "대구를", eulReul("부산 여행") → "부산 여행을" */
export function eulReul(word: string) {
  const c = word.trim().charCodeAt(word.trim().length - 1);
  const batchim = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false;
  return word + (batchim ? "을" : "를");
}
