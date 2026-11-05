import { useEffect, useRef, useState } from "react";
import { MoneyInput, Won } from "../components/common";
import { Sheet } from "../components/Sheet";
import { catVar } from "../lib/cats";
import { dOf, DOW, md, sd } from "../lib/date";
import { parse, won } from "../lib/format";
import { getDay, isNoSpend, limitOf, mineOf, setDay, spentOf } from "../lib/ledger";
import { roundsLabel } from "../lib/split";
import { tripSpent } from "../lib/trip";
import { useApp } from "../state/app";

const dday = (k: string, today: string) => {
  const n = Math.round((dOf(k).getTime() - dOf(today).getTime()) / 86400000);
  return n === 0 ? "오늘" : n > 0 ? "D-" + n : -n + "일 전";
};

/** 그날 카드 (달력 가운데): 내역, 남은 한도, + 이날 쓴 돈 추가, ⋯(한도 바꾸기·무지출·약속) */
export function DaySheet() {
  const { S, today, dayKey, closeDay, model, update, toast, openEntry, toggleNoSpend, openAppt } = useApp();
  const d = model && dayKey ? model.dayByKey(dayKey) : undefined;
  const [limitV, setLimitV] = useState("");
  const [more, setMore] = useState(false);
  const limRef = useRef<HTMLInputElement>(null);
  const l = d ? limitOf(S.days, d) : 0;

  useEffect(() => {
    // 보고 있는 달이 바뀌어 이날이 없으면 닫아요
    if (dayKey && !d) closeDay();
  }, [dayKey, d, closeDay]);
  useEffect(() => {
    if (document.activeElement !== limRef.current) setLimitV(l.toLocaleString("ko-KR"));
  }, [l, dayKey, S]);
  useEffect(() => setMore(false), [dayKey]);

  const content = (() => {
    if (!d || !model) return null;
    const { cfg, cur } = model;
    const s = spentOf(S.days, d.key);
    const items = getDay(S.days, d.key).items;
    const isAppt = d.tag === "약속";
    const trip = d.trip;
    const tSpent = trip ? tripSpent(S.days, trip) : 0;
    const ns = isNoSpend(S.days, d.key);
    const sub = [dday(d.key, today), isAppt ? cfg.apptNames?.[d.key] || "약속" : "", trip ? trip.name : ""].filter(Boolean).join(" · ");

    const saveLimit = (v: number | null) => {
      update((data) => setDay(data.days, d.key, { limit: v }));
      limRef.current?.blur();
      toast(v == null ? "원래 한도로 돌려놨어요." : "한도를 바꿨어요. 예비비가 그만큼 늘거나 줄어요.");
    };

    return (
      <>
        <div className="dc-head">
          <div>
            <h2 id="dayTitle">{md(d.date) + " (" + DOW[d.wd] + ")"}</h2>
            <span className={"dc-sub" + (isAppt ? " appt" : trip ? " trip" : "")}>{sub}</span>
          </div>
          <button className="x" aria-label="더보기" aria-expanded={more} onClick={() => setMore(!more)}>
            ⋯
          </button>
          <button className="x" aria-label="닫기" onClick={closeDay}>
            ✕
          </button>
        </div>

        <div className="dc-sum">
          {trip ? (
            <>
              <span>{"이날 " + won(s) + " 씀"}</span>
              <span>
                {trip.name + " 남은 돈 "}
                <Won n={trip.budget - tSpent} />
              </span>
            </>
          ) : (
            <>
              <span>{"쓴 돈 " + won(s)}</span>
              <span>
                {"남은 한도 "}
                <Won n={l - s} />
              </span>
            </>
          )}
        </div>
        {trip && <p className="hint">{sd(trip.start) + "~" + sd(trip.end) + " · 예산 " + won(trip.budget) + " 중 " + won(tSpent) + " 썼어요" + (trip.fund === "separate" ? " (따로 모아 둔 돈)" : "")}</p>}

        {more && (
          <div className="dc-more">
            {!trip && (
              <div className="limit-edit">
                <label htmlFor="limitInput" className="k">
                  이날 한도
                </label>
                <MoneyInput id="limitInput" ref={limRef} value={limitV} onValue={setLimitV} />
                <button className="btn line" onClick={() => saveLimit(parse(limitV))}>
                  바꾸기
                </button>
                <button className="btn line" onClick={() => saveLimit(null)}>
                  원래대로
                </button>
              </div>
            )}
            <div className="row">
              {items.length === 0 ? (
                <button className="btn line" style={{ flex: 1 }} onClick={() => toggleNoSpend(d.key)}>
                  {ns ? "무지출 취소" : "무지출로 표시"}
                </button>
              ) : (
                <p className="hint">기록이 있는 날은 무지출로 표시할 수 없어요.</p>
              )}
            </div>
          </div>
        )}

        {items.length > 0 ? (
          <ul className="evlist">
            {items.map((it) => {
              const subs = [it.cat || "기타", (it.pay || "check") === "card" ? "신용카드" : "체크·현금"];
              if (it.amount > mineOf(it)) subs.push("결제 " + won(it.amount) + (it.rounds?.length ? "(" + roundsLabel(it.rounds.length) + ")" : ""));
              return (
                <li key={it.id} style={{ borderLeftColor: catVar(it.cat) }}>
                  <span className="t">
                    <b>{it.memo || it.cat || "기타"}</b>
                    <span>{subs.join(" · ")}</span>
                  </span>
                  <span className="a">
                    <b>{"-" + won(mineOf(it))}</b>
                    <button
                      className="del"
                      aria-label={won(it.amount) + " 기록 삭제"}
                      onClick={() => {
                        update((data) => setDay(data.days, d.key, { items: getDay(data.days, d.key).items.filter((x) => x.id !== it.id) }));
                        toast("기록을 지웠어요.");
                      }}
                    >
                      삭제
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="dc-empty">{ns ? "무지출 성공이에요." : "이날 기록이 없어요."}</p>
        )}

        <div className="dc-actions">
          {d.key <= cur.end && (
            <button
              className="dc-add"
              onClick={() => {
                const k = d.key;
                closeDay();
                openEntry(k);
              }}
            >
              ＋ 이날 쓴 돈 추가
            </button>
          )}
          <button className={"dc-appt" + (trip ? " trip" : "")} onClick={() => openAppt({ day: d.key, mode: trip ? "trip" : isAppt ? "appt" : "new", trip })}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="4" y="5" width="16" height="15" rx="3" />
              <path d="M4 10h16M9 3v4M15 3v4" />
            </svg>
            {trip ? "여행 수정" : isAppt ? "약속 수정" : "약속 추가"}
          </button>
        </div>
      </>
    );
  })();

  return (
    <Sheet open={!!d} onClose={closeDay} labelledBy="dayTitle" center>
      {content}
    </Sheet>
  );
}
