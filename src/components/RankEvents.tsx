import { useEffect, useMemo, useRef, useState } from "react";
import { sd } from "../lib/date";
import { buildReveal, lineOf, type RankedRow } from "../lib/rank";
import type { Period } from "../lib/types";
import { useApp } from "../state/app";
import { fetchInbox, type InboxItem, type RankLocal } from "../state/rank";
import { Sheet, SheetHead } from "./Sheet";

const REVEAL_KEY = "ssapgeoji-reveal";
const MASCOT = import.meta.env.BASE_URL + "mascot.png";
const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* 저장이 막혀 있으면 다음에 다시 보여줘요 */
  }
};

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 2.2 + Math.random() * 1.6,
        rot: Math.random() * 360,
        color: ["var(--accent-l)", "var(--c1)", "var(--c3)", "var(--c5)", "var(--c6)", "#f5c542"][i % 6],
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ left: b.left + "%", animationDelay: b.delay + "s", animationDuration: b.dur + "s", background: b.color, transform: `rotate(${b.rot}deg)` }} />
      ))}
    </div>
  );
}

const names = (rows: RankedRow[]) => rows.map((r) => r.nickname).join(", ");

/** 발표 후 첫 실행 때 결과 발표 연출 → 그다음 받은 응원·콕 */
export function RankEvents({ local, rows, season, failed }: { local: RankLocal; rows: RankedRow[] | null; season: Period; failed: boolean }) {
  const { go } = useApp();
  const reveal = useMemo(() => (rows ? buildReveal(rows, local.code) : null), [rows, local.code]);
  const [revealOpen, setRevealOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (reveal && get(REVEAL_KEY) !== season.start) setRevealOpen(true);
  }, [reveal, season.start]);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    fetchInbox(local)
      .then((items) => items?.length && setInbox(items))
      .catch(() => {
        /* 응원 기능 SQL을 아직 안 넣었거나 인터넷이 없으면 조용히 넘어가요 */
      });
  }, [local]);

  // 받은 응원은 발표 연출을 볼지 정해지고, 연출을 닫은 다음에 보여줘요 (겹치지 않게)
  const decided = rows !== null || failed;
  const revealPending = !!reveal && get(REVEAL_KEY) !== season.start;
  useEffect(() => {
    if (inbox.length && decided && !revealOpen && !revealPending) setInboxOpen(true);
  }, [inbox.length, decided, revealOpen, revealPending]);

  const closeReveal = () => {
    set(REVEAL_KEY, season.start);
    setRevealOpen(false);
  };

  const meFirst = reveal?.me?.rank === 1;
  const cheers = inbox.filter((x) => x.kind === "cheer").length;
  const pokes = inbox.length - cheers;

  return (
    <>
      {revealOpen && reveal && (
        <div className="reveal" role="dialog" aria-modal="true" aria-labelledby="revealTitle">
          {opened && <Confetti />}
          <div className="reveal-card">
            <img src={MASCOT} alt="" width={140} height={115} />
            <span className="k">{sd(season.start) + "~" + sd(season.end) + " 시즌 결과"}</span>
            {!opened ? (
              <>
                <h2 id="revealTitle">결과가 나왔어요!</h2>
                <button className="btn" onClick={() => setOpened(true)}>
                  결과 확인하기
                </button>
                <button className="link" onClick={closeReveal}>
                  나중에 볼게요
                </button>
              </>
            ) : (
              <>
                {meFirst ? (
                  <div className="rv top">
                    <h2 id="revealTitle">🎉 축하해요! 이번 시즌 1등이에요</h2>
                    <b className="rv-big">{reveal.me!.grade + " · " + reveal.me!.pct + "%"}</b>
                    <span>{lineOf(reveal.me!.grade, reveal.me!.broke)}</span>
                  </div>
                ) : reveal.total === 1 && reveal.me ? (
                  <div className="rv top">
                    <h2 id="revealTitle">{"이번 시즌 나는 " + reveal.me.grade + "!"}</h2>
                    <b className="rv-big">{reveal.me.pct + "%"}</b>
                    <span>{lineOf(reveal.me.grade, reveal.me.broke)}</span>
                  </div>
                ) : (
                  <div className="rv top">
                    <span className="k" id="revealTitle">
                      이번 시즌 1등은
                    </span>
                    <b className="rv-big">{names(reveal.top) + "!"}</b>
                    <span>{reveal.top[0].grade + " · " + reveal.top[0].pct + "%"}</span>
                    <span className="k">{lineOf(reveal.top[0].grade, reveal.top[0].broke)}</span>
                  </div>
                )}
                {reveal.me && !meFirst && reveal.total > 1 && reveal.last?.code !== reveal.me.code && (
                  <div className="rv">
                    <b>{"나는 " + reveal.total + "명 중 " + reveal.me.rank + "등"}</b>
                    <span>{reveal.me.grade + " · " + reveal.me.pct + "%" + (reveal.me.broke ? "  💀 파산" : "")}</span>
                    <span className="k">{lineOf(reveal.me.grade, reveal.me.broke)}</span>
                  </div>
                )}
                {reveal.me && meFirst && reveal.total > 1 && <div className="rv"><span className="k">{reveal.total + "명 중 1등이에요."}</span></div>}
                {reveal.last && (
                  <div className="rv last">
                    <b>{reveal.last.code === local.code ? "꼴찌는… 나예요 ㅠㅠ" : "꼴찌 " + reveal.last.nickname + "…"}</b>
                    <span>{reveal.last.grade + " · " + reveal.last.pct + "%" + (reveal.last.broke ? "  💀 파산" : "")}</span>
                    <span className="k">{lineOf(reveal.last.grade, reveal.last.broke)}</span>
                  </div>
                )}
                <div className="row">
                  <button className="btn line" style={{ flex: 1 }} onClick={closeReveal}>
                    닫기
                  </button>
                  <button
                    className="btn"
                    style={{ flex: 1 }}
                    onClick={() => {
                      closeReveal();
                      go("rank");
                    }}
                  >
                    랭킹 보기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <Sheet open={inboxOpen} onClose={() => setInboxOpen(false)} labelledBy="inboxTitle">
        <SheetHead
          id="inboxTitle"
          title={cheers && pokes ? "응원과 콕이 왔어요" : cheers ? "👏 응원이 왔어요" : "👉 콕 찔렸어요"}
          onClose={() => setInboxOpen(false)}
        />
        <ul className="tx inbox">
          {inbox.map((x, i) => (
            <li key={i}>
              <span className="ico" aria-hidden="true" style={{ background: "var(--accent-soft)" }}>
                {x.kind === "cheer" ? "👏" : "👉"}
              </span>
              <span className="t">
                <b>{x.from_nickname + (x.kind === "cheer" ? "님이 응원했어요" : "님이 콕 찔렀어요")}</b>
                <span className={x.memo ? "memo" : undefined}>{x.memo ? "“" + x.memo + "”" : x.kind === "cheer" ? "잘하고 있어요! 이대로 쭉" : "오늘도 한도 지켜요!"}</span>
              </span>
              <span className="a" />
            </li>
          ))}
        </ul>
        <button className="btn" onClick={() => setInboxOpen(false)}>
          확인
        </button>
      </Sheet>
    </>
  );
}
