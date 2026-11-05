/**
 * 친구 랭킹 — 화면과 분리한 순수 함수
 * 서버에는 친구 코드·닉네임·시즌·지킴률·등급·파산 여부만 보내요. 금액은 절대 보내지 않아요 (buildScorePayload).
 */
import { addDays, dOf } from "./date";
import { limitOf, loggedDay, spentOf } from "./ledger";
import { daysFor, periodOf, planFor, type DayInfo } from "./period";
import type { Data, Key, Period, Settings } from "./types";

/** 첫 시즌 시작일 (월요일). 여기서부터 2주씩 끊어요. 모든 친구가 같은 시즌으로 비교해요. */
export const SEASON_ANCHOR = "2026-11-02";
export const SEASON_DAYS = 14;
export const BROKE_RATIO = 1.3; // 2주 한도 합계보다 30% 넘게 쓰면 파산
export const GRADES = ["꽃거지", "알뜰거지", "보통거지", "흔들거지", "핵거지"] as const;
export type Grade = (typeof GRADES)[number];

const dayDiff = (a: Key, b: Key) => Math.round((dOf(b).getTime() - dOf(a).getTime()) / 86400000);

/** k가 들어 있는 2주 시즌 */
export function seasonOf(k: Key): Period {
  const n = Math.floor(dayDiff(SEASON_ANCHOR, k) / SEASON_DAYS);
  const start = addDays(SEASON_ANCHOR, n * SEASON_DAYS);
  return { start, end: addDays(start, SEASON_DAYS - 1) };
}
/** 지금 발표된(가장 최근에 끝난) 시즌 */
export const announcedSeason = (today: Key): Period => seasonOf(addDays(seasonOf(today).start, -1));
/** 다음 발표일 = 지금 시즌이 끝난 다음 날 */
export const nextAnnounce = (today: Key): Key => addDays(seasonOf(today).end, 1);

export function gradeOf(pct: number): Grade {
  if (pct >= 90) return "꽃거지";
  if (pct >= 70) return "알뜰거지";
  if (pct >= 50) return "보통거지";
  if (pct >= 30) return "흔들거지";
  return "핵거지";
}

export interface SeasonScore {
  pct: number | null; // 기록한 날이 없으면 null
  grade: Grade | null;
  broke: boolean;
}

/** 시즌 성적: 기록한 날 중 한도를 지킨 날의 비율, 파산 여부 */
export function scoreFor(data: Data, cfg: Settings, season: Period): SeasonScore {
  const cache = new Map<Key, DayInfo[]>();
  const infoOf = (k: Key): DayInfo => {
    const p = periodOf(k, cfg.cycleDay);
    if (!cache.has(p.start)) cache.set(p.start, daysFor(p, planFor(data.periods, cfg, p), cfg.appts));
    return cache.get(p.start)!.find((d) => d.key === k)!;
  };
  let logged = 0, kept = 0, spent = 0, limits = 0;
  for (let k = season.start; k <= season.end; k = addDays(k, 1)) {
    const d = infoOf(k);
    const l = limitOf(data.days, d), s = spentOf(data.days, k);
    limits += l;
    spent += s;
    if (loggedDay(data.days, k)) {
      logged++;
      if (s <= l) kept++;
    }
  }
  if (!logged) return { pct: null, grade: null, broke: false };
  const pct = Math.round((kept / logged) * 100);
  return { pct, grade: gradeOf(pct), broke: spent > limits * BROKE_RATIO };
}

/** 서버로 보내는 값 — 여기 있는 것 말고는 아무것도 보내지 않아요 */
export function buildScorePayload(code: string, secret: string, nickname: string, season: Period, s: SeasonScore) {
  return {
    p_code: code,
    p_secret: secret,
    p_nickname: nickname,
    p_season: season.start,
    p_pct: s.pct,
    p_grade: s.grade,
    p_broke: s.broke,
  };
}

/** 친구 코드 모양 맞추기: "geoji-7k3p9q", "7K3P9Q" → "GEOJI-7K3P9Q". 틀리면 null */
export function normalizeCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/\s/g, "").replace(/^GEOJI-?/, "");
  return /^[A-HJ-NP-Z2-9]{6}$/.test(raw) ? "GEOJI-" + raw : null;
}

export interface RankRow {
  code: string;
  nickname: string;
  season: Key | null;
  pct: number | null;
  grade: string | null;
  broke: boolean;
}
export interface RankedRow extends RankRow {
  rank: number | null; // null = 기록 없음 / 집계 전
  state: "ranked" | "nolog" | "pending";
}

/** 발표된 시즌 기준 순위 (같은 퍼센트는 같은 등수) */
export function rankRows(rows: RankRow[], season: Key): RankedRow[] {
  const ranked = rows.filter((r) => r.season === season && r.pct != null).sort((a, b) => b.pct! - a.pct! || a.nickname.localeCompare(b.nickname));
  const out: RankedRow[] = [];
  ranked.forEach((r, i) => {
    const rank = i > 0 && ranked[i - 1].pct === r.pct ? out[i - 1].rank : i + 1;
    out.push({ ...r, rank, state: "ranked" });
  });
  rows.filter((r) => r.season === season && r.pct == null).forEach((r) => out.push({ ...r, rank: null, state: "nolog" }));
  rows.filter((r) => r.season !== season).forEach((r) => out.push({ ...r, rank: null, state: "pending" }));
  return out;
}

/** 등급별 한마디 */
export const GRADE_LINE: Record<Grade, string> = {
  꽃거지: "통장을 지켜낸 진정한 거지",
  알뜰거지: "조금만 더 하면 꽃거지",
  보통거지: "평범하게 아끼는 중",
  흔들거지: "지갑이 흔들리고 있어요",
  핵거지: "지갑이 울고 있어요",
};
export const lineOf = (grade: string | null, broke: boolean) => (broke ? "파산 선고!" : GRADE_LINE[grade as Grade] || "");

export interface Reveal {
  top: RankedRow[]; // 1등 (같은 퍼센트면 여러 명)
  me: RankedRow | null; // 순위에 든 나
  total: number; // 순위에 든 사람 수
  last: RankedRow | null; // 꼴찌 (순위에 든 사람이 3명 이상이고 1등이 아닐 때)
}
/** 발표 연출에 보여줄 것. 보여줄 게 없으면 null */
export function buildReveal(rows: RankedRow[], myCode: string): Reveal | null {
  const ranked = rows.filter((r) => r.state === "ranked");
  if (!ranked.length) return null;
  const top = ranked.filter((r) => r.rank === 1);
  const me = ranked.find((r) => r.code === myCode) || null;
  const lastRank = ranked[ranked.length - 1].rank;
  const last = ranked.length >= 3 && lastRank !== 1 ? ranked.filter((r) => r.rank === lastRank).find((r) => r.code === myCode) || ranked[ranked.length - 1] : null;
  return { top, me, total: ranked.length, last };
}
