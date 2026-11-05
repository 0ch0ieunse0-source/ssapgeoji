import { useEffect, useState } from "react";
import { Icon } from "../components/common";
import { noticeNav } from "../components/Shell";
import { dOf, md } from "../lib/date";
import { markNoticesSeen, NOTICES, readNoticeSeen, unreadCount } from "../notices";
import { useApp } from "../state/app";

/** 공지사항 페이지. 열면 읽은 걸로 저장하지만, 이번에 볼 때는 새 소식 표시를 그대로 보여줘요. */
export function NoticeView() {
  const { go } = useApp();
  const [unread] = useState(() => unreadCount(NOTICES, readNoticeSeen()));
  useEffect(() => {
    markNoticesSeen();
    document.getElementById("noticeTitle")?.focus();
  }, []);
  const back = () => {
    if (noticeNav.fromApp) {
      noticeNav.fromApp = false;
      history.back();
    } else go("home");
  };
  return (
    <div className="view">
      <div className="page-head">
        <button className="pbtn" aria-label="뒤로가기" onClick={back}>
          {Icon.prev}
        </button>
        <h1 id="noticeTitle" tabIndex={-1}>
          공지사항
        </h1>
      </div>
      {NOTICES.length === 0 && (
        <section className="card">
          <p className="hint">아직 공지가 없어요. 새 기능이 생기면 여기서 알려드릴게요.</p>
        </section>
      )}
      {NOTICES.map((n, i) => (
        <section key={n.id} className={"card notice" + (i < unread ? " unread" : "")} aria-labelledby={"n-" + n.id}>
          <div className="nhead">
            <span className="k">{md(dOf(n.date))}</span>
            {i < unread && <span className="badge">새 소식</span>}
          </div>
          <h2 id={"n-" + n.id}>{n.title}</h2>
          <ul>
            {n.body.map((line, k) => (
              <li key={k}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
