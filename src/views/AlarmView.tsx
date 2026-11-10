import { useState } from "react";
import { PageHead } from "../components/PageHead";
import { useApp } from "../state/app";
import { currentSupport, loadPush, turnOff, turnOn } from "../state/push";

/** 마이페이지 → 알림: 매일 저녁 8시에 '오늘 쓴 돈 정리했나요?' 알림 */
export function AlarmView() {
  const { toast, openGuide } = useApp();
  const [p, setP] = useState(loadPush);
  const [busy, setBusy] = useState(false);
  const support = currentSupport();
  const denied = typeof Notification !== "undefined" && Notification.permission === "denied";

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      toast("알림을 설정하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.", true);
    } finally {
      setBusy(false);
    }
  };
  const on = () =>
    run(async () => {
      const r = await turnOn();
      if (r === "denied") return toast("알림이 허용되지 않았어요. 폰 설정에서 거지노트 알림을 켜 주세요.", true);
      setP({ on: true });
      toast("매일 저녁 8시에 알려드릴게요.");
    });
  const off = () =>
    run(async () => {
      await turnOff();
      setP({ on: false });
      toast("매일 알림을 껐어요.");
    });

  return (
    <div className="view">
      <PageHead title="알림" fallback="setup" />
      <section className="card setup-sec">
        <span className="step">매일 정리 알림</span>
        <p className="hint">매일 저녁 8시에 "오늘 쓴 돈 정리했나요?" 알림을 보내드려요. 기록은 서버로 가지 않아서, 이미 정리한 날에도 알림이 가요.</p>

        {support === "ok" ? (
          <>
            {denied && !p.on && <p className="hint err">이 폰에서 거지노트 알림이 꺼져 있어요. 폰 설정 → 알림 → 거지노트에서 켜 주세요.</p>}
            {p.on ? (
              <button className="btn line" disabled={busy} onClick={off}>
                {busy ? "바꾸는 중…" : "알림 끄기"}
              </button>
            ) : (
              <button className="btn" disabled={busy} onClick={on}>
                {busy ? "켜는 중…" : "매일 저녁 8시에 알림 받기"}
              </button>
            )}
            {p.on && <p className="hint">켜져 있어요 · 매일 저녁 8시</p>}
          </>
        ) : support === "install" ? (
          <>
            <p className="hint">아이폰은 홈 화면에 추가한 거지노트에서만 알림을 받을 수 있어요. 홈 화면에 추가한 뒤, 그 아이콘으로 열어서 여기서 켜 주세요.</p>
            <button className="btn line" onClick={() => openGuide(true)}>
              홈 화면에 추가하는 법
            </button>
            <p className="hint">홈 화면 앱은 Safari와 기록이 따로예요. 옮기려면 계정에 로그인하거나 백업 파일을 써 주세요.</p>
          </>
        ) : support === "ios-old" ? (
          <p className="hint">알림은 iOS 16.4 이상에서 받을 수 있어요. 설정 → 일반 → 소프트웨어 업데이트에서 iOS를 올려 주세요.</p>
        ) : (
          <p className="hint">이 브라우저는 알림을 지원하지 않아요. 아이폰은 Safari, 안드로이드는 Chrome에서 열어 주세요.</p>
        )}
      </section>
      <p className="hint" style={{ padding: "0 4px" }}>
        서버에는 이 폰으로 알림을 보낼 주소와 알림 시간만 저장돼요. 금액·기록은 보내지 않아요.
      </p>
    </div>
  );
}
