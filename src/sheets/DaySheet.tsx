import { useEffect, useRef, useState } from "react";
import { MoneyInput, TxRow, Won } from "../components/common";
import { Sheet, SheetHead } from "../components/Sheet";
import { DOW, md } from "../lib/date";
import { parse, won } from "../lib/format";
import { getDay, isNoSpend, limitOf, setDay, spentOf } from "../lib/ledger";
import { sd } from "../lib/date";
import { tripSpent } from "../lib/trip";
import { useApp } from "../state/app";
import { ApptSheet, type ApptTarget } from "./ApptSheet";

/** 하루 상세: 내역 삭제, 그날 한도 바꾸기, 무지출·약속 날 표시 */
export function DaySheet() {
  const { S, dayKey, closeDay, model, update, toast, openEntry, toggleNoSpend } = useApp();
  const d = model && dayKey ? model.dayByKey(dayKey) : undefined;
  const [limitV, setLimitV] = useState("");
  const [appt, setAppt] = useState<ApptTarget>(null);
  const limRef = useRef<HTMLInputElement>(null);
  const l = d ? limitOf(S.days, d) : 0;

  useEffect(() => {
    // 보고 있는 달이 바뀌어 이날이 없으면 닫아요
    if (dayKey && !d) closeDay();
  }, [dayKey, d, closeDay]);
  useEffect(() => {
    if (document.activeElement !== limRef.current) setLimitV(l.toLocaleString("ko-KR"));
  }, [l, dayKey, S]);

  const content = (() => {
    if (!d || !model) return null;
    const { cfg, cur } = model;
    const s = spentOf(S.days, d.key);
    const items = getDay(S.days, d.key).items;
    const isAppt = d.tag === "약속";
    const trip = d.trip;
    const tSpent = trip ? tripSpent(S.days, trip) : 0;

    const saveLimit = (v: number | null) => {
      update((data) => setDay(data.days, d.key, { limit: v }));
      limRef.current?.blur();
      toast(v == null ? "원래 한도로 돌려놨어요." : "한도를 바꿨어요. 예비비가 그만큼 늘거나 줄어요.");
    };

    return (
      <>
        <SheetHead id="dayTitle" title={md(d.date) + " (" + DOW[d.wd] + ")" + (isAppt ? " · " + (cfg.apptNames?.[d.key] || "약속") : trip ? " · " + trip.name : "")} onClose={closeDay} />
        <div className="tiles">
          <div className="tile">
            <span className="k">{trip ? "이날 쓴 돈" : "쓴 돈 (내 몫)"}</span>
            <span className="v">{won(trip ? spentOf(S.days, d.key) : s)}</span>
          </div>
          <div className="tile">
            <span className="k">{trip ? "여행 남은 돈" : "남은 한도"}</span>
            <Won className="v" n={trip ? trip.budget - tSpent : l - s} />
          </div>
        </div>
        {trip && (
          <p className="hint">
            {trip.name + " " + sd(trip.start) + "~" + sd(trip.end) + " · 예산 " + won(trip.budget) + " 중 " + won(tSpent) + " 썼어요. 여행 기간에는 하루 한도 없이 예산 안에서 써요." + (trip.fund === "separate" ? " (따로 모아 둔 돈이라 생활비에서 빠지지 않아요)" : "")}
          </p>
        )}
        <ul className="tx">
          {items.map((it) => (
            <TxRow
              key={it.id}
              it={it}
              onDelete={(e) => {
                e.stopPropagation();
                update((data) => setDay(data.days, d.key, { items: getDay(data.days, d.key).items.filter((x) => x.id !== it.id) }));
                toast("기록을 지웠어요.");
              }}
            />
          ))}
        </ul>
        {items.length === 0 && <p className="hint">이날 기록이 없어요.</p>}
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
          {items.length === 0 && (
            <button className="btn line" style={{ flex: 1 }} onClick={() => toggleNoSpend(d.key)}>
              {isNoSpend(S.days, d.key) ? "무지출 취소" : "무지출로 표시"}
            </button>
          )}
          <button className="btn line" style={{ flex: 1 }} onClick={() => setAppt({ day: d.key, mode: trip ? "trip" : isAppt ? "appt" : "new", trip })}>
            {trip ? "여행 수정" : isAppt ? "약속 수정" : "약속 추가"}
          </button>
          {d.key <= cur.end && (
            <button
              className="btn soft"
              style={{ flex: 1 }}
              onClick={() => {
                const k = d.key;
                closeDay();
                openEntry(k);
              }}
            >
              이날 쓴 돈 추가
            </button>
          )}
        </div>
      </>
    );
  })();

  return (
    <>
      <Sheet open={!!d} onClose={closeDay} labelledBy="dayTitle">
        {content}
      </Sheet>
      {model && <ApptSheet target={appt} onClose={() => setAppt(null)} />}
    </>
  );
}
