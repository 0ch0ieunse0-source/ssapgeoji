import { describe, expect, it } from "vitest";
import { buildPushPayload, hourLabel, keyBytes, PUSH_DEFAULT_HOUR, pushSupport } from "./push";

describe("매일 알림: 서버로 가는 값", () => {
  it("알림 주소·열쇠·시각·시간대만 보내요 (기록·금액 없음)", () => {
    const sub = { endpoint: "https://push.example/abc", keys: { p256dh: "P", auth: "A" }, extra: { amount: 5000 } } as never;
    const p = buildPushPayload(sub, 20, -540);
    expect(Object.keys(p).sort()).toEqual(["p_auth", "p_endpoint", "p_hour", "p_p256dh", "p_tz"]);
    expect(JSON.stringify(p)).not.toMatch(/amount|memo|5000/);
    expect(p.p_hour).toBe(20);
    expect(p.p_tz).toBe(-540);
  });
  it("시각은 0~23으로 맞춰요", () => {
    const sub = { endpoint: "https://x", keys: { p256dh: "P", auth: "A" } };
    expect(buildPushPayload(sub, 99, 0).p_hour).toBe(23);
    expect(buildPushPayload(sub, -3, 0).p_hour).toBe(0);
  });
  it("기본 시간은 저녁 8시", () => {
    expect(PUSH_DEFAULT_HOUR).toBe(20);
    expect(hourLabel(20)).toBe("저녁 8시");
  });
  it("공개 키를 바이트로", () => {
    expect(Array.from(keyBytes("AQID"))).toEqual([1, 2, 3]);
  });
});

describe("알림을 켤 수 있는 화면", () => {
  const base = { hasPush: true, hasSW: true, hasNotif: true };
  const iphone = (v: string) => "Mozilla/5.0 (iPhone; CPU iPhone OS " + v + " like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
  it("아이폰 Safari는 홈 화면에 추가해야 해요", () => {
    expect(pushSupport({ ...base, ua: iphone("17_2"), standalone: false, hasPush: false })).toBe("install");
    expect(pushSupport({ ...base, ua: iphone("17_2"), standalone: true })).toBe("ok");
  });
  it("iOS 16.4 미만은 안 돼요", () => {
    expect(pushSupport({ ...base, ua: iphone("15_7"), standalone: true })).toBe("ios-old");
    expect(pushSupport({ ...base, ua: iphone("16_3"), standalone: true })).toBe("ios-old");
    expect(pushSupport({ ...base, ua: iphone("16_4"), standalone: true })).toBe("ok");
  });
  it("안드로이드 크롬은 그대로 돼요, 지원 안 하면 no", () => {
    const and = "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile";
    expect(pushSupport({ ...base, ua: and, standalone: false })).toBe("ok");
    expect(pushSupport({ ...base, ua: and, standalone: false, hasPush: false })).toBe("no");
  });
});
