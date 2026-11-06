import { useState } from "react";
import { currentUnread, markNoticeRead, NOTICES } from "../notices";
import { useApp } from "../state/app";
import { Icon } from "./common";
import { Sheet } from "./Sheet";

const KEY = "ssapgeoji-whatsnew"; // 마지막으로 팝업을 띄운 공지 id
const shownId = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return "";
  }
};

/** 업데이트 안내 팝업: 새 공지가 있으면 앱을 열 때 한 번 보여줘요. (처음 쓰는 사람·사용법 안내 중에는 안 떠요) */
export function WhatsNew() {
  const { model, guide, route, entry, dayKey, go } = useApp();
  const latest = NOTICES[0];
  const [done, setDone] = useState(() => !latest || shownId() === latest.id);
  const open =
    !done && !!model && !guide.open && !entry.open && !dayKey && route !== "setup" && route !== "notice" && currentUnread().includes(latest.id);
  const close = (detail: boolean) => {
    try {
      localStorage.setItem(KEY, latest.id);
    } catch {
      /* 저장이 막혀 있으면 이번에만 닫혀요 */
    }
    setDone(true);
    if (detail) go(`notice/${latest.id}`);
    else markNoticeRead(latest.id);
  };
  if (!latest) return null;
  return (
    <Sheet open={open} onClose={() => close(false)} labelledBy="wnTitle" center>
      <div className="wn">
        <div className="wn-badge">
          {Icon.check}
          업데이트됐어요
        </div>
        <h2 id="wnTitle">{latest.title}</h2>
        <ul>
          {latest.body.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <div className="wn-acts">
          <button className="btn gray" onClick={() => close(true)}>
            자세히 보기
          </button>
          <button className="btn" onClick={() => close(false)}>
            확인
          </button>
        </div>
      </div>
    </Sheet>
  );
}
