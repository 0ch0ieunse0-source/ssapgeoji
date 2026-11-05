import { useEffect, useState } from "react";
import { Icon } from "../components/common";
import { PageHead } from "../components/PageHead";
import { dOf, md } from "../lib/date";
import { currentUnread, markNoticeRead, NOTICES } from "../notices";
import { useApp } from "../state/app";

/** 공지사항: id가 없으면 목록, 있으면 상세. 상세를 열면 그 공지만 읽음으로 저장해요. */
export function NoticeView({ id }: { id: string }) {
  return id ? <NoticeDetail id={id} /> : <NoticeList />;
}

function NoticeList() {
  const { go } = useApp();
  const unread = currentUnread();
  return (
    <div className="view">
      <PageHead title="공지사항" fallback="home" />
      {NOTICES.length === 0 ? (
        <section className="card">
          <p className="hint">아직 공지가 없어요. 새 기능이 생기면 여기서 알려드릴게요.</p>
        </section>
      ) : (
        <section className="card menu" aria-label="공지 목록">
          {NOTICES.map((n) => {
            const isNew = unread.includes(n.id);
            return (
              <button key={n.id} className="menu-row" onClick={() => go(`notice/${n.id}`)}>
                <span className="mt">
                  <span>{md(dOf(n.date))}</span>
                  <b>{n.title}</b>
                </span>
                <span className="chev" aria-hidden="true">
                  {isNew && <span className="badge">새 소식</span>}
                  {Icon.next}
                </span>
                {isNew && <span className="sr-only">, 새 소식</span>}
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}

function NoticeDetail({ id }: { id: string }) {
  const n = NOTICES.find((x) => x.id === id);
  const [wasNew] = useState(() => currentUnread().includes(id));
  useEffect(() => {
    if (n) markNoticeRead(n.id);
  }, [n]);
  return (
    <div className="view">
      <PageHead title="공지사항" fallback="notice" />
      {!n ? (
        <section className="card">
          <p className="hint">찾을 수 없는 공지예요.</p>
        </section>
      ) : (
        <section className="card notice" aria-labelledby="noticeTitle2">
          <div className="nhead">
            <span className="k">{md(dOf(n.date))}</span>
            {wasNew && <span className="badge">새 소식</span>}
          </div>
          <h2 id="noticeTitle2">{n.title}</h2>
          <ul>
            {n.body.map((line, k) => (
              <li key={k}>{line}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
