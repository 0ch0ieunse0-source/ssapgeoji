/** 지금 어떤 브라우저로 열었는지 (Safari 안내용) */
export type InApp = "kakao" | "instagram" | "naver" | "facebook" | "line" | "band" | "other";
export interface BrowserEnv {
  os: "ios" | "android" | "other";
  inApp: InApp | null; // 카카오톡처럼 다른 앱 안에서 열린 브라우저
  safari: boolean; // 아이폰 Safari 그 자체
  standalone: boolean; // 홈 화면 아이콘으로 열었는지
}

export const IN_APP_NAME: Record<InApp, string> = {
  kakao: "카카오톡",
  instagram: "인스타그램",
  naver: "네이버 앱",
  facebook: "페이스북",
  line: "라인",
  band: "밴드",
  other: "다른 앱",
};

/** ua: navigator.userAgent, touchMac: 터치되는 Mac(=iPad), standalone: 홈 화면 앱 여부 */
export function detectBrowser(ua: string, touchMac = false, standalone = false): BrowserEnv {
  const ios = /iPhone|iPad|iPod/i.test(ua) || (touchMac && /Macintosh/i.test(ua));
  const android = /Android/i.test(ua);
  let inApp: InApp | null = null;
  if (/KAKAOTALK/i.test(ua)) inApp = "kakao";
  else if (/Instagram/i.test(ua)) inApp = "instagram";
  else if (/NAVER\(inapp|NAVER/i.test(ua) && !/Whale/i.test(ua)) inApp = "naver";
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) inApp = "facebook";
  else if (/\bLine\//i.test(ua)) inApp = "line";
  else if (/BAND\//i.test(ua)) inApp = "band";
  else if (android && /; wv\)/i.test(ua)) inApp = "other";
  const otherIosBrowser = /CriOS|FxiOS|EdgiOS|Whale|OPiOS|YaBrowser|DuckDuckGo/i.test(ua);
  return {
    os: ios ? "ios" : android ? "android" : "other",
    inApp,
    safari: ios && !inApp && !otherIosBrowser && /Safari/i.test(ua),
    standalone,
  };
}

/** 카카오톡 안에서 열렸을 때 바깥 브라우저(아이폰은 Safari)로 여는 주소 */
export const kakaoExternal = (url: string) => "kakaotalk://web/openExternal?url=" + encodeURIComponent(url);
