import { useEffect, useState } from "react";
import { shouldAskPush } from "../lib/push";
import { useApp } from "../state/app";
import { askSnoozedOn, currentSupport, loadPush, pushEnabled, snoozeAsk, turnOn } from "../state/push";
import { Sheet } from "./Sheet";

/**
 * 홈을 열면 '매일 저녁 8시에 알려드릴까요?'를 물어봐요.
 * 웹앱은 버튼을 누른 순간에만 폰의 '허용' 창을 띄울 수 있어서, [알림 받기]를 누르면 바로 허용 창이 떠요.
 * 받을 수 없는 화면(아이폰 Safari·iOS 16.4 미만), 이미 켠 사람, 거절한 사람에겐 띄우지 않아요. [나중에]는 2주 뒤 다시.
 */
export function PushPrompt() {
  const { route, today, toast, guide, model } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!model || route !== "home" || guide.open || !pushEnabled()) return;
    const t = window.setTimeout(() => {
      // 다른 창(업데이트 소식 등)이 떠 있으면 이번엔 묻지 않아요
      if (document.querySelector(".scrim:not([hidden])")) return;
      const ask = shouldAskPush({
        support: currentSupport(),
        permission: typeof Notification === "undefined" ? "default" : Notification.permission,
        on: loadPush().on,
        snoozedOn: askSnoozedOn(),
        today,
      });
      if (ask) setOpen(true);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [route, guide.open, !!model, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const later = () => {
    snoozeAsk(today);
    setOpen(false);
  };
  const yes = async () => {
    setBusy(true);
    try {
      const r = await turnOn();
      setOpen(false);
      if (r === "denied") {
        snoozeAsk(today);
        toast("알림이 허용되지 않았어요. 나중에 켜려면 폰 설정 → 알림 → 거지노트에서 켜 주세요.", true);
      } else toast("매일 저녁 8시에 알려드릴게요.");
    } catch {
      toast("알림을 켜지 못했어요. 마이페이지 → 알림에서 다시 눌러 주세요.", true);
      snoozeAsk(today);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={later} labelledBy="pushAskTitle" center>
      <div className="push-ask">
        <div className="push-ask-ic" aria-hidden="true">
          🔔
        </div>
        <h2 id="pushAskTitle">매일 저녁 8시에 알려드릴까요?</h2>
        <p className="hint">오늘 쓴 돈 정리할 때가 되면 알림을 보내드려요. 기록이나 금액은 서버로 가지 않아요.</p>
        <button className="btn" disabled={busy} onClick={yes}>
          {busy ? "켜는 중…" : "알림 받기"}
        </button>
        <button className="btn line" disabled={busy} onClick={later}>
          나중에
        </button>
      </div>
    </Sheet>
  );
}
