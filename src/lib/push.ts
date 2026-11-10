/**
 * 매일 알림(푸시). 서버로 가는 값은 buildPushPayload의 다섯 가지뿐이에요:
 * 이 폰으로 알림을 보내는 주소(endpoint)와 그 주소용 공개 열쇠 두 개, 알림 시각, 시간대.
 * 금액·기록·메모·이름은 보내지 않아요 (push.test.ts가 지켜요).
 */
/** 알림 시각: 모두 저녁 8시 (따로 고르지 않아요) */
export const PUSH_HOUR = 20;
/** 홈 팝업에서 [나중에]를 누르면 이만큼 지나서 한 번 더 물어봐요 */
export const PUSH_ASK_SNOOZE_DAYS = 14;

export interface PushKeys {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function buildPushPayload(sub: PushKeys, hour: number, tzMin: number) {
  return {
    p_endpoint: String(sub.endpoint),
    p_p256dh: String(sub.keys.p256dh),
    p_auth: String(sub.keys.auth),
    p_hour: Math.min(23, Math.max(0, Math.round(hour))),
    p_tz: Math.round(tzMin),
  };
}

/** 공개 키 글자(base64url) → 브라우저가 받는 바이트 */
export function keyBytes(b64url: string): Uint8Array {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushSupport = "ok" | "install" | "ios-old" | "no";

/** 이 화면에서 알림을 켤 수 있는지. 아이폰은 iOS 16.4 이상, 홈 화면에 추가한 앱에서만 돼요 */
export function pushSupport(o: { ua: string; standalone: boolean; hasPush: boolean; hasSW: boolean; hasNotif: boolean }): PushSupport {
  const ios = /iPhone|iPad|iPod/.test(o.ua) || (/Macintosh/.test(o.ua) && /Mobile/.test(o.ua));
  if (ios) {
    const m = o.ua.match(/OS (\d+)_(\d+)/);
    const v = m ? +m[1] + +m[2] / 100 : 0;
    if (v && v < 16.04) return "ios-old";
    if (!o.standalone) return "install";
  }
  return o.hasPush && o.hasSW && o.hasNotif ? "ok" : ios ? "install" : "no";
}

export const hourLabel = (h: number) => (h < 12 ? "오전 " + (h || 12) : "저녁 " + (h === 12 ? 12 : h - 12)) + "시";

/** 홈에 '알림 받을까요?' 팝업을 띄울지: 받을 수 있는 화면이고, 아직 안 켰고, 거절하지 않았고, [나중에] 뒤 2주가 지났을 때 */
export function shouldAskPush(o: { support: PushSupport; permission: string; on: boolean; snoozedOn: string | null; today: string }): boolean {
  if (o.support !== "ok" || o.on || o.permission === "denied") return false;
  if (!o.snoozedOn) return true;
  const days = (Date.parse(o.today) - Date.parse(o.snoozedOn)) / 864e5;
  return days >= PUSH_ASK_SNOOZE_DAYS;
}
