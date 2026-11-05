import { useEffect, useState } from "react";
import { reloadUrl, shouldNotifyUpdate } from "../lib/update";

const DISMISS_KEY = "ssapgeoji-update-dismissed";
const readDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
};

/** 앱을 열거나 다시 볼 때 새 버전이 있는지 확인해서 아래에 작게 알려줘요 */
export function UpdateToast() {
  const [server, setServer] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const r = await fetch(import.meta.env.BASE_URL + "version.json?t=" + Date.now(), { cache: "no-store" });
        if (r.ok) setServer(((await r.json()) as { version?: string }).version || null);
      } catch {
        /* 인터넷이 없으면 다음에 다시 확인해요 */
      } finally {
        busy = false;
      }
    };
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    const iv = window.setInterval(check, 10 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.clearInterval(iv);
    };
  }, []);

  const show = shouldNotifyUpdate(server, __APP_VERSION__, dismissed);
  const keep = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, server || "");
    } catch {
      /* 저장이 막혀 있어도 이번에는 닫혀요 */
    }
    setDismissed(server);
  };
  return (
    <div className="update-toast" role="status" aria-live="polite" hidden={!show}>
      <span>새 버전이 있어요</span>
      <button className="ut-keep" onClick={keep}>
        그대로 사용
      </button>
      <button className="ut-go" onClick={() => location.replace(reloadUrl(location.pathname, location.hash, server || ""))}>
        새로고침
      </button>
    </div>
  );
}
