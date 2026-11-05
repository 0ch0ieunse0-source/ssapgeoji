import { describe, expect, it } from "vitest";
import { announcedSeason, buildScorePayload, gradeOf, nextAnnounce, normalizeCode, rankRows, scoreFor, seasonOf } from "./rank";
import { dataWith, item, makeCfg } from "./testUtils";

describe("2주 시즌", () => {
  it("월요일부터 2주씩", () => {
    expect(seasonOf("2026-11-02")).toEqual({ start: "2026-11-02", end: "2026-11-15" });
    expect(seasonOf("2026-11-15")).toEqual({ start: "2026-11-02", end: "2026-11-15" });
    expect(seasonOf("2026-11-16")).toEqual({ start: "2026-11-16", end: "2026-11-29" });
    expect(seasonOf("2026-11-01")).toEqual({ start: "2026-10-19", end: "2026-11-01" });
  });
  it("연말을 넘어가도 이어져요", () => {
    expect(seasonOf("2026-12-30")).toEqual({ start: "2026-12-28", end: "2027-01-10" });
  });
  it("발표된 시즌은 가장 최근에 끝난 시즌, 다음 발표는 지금 시즌 끝난 다음 날", () => {
    expect(announcedSeason("2026-11-05")).toEqual({ start: "2026-10-19", end: "2026-11-01" });
    expect(announcedSeason("2026-11-16")).toEqual({ start: "2026-11-02", end: "2026-11-15" });
    expect(nextAnnounce("2026-11-05")).toBe("2026-11-16");
  });
});

describe("등급", () => {
  it("90/70/50/30 기준", () => {
    expect([100, 90, 89, 70, 69, 50, 49, 30, 29, 0].map(gradeOf)).toEqual([
      "꽃거지", "꽃거지", "알뜰거지", "알뜰거지", "보통거지", "보통거지", "흔들거지", "흔들거지", "핵거지", "핵거지",
    ]);
  });
});

describe("시즌 성적", () => {
  // 1일 시작, 하루 한도 모두 10,000원
  const cfg = makeCfg({ weekday: 10000, weekend: 10000 });
  const season = { start: "2026-11-02", end: "2026-11-15" };
  it("기록한 날 중 한도를 지킨 날 비율 (무지출 포함, 기록 없는 날은 빼요)", () => {
    const data = dataWith({
      days: {
        "2026-11-02": { items: [item(9000)], limit: null, noSpend: false }, // 지킴
        "2026-11-03": { items: [item(12000)], limit: null, noSpend: false }, // 넘음
        "2026-11-04": { items: [], limit: null, noSpend: true }, // 무지출 = 지킴
        "2026-11-05": { items: [item(16000, { mine: 8000 })], limit: null, noSpend: false }, // 내 몫 8,000 = 지킴
        "2026-10-30": { items: [item(99999)], limit: null, noSpend: false }, // 시즌 밖
      },
    });
    expect(scoreFor(data, cfg, season)).toEqual({ pct: 75, grade: "알뜰거지", broke: false });
  });
  it("한도를 바꾼 날은 바꾼 한도로", () => {
    const data = dataWith({ days: { "2026-11-02": { items: [item(15000)], limit: 20000, noSpend: false } } });
    expect(scoreFor(data, cfg, season).pct).toBe(100);
  });
  it("기록이 없으면 점수 없음", () => {
    expect(scoreFor(dataWith(), cfg, season)).toEqual({ pct: null, grade: null, broke: false });
  });
  it("2주 한도 합계(140,000원)보다 30% 넘게 쓰면 파산", () => {
    const at = (amt: number) => dataWith({ days: { "2026-11-02": { items: [item(amt)], limit: null, noSpend: false } } });
    expect(scoreFor(at(182000), cfg, season).broke).toBe(false);
    expect(scoreFor(at(182001), cfg, season)).toEqual({ pct: 0, grade: "핵거지", broke: true });
  });
  it("시즌이 두 달에 걸쳐도 각 달 한도로 계산", () => {
    const c = makeCfg({ cycleDay: 10, autoLimits: false, weekday: 10000, weekend: 10000 });
    const data = dataWith({
      periods: { "2026-11-10": { total: 1, apptLimit: 0, auto: false, weekday: 5000, weekend: 5000 } },
      days: {
        "2026-11-09": { items: [item(8000)], limit: null, noSpend: false }, // 10월 기간: 한도 10,000 → 지킴
        "2026-11-10": { items: [item(8000)], limit: null, noSpend: false }, // 11월 기간: 한도 5,000 → 넘음
      },
    });
    expect(scoreFor(data, c, season).pct).toBe(50);
  });
});

describe("개인 금액은 절대 안 보내요", () => {
  it("서버로 보내는 값은 정해진 7가지뿐이고 금액이 없어요", () => {
    const p = buildScorePayload("GEOJI-ABCDEF", "s".repeat(40), "지민", { start: "2026-11-02", end: "2026-11-15" }, { pct: 75, grade: "알뜰거지", broke: false });
    expect(Object.keys(p).sort()).toEqual(["p_broke", "p_code", "p_grade", "p_nickname", "p_pct", "p_season", "p_secret"]);
    expect(p).toEqual({ p_code: "GEOJI-ABCDEF", p_secret: "s".repeat(40), p_nickname: "지민", p_season: "2026-11-02", p_pct: 75, p_grade: "알뜰거지", p_broke: false });
  });
});

describe("친구 코드", () => {
  it("모양 맞추기", () => {
    expect(normalizeCode("geoji-7k3p9q")).toBe("GEOJI-7K3P9Q");
    expect(normalizeCode(" 7K3P9Q ")).toBe("GEOJI-7K3P9Q");
    expect(normalizeCode("GEOJI7K3P9Q")).toBe("GEOJI-7K3P9Q");
    expect(normalizeCode("GEOJI-7K3P")).toBeNull();
    expect(normalizeCode("GEOJI-0O1I23")).toBeNull(); // 헷갈리는 글자(0, O, 1, I)는 안 써요
  });
});

describe("순위", () => {
  const S = "2026-11-02";
  const r = (code: string, pct: number | null, season: string | null = S, nickname = code) => ({ code, nickname, season, pct, grade: null, broke: false });
  it("높은 순, 같은 퍼센트는 같은 등수, 그다음 기록 없음, 집계 전", () => {
    const out = rankRows([r("a", 61), r("b", 92), r("c", null), r("d", 92), r("e", 80, "2026-10-19"), r("f", 22)], S);
    expect(out.map((x) => [x.code, x.rank, x.state])).toEqual([
      ["b", 1, "ranked"], ["d", 1, "ranked"], ["a", 3, "ranked"], ["f", 4, "ranked"], ["c", null, "nolog"], ["e", null, "pending"],
    ]);
  });
});
