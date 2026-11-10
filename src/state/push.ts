/**
 * 매일 알림 켜고 끄기. 이 폰(이 브라우저)마다 따로예요.
 * 서버로 가는 값은 lib/push.ts의 buildPushPayload뿐이에요 (알림 주소·열쇠·시각·시간대).
 */
import { buildPushPayload, keyBytes, PUSH_DEFAULT_HOUR, pushSupport, type PushKeys, type PushSupport } from "../lib/push";
import { VAPID_PUBLIC_KEY } from "../pushConfig";
import { rankEnabled } from "../rankConfig";
import { rpc } from "./rank";

const KEY = "ssapgeoji-push";
export interface PushLocal {
  on: boolean;
  hour: number;
}

export const pushEnabled = () => !!VAPID_PUBLIC_KEY && rankEnabled();

export function loadPush(): PushLocal {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v.hour === "number") return { on: !!v.on, hour: v.hour };
  } catch {
    /* 읽지 못하면 꺼진 걸로 */
  }
  return { on: false, hour: PUSH_DEFAULT_HOUR };
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

const send = (sub: PushSubscription, hour: number) =>
  rpc("geoji_push_sub", buildPushPayload(sub.toJSON() as PushKeys, hour, -new Date().getTimezoneOffset()));

/** 켜기: 꼭 버튼을 누른 순간에 불러야 해요 (아이폰은 그때만 허락을 물어볼 수 있어요) */
export async function turnOn(hour: number): Promise<"on" | "denied"> {
  const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const sub = await subscription(true);
  if (!sub) throw new Error("알림 주소를 만들지 못했어요.");
  await send(sub, hour);
  savePush({ on: true, hour });
  return "on";
}

export async function changeHour(hour: number) {
  const sub = await subscription(false);
  if (!sub) return turnOn(hour);
  await send(sub, hour);
  savePush({ on: true, hour });
  return "on" as const;
}

export async function turnOff(hour: number) {
  const sub = await subscription(false).catch(() => null);
  if (sub) {
    await rpc("geoji_push_unsub", { p_endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  savePush({ on: false, hour });
}

/** 앱을 열 때: 알림을 켜 뒀으면 서버의 알림 주소를 새로 맞춰요 (브라우저가 주소를 바꾸는 일이 있어서) */
export async function refreshPush() {
  const p = loadPush();
  if (!p.on || !pushEnabled() || currentSupport() !== "ok" || Notification.permission !== "granted") return;
  try {
    const sub = await subscription(true);
    if (sub) await send(sub, p.hour);
  } catch {
    /* 다음에 열 때 다시 해요 */
  }
}
