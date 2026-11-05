// localStorage "aggim-v1"에 저장되는 데이터 구조 (프로토타입과 같아요)
// 앱 이름이 거지노트로 바뀌었지만, 기존 기록이 남도록 저장 이름은 그대로 둬요.

export type Key = string; // "YYYY-MM-DD"
export type Pay = "check" | "card";

export interface Item {
  id: string;
  amount: number; // 결제한 전체 금액
  memo: string;
  cat: string;
  pay: Pay;
  t: number;
  mine?: number; // 친구 몫을 나눈 경우 내 몫
  received?: boolean;
  receivedOn?: Key;
  /** 차수별 정산으로 나눴을 때만 (표시용, 계산은 amount·mine으로) */
  rounds?: { amount: number; people: number }[];
  /** 정산 메시지용 (선택): 한 번에 나눌 때 인원, 친구 이름, 차수별 참여 */
  settle?: { people?: number; names: string[]; attend?: boolean[][]; amounts?: number[] };
}

export interface DayRec {
  items: Item[];
  limit: number | null;
  noSpend: boolean;
}
export type DaysMap = Record<Key, DayRec>;

export interface Fixed {
  id: string;
  name: string;
  day: number;
  amount: number;
}

export interface Settings {
  name: string;
  cycleDay: number;
  total: number;
  autoLimits: boolean;
  weekday: number;
  weekend: number;
  appts: Key[];
  apptLimit: number;
  balance: number | null;
  balanceDate: Key | null;
  payday: number | null;
  salary: number | null;
  fixed: Fixed[];
  cardPay: number | null;
  cardCut: number | null;
  goalAmt: number | null;
  goalDate: Key | null;
  firstStart: Key | null;
  /** 메인 컬러 (설정 → 화면). 없으면 초록 */
  accent?: string;
  /** 처음 쓰기 시작한 날 */
  joinDate?: Key;
  /** 처음 쓰기 전 날: "zero"면 한도 0으로 보고 그만큼 그 달 생활비에서 빼요. 없거나 "keep"이면 그대로 */
  preStart?: "zero" | "keep";
  /** 약속 이름 (선택): 날짜 → "민지 생일" */
  apptNames?: Record<Key, string>;
  /** 여행 (여러 날을 한 예산으로) */
  trips?: import("./trip").Trip[];
}

export interface Plan {
  total: number;
  apptLimit: number;
  auto: boolean;
  weekday: number;
  weekend: number;
}

export type FlowStatus = "plan" | "done" | "skip";
export interface FlowOver {
  status?: FlowStatus;
  amount?: number;
}
export interface CustomFlow {
  id: string;
  date: Key;
  label: string;
  type: "in" | "out";
  amount: number;
  status: FlowStatus;
}

export interface Snap {
  id: string;
  date: Key;
  cash: number;
  cy: number;
  etf: number;
}

export type WishStatus = "waiting" | "skipped" | "bought";
export interface Wish {
  id: string;
  name: string;
  price: number;
  wait: number; // 시간
  addedAt: number;
  status: WishStatus;
  decidedAt?: number;
}

export interface Move {
  id: string;
  date: Key;
  period?: Key;
  amount: number;
}

export interface Data {
  v: 2;
  settings: Settings | null;
  periods: Record<Key, Plan>;
  days: DaysMap;
  flows: { over: Record<string, FlowOver>; custom: CustomFlow[] };
  goal: { snaps: Snap[] };
  wish: { items: Wish[] };
  savings: { moves: Move[] };
}

export interface Period {
  start: Key;
  end: Key;
}
