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

/* ---------- 정산하기 페이지 (단계별) ---------- */

export interface ShareInput {
  total: number;
  rounds: { amount: number }[]; // 차수별이면 2개 이상, 아니면 []
  people: number; // 나 포함 인원 (나 = 0번)
  attend?: boolean[][]; // 차수별: [사람][차수] 참여 여부 (없으면 모두 참여)
  roundUp100?: boolean; // 친구 몫을 100원 단위로 올림 (남는 돈은 내 몫에서 빠져요)
  custom?: (number | null)[]; // 직접 입력: [사람] 금액 (0번 나는 무시, 자동 계산)
}

/** 사람마다 낼 금액 [나, 친구1, 친구2…]. 끝전은 내 몫이 맡아서 합계가 정확히 총액이에요 */
export function computeShares(s: ShareInput): { shares: number[]; mine: number; error: string | null } {
  const n = Math.max(1, s.people);
  const up = (x: number) => (s.roundUp100 ? Math.ceil(x / 100) * 100 : Math.round(x));
  let raw: number[];
  if (s.rounds.length > 1) {
    raw = Array.from({ length: n }, () => 0);
    s.rounds.forEach((r, k) => {
      const who = Array.from({ length: n }, (_, i) => s.attend?.[i]?.[k] ?? true);
      const cnt = who.filter(Boolean).length;
      if (!cnt) return;
      who.forEach((w, i) => w && (raw[i] += r.amount / cnt));
    });
  } else raw = Array.from({ length: n }, () => s.total / n);
  const friends = raw.slice(1).map((x, i) => {
    const c = s.custom?.[i + 1];
    return typeof c === "number" ? c : up(x);
  });
  const mine = s.total - friends.reduce((a, b) => a + b, 0);
  return { shares: [mine, ...friends], mine, error: mine < 0 ? "친구 몫 합계가 총액보다 많아요." : null };
}

/** 정해진 금액으로 메시지 만들기 */
export function settleMessageFrom(m: {
  title: string;
  date: Key;
  total: number;
  rounds: { amount: number; people: number }[];
  lines: { name: string; amount: number; note?: string }[];
  account?: SettleAccount | null;
}): string {
  const out: string[] = ["[정산] " + (m.title || "정산") + " (" + sd(m.date) + ")", "총 " + won(m.total)];
  if (m.rounds.length > 1) m.rounds.forEach((r, k) => out.push(k + 1 + "차 " + won(r.amount) + " · " + r.people + "명"));
  out.push("");
  m.lines.forEach((l) => out.push(l.name + " " + won(l.amount) + (l.note ? " (" + l.note + ")" : "")));
  const a = m.account;
  if (a && (a.number.trim() || a.link.trim())) {
    out.push("");
    if (a.number.trim()) out.push("💳 " + [a.bank.trim(), a.number.trim()].filter(Boolean).join(" ") + (a.holder.trim() ? " (" + a.holder.trim() + ")" : ""));
    if (a.link.trim()) out.push("🔗 " + a.link.trim());
  }
  return out.join("\n");
}

/** 차수 참여 표시: "1·3차만" (모두 참여면 "") */
export const attendNote = (att: boolean[] | undefined, rounds: number) => {
  if (!att || rounds < 2 || att.every(Boolean)) return "";
  const j = att.map((a, k) => (a ? k + 1 : 0)).filter(Boolean);
  return j.length ? j.join("·") + "차만" : "참여 안 함";
};
