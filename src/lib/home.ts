// 홈 화면 카드 순서·숨기기 (설정에 저장해서 계정이 있으면 다른 기기에도 같이 가요)
export const HOME_BLOCKS = [
  { id: "stats", name: "무지출 · 예비비 · 받을 돈" },
  { id: "today", name: "오늘 쓴 돈" },
  { id: "rank", name: "친구 랭킹" },
  { id: "report", name: "소비 리포트" },
  { id: "card", name: "신용카드로 쓴 생활비" },
  { id: "owe", name: "친구한테 받을 돈" },
] as const;
export type HomeBlockId = (typeof HOME_BLOCKS)[number]["id"];
const IDS = HOME_BLOCKS.map((b) => b.id) as HomeBlockId[];
const isId = (x: string): x is HomeBlockId => (IDS as string[]).includes(x);

/** 저장된 순서를 정리해요: 모르는 이름·중복은 빼고, 새로 생긴 카드는 기본 자리에 끼워요 */
export function homeOrder(saved?: string[] | null): HomeBlockId[] {
  const out: HomeBlockId[] = [];
  for (const x of saved || []) if (isId(x) && !out.includes(x)) out.push(x);
  IDS.forEach((id, i) => {
    if (out.includes(id)) return;
    // 기본 순서에서 바로 앞 카드 뒤에 넣어요
    const prev = IDS.slice(0, i).reverse().find((p) => out.includes(p));
    out.splice(prev ? out.indexOf(prev) + 1 : 0, 0, id);
  });
  return out;
}

/** 보여줄 카드만 순서대로 */
export const homeVisible = (saved?: string[] | null, hidden?: string[] | null) => homeOrder(saved).filter((id) => !(hidden || []).includes(id));

export function moveItem<T>(a: T[], from: number, to: number): T[] {
  const b = a.slice();
  const [x] = b.splice(from, 1);
  b.splice(Math.max(0, Math.min(b.length, to)), 0, x);
  return b;
}
