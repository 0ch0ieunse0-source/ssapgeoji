/** 정산 메시지 (베타) — 화면과 분리한 순수 함수. 메시지는 내가 복사·공유할 때만 밖으로 나가요. */
import { sd } from "./date";
import { won } from "./format";
import type { Key } from "./types";

export interface SettleAccount {
  bank: string;
  number: string;
  holder: string;
  link: string; // 토스·카카오페이 송금 링크 (선택)
}
export interface SettleInput {
  title: string;
  date: Key;
  total: number; // 내가 결제한 전체 금액
  mine: number; // 내 몫
  people: number; // 한 번에: 나 포함 인원
  rounds: { amount: number; people: number }[]; // 차수별이면 2개 이상
  names: string[];
  attend?: boolean[][]; // 차수별: 이름마다 차수 참여 여부
  account?: SettleAccount | null;
}

const perOf = (r: { amount: number; people: number }) => Math.round(r.amount / Math.max(1, r.people));
const byRounds = (s: SettleInput) => s.rounds.length > 1;

/** 친구마다 줘야 할 금액 */
export function friendAmounts(s: SettleInput): { name: string; amount: number; note: string }[] {
  const names = s.names.map((n) => n.trim()).filter(Boolean);
  if (byRounds(s)) {
    return names.map((name, i) => {
      const att = s.rounds.map((_, k) => s.attend?.[i]?.[k] ?? true);
      const amount = s.rounds.reduce((sum, r, k) => sum + (att[k] ? perOf(r) : 0), 0);
      const joined = att.map((a, k) => (a ? k + 1 : 0)).filter(Boolean);
      const note = joined.length === s.rounds.length ? "" : joined.length ? joined.join("·") + "차만" : "참여 안 함";
      return { name, amount, note };
    });
  }
  const others = Math.max(1, s.people - 1);
  const each = Math.round((s.total - s.mine) / others);
  return names.map((name) => ({ name, amount: each, note: "" }));
}

/** 1인당 금액 (이름을 안 넣었을 때) */
export const perPerson = (s: SettleInput) => (byRounds(s) ? s.rounds.reduce((sum, r) => sum + perOf(r), 0) : Math.round((s.total - s.mine) / Math.max(1, s.people - 1)));

export function settleMessage(s: SettleInput): string {
  const lines: string[] = ["[정산] " + (s.title || "정산") + " (" + sd(s.date) + ")", "총 " + won(s.total)];
  if (byRounds(s)) s.rounds.forEach((r, k) => lines.push(k + 1 + "차 " + won(r.amount) + " ÷ " + r.people + "명 = " + won(perOf(r))));
  else lines.push(won(s.total) + " ÷ " + s.people + "명");
  lines.push("");
  const list = friendAmounts(s);
  if (list.length) list.forEach((f) => lines.push(f.name + " " + won(f.amount) + (f.note ? " (" + f.note + ")" : "")));
  else lines.push("1인당 " + won(perPerson(s)) + (byRounds(s) ? " (모든 차수 참여 기준)" : ""));
  const a = s.account;
  if (a && (a.number.trim() || a.link.trim())) {
    lines.push("");
    if (a.number.trim()) lines.push("💳 " + [a.bank.trim(), a.number.trim()].filter(Boolean).join(" ") + (a.holder.trim() ? " (" + a.holder.trim() + ")" : ""));
    if (a.link.trim()) lines.push("🔗 " + a.link.trim());
  }
  return lines.join("\n");
}
