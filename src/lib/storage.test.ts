import { describe, expect, it } from "vitest";
import { EMPTY, normalize, parseStored, withDisk } from "./storage";

describe("normalize: 저장 데이터·백업 파일 맞추기", () => {
  it("이상한 값이면 빈 데이터", () => {
    expect(normalize(null, "2026-11-05")).toEqual(EMPTY());
    expect(normalize("hello", "2026-11-05")).toEqual(EMPTY());
  });
  it("예전 버전(기간 1회) 설정을 매달 반복으로 옮겨요", () => {
    const s = normalize({ settings: { start: "2026-03-10", end: "2026-04-09", total: 1, weekday: 10000, balance: 500000 } }, "2026-11-05").settings!;
    expect(s.cycleDay).toBe(10);
    expect(s.autoLimits).toBe(false);
    expect(s.balanceDate).toBe("2026-03-10");
    expect(s.firstStart).toBe("2026-03-10");
    expect("start" in s).toBe(false);
    expect("end" in s).toBe(false);
  });
  it("평일 한도가 없으면 자동 배분, 잔액 날짜가 없으면 오늘", () => {
    const s = normalize({ settings: { cycleDay: 25, total: 1, balance: 0 } }, "2026-11-05").settings!;
    expect(s.autoLimits).toBe(true);
    expect(s.balanceDate).toBe("2026-11-05");
    expect(s.firstStart).toBeNull();
  });
  it("모양이 틀린 부분은 빈 값으로", () => {
    const d = normalize({ settings: { cycleDay: 1 }, flows: { custom: "x" }, goal: { snaps: 1 }, wish: {}, savings: { moves: [{ id: "a" }] } }, "2026-11-05");
    expect(d.flows).toEqual({ over: {}, custom: [] });
    expect(d.goal).toEqual({ snaps: [] });
    expect(d.wish).toEqual({ items: [] });
    expect(d.savings.moves).toHaveLength(1);
  });
});

describe("다른 창(탭)과 합치기", () => {
  const today = "2026-11-09";
  const it_ = (id: string, amount: number) => ({ id, amount, memo: id, cat: "식비", pay: "check" as const, t: 1 });
  const base = normalize({ v: 2, settings: { cycleDay: 1, total: 500000 }, days: { "2026-11-02": { items: [it_("a", 1000)], limit: null, noSpend: false } } }, today);
  const lastRaw = JSON.stringify(base);
  const withItem = (d: typeof base, k: string, x: ReturnType<typeof it_>) => {
    const c = JSON.parse(JSON.stringify(d));
    c.days[k] = c.days[k] || { items: [], limit: null, noSpend: false };
    c.days[k].items.push(x);
    return c;
  };
  it("다른 창이 안 바꿨으면 이 창 기록 그대로", () => {
    const local = withItem(base, "2026-11-09", it_("b", 2000));
    expect(withDisk(base, local, lastRaw, lastRaw, today)).toBe(local);
  });
  it("다른 창이 그사이 적은 기록도 같이 살려요", () => {
    const other = withItem(base, "2026-11-09", it_("A", 1111));
    const local = withItem(base, "2026-11-09", it_("B", 2222));
    const out = withDisk(base, local, JSON.stringify(other), lastRaw, today);
    expect(out.days["2026-11-09"].items.map((x) => x.id).sort()).toEqual(["A", "B"]);
    expect(out.days["2026-11-02"].items).toHaveLength(1);
  });
  it("이 창에서 설정만 바꿔도 다른 창 기록이 지워지지 않아요", () => {
    const other = withItem(base, "2026-11-09", it_("A", 1111));
    const local = JSON.parse(JSON.stringify(base));
    local.settings.leftover = "spread";
    const out = withDisk(base, local, JSON.stringify(other), lastRaw, today);
    expect(out.days["2026-11-09"].items[0].id).toBe("A");
    expect(out.settings!.leftover).toBe("spread");
  });
  it("다른 창에서 지운 기록은 지워진 채로", () => {
    const other = JSON.parse(JSON.stringify(base));
    other.days["2026-11-02"].items = [];
    const out = withDisk(base, base, JSON.stringify(other), lastRaw, today);
    expect(out.days["2026-11-02"].items).toHaveLength(0);
  });
  it("저장소 글자가 깨졌으면 이 창 기록으로 (원본은 따로 보관)", () => {
    const local = withItem(base, "2026-11-09", it_("b", 2000));
    expect(withDisk(base, local, "{broken", lastRaw, today)).toBe(local);
  });
  it("깨진 글자는 읽지 못함(null), 빈 저장소는 빈 기록", () => {
    expect(parseStored('{"v":2,"settings":{"total":5', today)).toBeNull();
    expect(parseStored(null, today)!.settings).toBeNull();
  });
});
