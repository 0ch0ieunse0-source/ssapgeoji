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
