import { describe, expect, it } from "vitest";
import { merge3, mergeOnLogin } from "./merge";
import { deriveKeys, newDataKey, newSalt, normalizeId, seal, unseal, unwrapDataKey, validId, validPassword, wrapDataKey } from "./vault";

const ITER = 1000; // 테스트는 빠르게 (앱은 60만 번)

describe("기록 잠그기", () => {
  const data = { settings: { name: "지민", total: 512345 }, days: { "2026-11-05": { items: [{ id: "a", amount: 7300, memo: "비밀메모김밥" }] } } };

  it("잠근 기록에는 금액·메모·이름이 그대로 들어 있지 않아요", async () => {
    const dk = newDataKey();
    const blob = await seal(data, dk);
    for (const s of ["512345", "7300", "비밀메모김밥", "지민", "memo", "amount"]) expect(blob).not.toContain(s);
    expect(atob(blob)).not.toContain("7300");
    expect(await unseal(blob, dk)).toEqual(data);
  });

  it("같은 기록도 잠글 때마다 다른 글자가 돼요", async () => {
    const dk = newDataKey();
    expect(await seal(data, dk)).not.toBe(await seal(data, dk));
  });

  it("다른 열쇠로는 못 열어요", async () => {
    const blob = await seal(data, newDataKey());
    await expect(unseal(blob, newDataKey())).rejects.toBeTruthy();
  });

  it("비밀번호가 맞으면 기록 열쇠를 다시 꺼낼 수 있고, 틀리면 못 꺼내요", async () => {
    const salt = newSalt();
    const dk = newDataKey();
    const ok = await deriveKeys("geoji-pass-1", salt, ITER);
    const wrapped = await wrapDataKey(dk, ok.kek);
    expect(await unwrapDataKey(wrapped, (await deriveKeys("geoji-pass-1", salt, ITER)).kek)).toBe(dk);
    await expect(unwrapDataKey(wrapped, (await deriveKeys("geoji-pass-2", salt, ITER)).kek)).rejects.toBeTruthy();
  });

  it("서버로 가는 출입증은 비밀번호와 다르고, 비밀번호·열쇠를 담고 있지 않아요", async () => {
    const salt = newSalt();
    const a = await deriveKeys("geoji-pass-1", salt, ITER);
    expect(a.auth).toMatch(/^[0-9a-f]{64}$/);
    expect(a.auth).not.toContain("geoji");
    expect((await deriveKeys("geoji-pass-1", salt, ITER)).auth).toBe(a.auth);
    expect((await deriveKeys("geoji-pass-1", newSalt(), ITER)).auth).not.toBe(a.auth);
  });

  it("아이디·비밀번호 규칙", () => {
    expect(normalizeId("  JiMin_01 ")).toBe("jimin_01");
    expect(validId("jimin_01")).toBe(true);
    expect(validId("jm")).toBe(false);
    expect(validId("지민")).toBe(false);
    expect(validPassword("1234567")).toBe(false);
    expect(validPassword("12345678")).toBe(true);
  });
});

describe("두 기기 기록 합치기", () => {
  const it0 = (id: string, amount: number) => ({ id, amount, memo: id, cat: "식비", pay: "check", t: 1 });
  const base = {
    settings: { total: 400000, appts: ["2026-11-10"], name: "지민" },
    days: { "2026-11-05": { items: [it0("a", 1000), it0("b", 2000)], limit: null, noSpend: false } },
    wish: { items: [] as unknown[] },
  };
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

  it("두 기기에서 따로 적은 기록이 둘 다 남아요", () => {
    const l = clone(base), r = clone(base);
    l.days["2026-11-05"].items.push(it0("c", 3000));
    r.days["2026-11-05"].items.push(it0("d", 4000));
    (r.days as Record<string, unknown>)["2026-11-06"] = { items: [it0("e", 5000)], limit: null, noSpend: false };
    const m = merge3(base, l, r);
    expect(m.days["2026-11-05"].items.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
    expect((m.days as Record<string, { items: { id: string }[] }>)["2026-11-06"].items[0].id).toBe("e");
  });

  it("한쪽에서 지운 기록은 다른 쪽이 그대로면 지워져요", () => {
    const l = clone(base), r = clone(base);
    l.days["2026-11-05"].items = l.days["2026-11-05"].items.filter((x) => x.id !== "a");
    r.settings.total = 500000;
    const m = merge3(base, l, r);
    expect(m.days["2026-11-05"].items.map((x) => x.id)).toEqual(["b"]);
    expect(m.settings.total).toBe(500000);
  });

  it("한쪽은 지우고 다른 쪽은 고쳤으면 고친 걸 살려요 (사라지지 않게)", () => {
    const l = clone(base), r = clone(base);
    l.days["2026-11-05"].items = [];
    r.days["2026-11-05"].items[0].amount = 1500;
    const m = merge3(base, l, r);
    expect(m.days["2026-11-05"].items).toEqual([{ ...it0("a", 1500) }]);
  });

  it("같은 칸을 둘 다 바꿨으면 이 폰 쪽, 다른 칸은 각자 바꾼 대로", () => {
    const l = clone(base), r = clone(base);
    l.settings.total = 450000;
    r.settings.total = 480000;
    r.settings.name = "지민2";
    const m = merge3(base, l, r);
    expect(m.settings).toEqual({ total: 450000, appts: ["2026-11-10"], name: "지민2" });
  });

  it("약속 날짜는 양쪽 추가를 다 살리고, 지운 건 지워요", () => {
    const l = clone(base), r = clone(base);
    l.settings.appts = ["2026-11-10", "2026-11-20"];
    r.settings.appts = ["2026-11-25"];
    expect(merge3(base, l, r).settings.appts).toEqual(["2026-11-20", "2026-11-25"]);
  });

  it("처음 합칠 때(base 없음)는 아무것도 지우지 않아요", () => {
    const l = clone(base), r = clone(base);
    l.days["2026-11-05"].items = [it0("a", 1000)];
    r.days["2026-11-05"].items = [it0("b", 2000)];
    const m = merge3(undefined, l, r);
    expect(m.days["2026-11-05"].items.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("로그인할 때: 같은 칸이 다르면 서버 값, 기록은 양쪽 다 남아요", () => {
    const stale = clone(base), server = clone(base);
    stale.settings.total = 300000; // 이 기기에 남은 옛 값
    server.settings.total = 600000; // 다른 기기에서 고친 새 값
    stale.days["2026-11-05"].items.push(it0("x", 100));
    server.days["2026-11-05"].items.push(it0("y", 200));
    const m = mergeOnLogin(stale, server);
    expect(m.settings.total).toBe(600000);
    expect(m.days["2026-11-05"].items.map((x) => x.id).sort()).toEqual(["a", "b", "x", "y"]);
  });
});
