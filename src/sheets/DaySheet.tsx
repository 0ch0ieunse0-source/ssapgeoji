import { useEffect, useRef, useState } from "react";
import { MoneyInput, Won } from "../components/common";
import { Sheet } from "../components/Sheet";
import { catVar } from "../lib/cats";
import { dOf, DOW, md, sd } from "../lib/date";
import { parse, won } from "../lib/format";
import { catsLabel, getDay, isNoSpend, limitOf, mineOf, setDay, spentOf } from "../lib/ledger";
import { roundsLabel } from "../lib/split";
import { tripSpent } from "../lib/trip";
import { useApp } from "../state/app";

const dday = (k: string, today: string) => {
  const n = Math.round((dOf(k).getTime() - dOf(today).getTime()) / 86400000);
  return n === 0 ? "오늘" : n > 0 ? "D-" + n : -n + "일 전";
};

/** 그날 카드 (달력 가운데): 내역, 남은 한도, + 이날 쓴 돈 추가, ⋯(한도 바꾸기·무지출·약속) */
export function DaySheet() {
  const { S, today, dayKey, closeDay, model, update, toast, openEntry, editEntry, toggleNoSpend, openAppt } = useApp();
  const d = model && dayKey ? model.dayByKey(dayKey) : undefined;
  const [limitV, setLimitV] = useState("");
  const [more, setMore] = useState(false);
  // 일정 블록을 누르면 아래에서 올라오는 한도 시트
  const [limitKey, setLimitKey] = useState<string | null>(null);
  const openLimit = (k: string) => {
    setLimitV(l.toLocaleString("ko-KR"));
    setLimitKey(k);
    window.setTimeout(() => limRef.current?.focus(), 60);
  };
  const limRef = useRef<HTMLInputElement>(null);
  const l = d ? limitOf(S.days, d) : 0;

  useEffect(() => {
    // 보고 있는 달이 바뀌어 이날이 없으면 닫아요
    if (dayKey && !d) closeDay();
  }, [dayKey, d, closeDay]);
  useEffect(() => {
    if (document.activeElement !== limRef.current) setLimitV(l.toLocaleString("ko-KR"));
  }, [l, dayKey, S]);
  useEffect(() => {
    setMore(false);
    setLimitKey(null);
  }, [dayKey]);

  const content = (() => {
    if (!d || !model) return null;
    const { cfg, cur } = model;
    const s = spentOf(S.days, d.key);
    const items = getDay(S.days, d.key).items;
    const isAppt = d.tag === "약속";
    const trip = d.trip;
    const tSpent = trip ? tripSpent(S.days, trip) : 0;
    const ns = isNoSpend(S.days, d.key);
    const sub = dday(d.key, today);
    // 기록 없는 오늘·지난 날은 무지출 표시를 ⋯ 안에 숨기지 않고 바로 보여줘요 (예비비 계산에 넣으려면 필요해서)
    const nsInline = items.length === 0 && d.key <= today;

    return (
      <>
        <div className="dc-head">
          <div>
            <h2 id="dayTitle">{md(d.date) + " (" + DOW[d.wd] + ")"}</h2>
            <span className={"dc-sub" + (isAppt ? " appt" : trip ? " trip" : "")}>{sub}</span>
          </div>
          {!nsInline && (
            <button className="x" aria-label="더보기" aria-expanded={more} onClick={() => setMore(!more)}>
              ⋯
            </button>
          )}
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

        {nsInline && (
          <div className="dc-ns">
            <button className={"btn line" + (ns ? " on" : "")} aria-pressed={ns} onClick={() => toggleNoSpend(d.key)}>
              {ns ? "무지출로 표시했어요 · 취소" : "이날은 안 썼어요 (무지출로 표시)"}
            </button>
            {!ns && <p className="hint">기록이 없는 날은 예비비 계산에서 빠져요. 안 쓴 날이면 눌러 주세요.</p>}
          </div>
        )}

        {more && (
          <div className="dc-more">
            {items.length === 0 ? (
              <button className="btn line" onClick={() => toggleNoSpend(d.key)}>
                {ns ? "무지출 취소" : "무지출로 표시"}
              </button>
            ) : (
              <p className="hint">기록이 있는 날은 무지출로 표시할 수 없어요.</p>
            )}
          </div>
        )}

        {/* 일정: 약속·여행·이날 한도를 블록으로. 누르면 바로 고쳐요 */}
        <div className="dc-lbl">{isAppt || trip ? "일정" : "한도"}</div>
        {trip ? (
          <button className="dc-ev" onClick={() => openAppt({ day: d.key, mode: "trip", trip })}>
            <i aria-hidden="true" />
            <span className="t">
              <b>{trip.name}</b>
              <span>{"여행 · " + sd(trip.start) + "~" + sd(trip.end) + " · 예산 " + won(trip.budget) + (trip.fund === "separate" ? " (따로 모아 둔 돈)" : "")}</span>
            </span>
            <span className="chev" aria-hidden="true">›</span>
          </button>
        ) : (
          <button className={"dc-ev" + (isAppt ? "" : " plain")} onClick={() => openLimit(d.key)}>
            <i aria-hidden="true" />
            <span className="t">
              <b>{isAppt ? cfg.apptNames?.[d.key] || "약속" : "이날 한도"}</b>
              <span>
                {(isAppt ? "약속 · " : "") +
                  "한도 " +
                  won(l) +
                  (l !== d.base ? " (원래 " + won(d.base) + ")" : d.flex ? " (남은 돈 나눠 " + (d.flex > 0 ? "+" : "−") + won(Math.abs(d.flex)) + ")" : "")}
              </span>
            </span>
            <span className="chev" aria-hidden="true">›</span>
          </button>
        )}

        <div className="dc-lbl">기록</div>
        {items.length > 0 ? (
          <ul className="evlist">
            {items.map((it) => {
              const subs = [catsLabel(it), (it.pay || "check") === "card" ? "신용카드" : "체크·현금"];
              if (it.amount > mineOf(it)) subs.push("결제 " + won(it.amount) + (it.rounds?.length ? "(" + roundsLabel(it.rounds.length) + ")" : ""));
              return (
                <li key={it.id} className="tap" style={{ borderLeftColor: catVar(it.cat) }}>
                  <button className="ev-btn" onClick={() => editEntry(d.key, it.id)} aria-label={(it.memo || it.cat || "기타") + " " + won(mineOf(it)) + ", 고치기"}>
                    <span className="t">
                      <b>{it.memo || it.cat || "기타"}</b>
                      <span>{subs.join(" · ")}</span>
                    </span>
                    <span className="a">
                      <b>{"-" + won(mineOf(it))}</b>
                      <span className="chev" aria-hidden="true">›</span>
                    </span>
                  </button>
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

  const saveLimit = (v: number | null) => {
    if (!d) return;
    update((data) => setDay(data.days, d.key, { limit: v }));
    setLimitKey(null);
    toast(v == null ? "원래 한도로 돌려놨어요." : "한도를 바꿨어요. 예비비가 그만큼 늘거나 줄어요.");
  };
  const lv = parse(limitV);
  const lname = d && d.tag === "약속" ? (model?.cfg.apptNames?.[d.key] || "약속") + " 한도" : "이날 한도";

  return (
    <>
      <Sheet open={!!d} onClose={closeDay} labelledBy="dayTitle" center>
        {content}
      </Sheet>
      <Sheet open={!!d && limitKey === d.key} onClose={() => setLimitKey(null)} labelledBy="limTitle" autoFocus={false}>
        {d && (
          <>
            <div className="sheet-head">
              <div>
                <h2 id="limTitle">{lname}</h2>
                <span className="k">{md(d.date) + " (" + DOW[d.wd] + ")" + (d.tag ? " · " + d.tag : "")}</span>
              </div>
              <button className="x" aria-label="닫기" onClick={() => setLimitKey(null)}>
                ✕
              </button>
            </div>
            <div className="lim-big">
              <MoneyInput id="limitInput" ref={limRef} aria-label={lname} value={limitV} onValue={setLimitV} onKeyDown={(e) => e.key === "Enter" && saveLimit(lv)} />
              <span aria-hidden="true">원</span>
            </div>
            <p className="hint" aria-live="polite">
              {"원래 한도 " + won(d.base) + (lv > d.base ? " · 예비비에서 " + won(lv - d.base) + "을 더 써요." : lv < d.base ? " · " + won(d.base - lv) + "이 예비비로 남아요." : "")}
            </p>
            <div className="cta-bar">
              <button className="btn gray" onClick={() => saveLimit(null)}>
                원래대로
              </button>
              <button className="btn" onClick={() => saveLimit(lv)}>
                바꾸기
              </button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
