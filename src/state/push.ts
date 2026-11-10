/**
 * 매일 알림 켜고 끄기. 이 폰(이 브라우저)마다 따로예요.
 * 서버로 가는 값은 lib/push.ts의 buildPushPayload뿐이에요 (알림 주소·열쇠·시각·시간대).
 */
import { buildPushPayload, keyBytes, PUSH_HOUR, pushSupport, type PushKeys, type PushSupport } from "../lib/push";
import { VAPID_PUBLIC_KEY } from "../pushConfig";
import { rankEnabled } from "../rankConfig";
import { rpc } from "./rank";

const KEY = "ssapgeoji-push";
export interface PushLocal {
  on: boolean;
}

export const pushEnabled = () => !!VAPID_PUBLIC_KEY && rankEnabled();

export function loadPush(): PushLocal {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v === "object") return { on: !!v.on };
  } catch {
    /* 읽지 못하면 꺼진 걸로 */
  }
  return { on: false };
}
function savePush(p: PushLocal) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* 저장이 막혀 있으면 다음에 다시 켜요 */
  }
}

const standalone = () =>
  (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches) || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const currentSupport = (): PushSupport =>
  pushSupport({
    ua: navigator.userAgent,
    standalone: standalone(),
    hasPush: typeof window !== "undefined" && "PushManager" in window,
    hasSW: "serviceWorker" in navigator,
    hasNotif: typeof Notification !== "undefined",
  });

/** 앱을 열 때 알림 받는 일꾼(서비스 워커)을 등록해요. 화면 파일은 저장하지 않아서 업데이트에 영향 없어요 */
export function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(() => {
    /* 등록이 안 되면 알림만 못 받아요 */
  });
}

async function subscription(create: boolean): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  const cur = await reg.pushManager.getSubscription();
  if (cur || !create) return cur;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) as BufferSource });
}

const send = (sub: PushSubscription) => rpc("geoji_push_sub", buildPushPayload(sub.toJSON() as PushKeys, PUSH_HOUR, -new Date().getTimezoneOffset()));

/** 켜기: 꼭 버튼을 누른 순간에 불러야 해요 (아이폰은 그때만 허락을 물어볼 수 있어요) */
export async function turnOn(): Promise<"on" | "denied"> {
  const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const sub = await subscription(true);
  if (!sub) throw new Error("알림 주소를 만들지 못했어요.");
  await send(sub);
  savePush({ on: true });
  return "on";
}

export async function turnOff() {
  const sub = await subscription(false).catch(() => null);
  if (sub) {
    await rpc("geoji_push_unsub", { p_endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  savePush({ on: false });
}

// 홈 팝업 [나중에]
const ASK_KEY = "ssapgeoji-push-ask";
export function askSnoozedOn(): string | null {
  try {
    return localStorage.getItem(ASK_KEY);
  } catch {
    return null;
  }
}
export function snoozeAsk(today: string) {
  try {
    localStorage.setItem(ASK_KEY, today);
  } catch {
    /* 저장이 막혀 있으면 다음에 또 물어봐요 */
  }
}

/** 앱을 열 때: 알림을 켜 뒀으면 서버의 알림 주소를 새로 맞춰요 (브라우저가 주소를 바꾸는 일이 있어서) */
export async function refreshPush() {
  const p = loadPush();
  if (!p.on || !pushEnabled() || currentSupport() !== "ok" || Notification.permission !== "granted") return;
  try {
    const sub = await subscription(true);
    if (sub) await send(sub);
  } catch {
    /* 다음에 열 때 다시 해요 */
  }
}
