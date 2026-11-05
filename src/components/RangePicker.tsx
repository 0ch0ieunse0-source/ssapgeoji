import { useState } from "react";
import { dateFor, dOf, kOf, md, sd } from "../lib/date";
import type { Key } from "../lib/types";
import { Icon } from "./common";

/** 작은 달력에서 시작일 → 끝날을 차례로 눌러 기간 고르기 */
export function RangePicker({ start, end, onChange, today }: { start: Key; end: Key; onChange: (start: Key, end: Key) => void; today: Key }) {
  const base = dOf(start || today);
  const [ym, setYm] = useState<[number, number]>([base.getFullYear(), base.getMonth()]);
  const [y, m] = ym;
  const first = dateFor(y, m, 1);
  const lastDay = new Date(y, m + 1, 0).getDate();
  const lead = (dOf(first).getDay() + 6) % 7; // 월요일 시작
  const shift = (n: number) => {
    const d = new Date(y, m + n, 1);
    setYm([d.getFullYear(), d.getMonth()]);
  };
  const pick = (k: Key) => {
    if (!start || end) onChange(k, "");
    else if (k < start) onChange(k, "");
    else onChange(start, k);
  };
  const n = start && end ? Math.round((dOf(end).getTime() - dOf(start).getTime()) / 86400000) + 1 : 0;
  const cells: JSX.Element[] = [];
  for (let i = 0; i < lead; i++) cells.push(<span key={"b" + i} />);
  for (let d = 1; d <= lastDay; d++) {
    const k = kOf(new Date(y, m, d));
    const wd = new Date(y, m, d).getDay();
    const isS = k === start, isE = k === end;
    const inR = start && end && k > start && k < end;
    const cls = "rp-day" + (isS ? " s" : "") + (isE ? " e" : "") + (inR ? " in" : "") + (start && end && start !== end && (isS || isE) ? " edge" : "") + (wd === 0 ? " sun" : wd === 6 ? " sat" : "") + (k === today ? " now" : "");
    cells.push(
      <button key={k} className={cls} aria-pressed={!!(isS || isE || inR)} aria-label={md(dOf(k)) + (isS ? ", 시작일" : isE ? ", 끝날" : "")} onClick={() => pick(k)}>
        <span>{d}</span>
      </button>,
    );
  }
  return (
    <div className="rp">
      <div className="rp-head">
        <b>{y + "년 " + (m + 1) + "월"}</b>
        <span>
          <button className="pbtn" aria-label="이전 달" onClick={() => shift(-1)}>
            {Icon.prev}
          </button>
          <button className="pbtn" aria-label="다음 달" onClick={() => shift(1)}>
            {Icon.next}
          </button>
        </span>
      </div>
      <div className="rp-grid">
        {["월", "화", "수", "목", "금", "토", "일"].map((t, i) => (
          <span key={t} className={"rp-dw" + (i === 5 ? " sat" : i === 6 ? " sun" : "")} aria-hidden="true">
            {t}
          </span>
        ))}
        {cells}
      </div>
      <p className="hint rp-sum" aria-live="polite">
        {!start ? "시작일을 눌러주세요." : !end ? sd(start) + " ~ 끝날을 눌러주세요." : sd(start) + " ~ " + sd(end) + " · " + n + "일"}
      </p>
    </div>
  );
}
