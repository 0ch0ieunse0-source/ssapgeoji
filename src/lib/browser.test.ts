import { describe, expect, it } from "vitest";
import { detectBrowser } from "./browser";

const IOS_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IOS_KAKAO = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5";
const IOS_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1";
const IOS_INSTA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 354.0.0.30.98";
const AND_CHROME = "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const AND_KAKAO = "Mozilla/5.0 (Linux; Android 14; SM-S921N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36;KAKAOTALK 2410850";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";

describe("detectBrowser", () => {
  it("아이폰 Safari", () => expect(detectBrowser(IOS_SAFARI)).toEqual({ os: "ios", inApp: null, safari: true, standalone: false }));
  it("아이폰 카카오톡 안", () => expect(detectBrowser(IOS_KAKAO)).toMatchObject({ os: "ios", inApp: "kakao", safari: false }));
  it("아이폰 인스타그램 안", () => expect(detectBrowser(IOS_INSTA)).toMatchObject({ inApp: "instagram", safari: false }));
  it("아이폰 Chrome은 Safari가 아니에요", () => expect(detectBrowser(IOS_CHROME)).toMatchObject({ os: "ios", inApp: null, safari: false }));
  it("안드로이드 Chrome", () => expect(detectBrowser(AND_CHROME)).toMatchObject({ os: "android", inApp: null, safari: false }));
  it("안드로이드 카카오톡 안", () => expect(detectBrowser(AND_KAKAO)).toMatchObject({ os: "android", inApp: "kakao" }));
  it("아이패드(데스크톱 모드)는 터치로 구분", () => {
    expect(detectBrowser(IPAD, true)).toMatchObject({ os: "ios", safari: true });
    expect(detectBrowser(IPAD, false)).toMatchObject({ os: "other", safari: false });
  });
  it("홈 화면 앱", () => expect(detectBrowser(IOS_SAFARI, false, true).standalone).toBe(true));
});
