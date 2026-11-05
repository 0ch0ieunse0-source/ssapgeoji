import { Fragment } from "react";
import { TxRow } from "../components/common";
import { addDays, dOf, DOW, md, sd } from "../lib/date";
import { short, won } from "../lib/format";
import { getDay, isNoSpend, limitOf, spentOf } from "../lib/ledger";
import { tripSpent } from "../lib/trip";
import { useApp, useModel } from "../state/app";

export function LedgerView() {
  const { S, today, openDay } = useApp();
  const { days, weeks, view, dayByKey, L, cfg } = useModel();
  const nm = (k: string) => cfg.apptNames?.[k];
  const cut = (x: string) => (x.length > 4 ? x.slice(0, 4) + "…" : x);
  const D = L; // 생활비 계산용
  const R = S.days; // 실제 기록
  const lim = days.reduce((s, d) => s + limitOf(D, d), 0);
  const sp = days.reduce((s, d) => s + spentOf(D, d.key), 0);

  // 달력: 월요일부터 시작하도록 앞뒤를 채워요
  const cells: JSX.Element[] = [];
  const last = addDays(view.end, (7 - dOf(view.end).getDay()) % 7);
  for (let k = addDays(view.start, -((dOf(view.start).getDay() + 6) % 7)); k <= last; k = addDays(k, 1)) {
    const d = dOf(k), info = dayByKey(k);
    const label = (d.getDate() === 1 || k === view.start ? d.getMonth() + 1 + "/" : "") + d.getDate();
    if (!info) {
      cells.push(
        <div key={k} className="cell out" aria-hidden="true">
          <span className="n">{label}</span>
          <span className="s">-</span>
        </div>,
      );
      continue;
    }
    const t = info.trip;
    const s = t ? spentOf(R, k) : spentOf(D, k), l = limitOf(D, info), ns = isNoSpend(R, k);
    const over = t ? tripSpent(R, t) > t.budget : s > l;
    const pos = t ? (k === t.start || k === view.start || info.wd === 1 ? " t-start" : "") + (k === t.end || k === view.end || info.wd === 0 ? " t-end" : "") : "";
    const cls = "cell" + (over ? " over" : "") + (k === today ? " today" : "") + (ns ? " nospend" : "") + (info.tag === "약속" ? " appt" : "") + (t ? " trip" + pos : "");
    cells.push(
      <button
        key={k}
        className={cls}
        aria-label={
          md(d) + (t ? " " + t.name + ", 쓴 돈 " + won(s) + (over ? ", 여행 예산 초과" : "") : (info.tag === "약속" ? " " + (nm(k) || "약속") : "") + " 한도 " + won(l) + ", 쓴 돈 " + won(s) + (ns ? ", 무지출" : "") + (over ? ", 한도 초과" : ""))
        }
        aria-current={k === today ? "date" : undefined}
        onClick={() => openDay(info.key)}
      >
        <span className="n">{label}</span>
        <span className={"s" + (s || ns ? "" : " zero")}>{s ? "-" + short(s) : ns ? "무지출" : t ? (k === t.start || k === view.start ? cut(t.name) : "·") : info.tag === "약속" && nm(k) ? cut(nm(k)!) : short(l)}</span>
      </button>,
    );
  }

  const withItems = days.filter((d) => getDay(R, d.key).items.length).reverse();
  const tripsHere = [...new Map(days.filter((d) => d.trip).map((d) => [d.trip!.id, d.trip!])).values()];

  return (
    <div className="view">
      <section className="card" aria-label="달력">
        <div className="card-head">
          <h2>{md(dOf(view.start)) + " ~ " + md(dOf(view.end))}</h2>
          <span className="k">{won(sp) + " / " + won(lim)}</span>
        </div>
        <div className="cal">
          {["월", "화", "수", "목", "금", "토", "일"].map((t, i) => (
            <div key={t} className={"dw" + (i === 6 ? " sun" : "")} aria-hidden="true">
              {t}
            </div>
          ))}
          {cells}
        </div>
        <div className="cal-legend">
          <span>
            <i style={{ background: "var(--accent)" }} />
            오늘
          </span>
          <span>
            <i style={{ background: "var(--over-soft)", border: "1px solid var(--over)" }} />
            한도 초과
          </span>
          <span style={{ color: "var(--good)" }}>무지출</span>
          {tripsHere.length > 0 && (
            <span>
              <i className="t-sw" />
              여행
            </span>
          )}
        </div>
        {tripsHere.map((t) => {
          const sp = tripSpent(R, t);
          return (
            <div key={t.id} className={"trip-sum" + (sp > t.budget ? " over" : "")}>
              <b>{t.name}</b>
              <span>{sd(t.start) + "~" + sd(t.end) + " · " + (t.fund === "living" ? "생활비 안에서" : "따로 모아 둔 돈")}</span>
              <span className="trip-amt">{won(sp) + " / " + won(t.budget)}</span>
            </div>
          );
        })}
      </section>

      <section className="card" aria-label="주간 한도">
        <h2>주간 한도</h2>
        <ul className="weeks">
          {weeks.map((w, i) => {
            const l = w.reduce((s, d) => s + limitOf(D, d), 0), s = w.reduce((s2, d) => s2 + spentOf(D, d.key), 0);
            return (
              <li key={w[0].key}>
                <div className="wr">
                  <span>{i + 1 + "주차 · " + sd(w[0].key) + "~" + sd(w[w.length - 1].key)}</span>
                  <span className={s > l ? "minus" : undefined}>{won(s) + " / " + won(l)}</span>
                </div>
                <div className={"bar" + (s > l ? " over" : "")}>
                  <i style={{ width: Math.min(100, l ? (s / l) * 100 : 0) + "%" }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card" aria-label="전체 내역">
        <h2>내역</h2>
        <div>
          {withItems.map((d) => (
            <Fragment key={d.key}>
              <div className="group">
                <span>{md(d.date) + " (" + DOW[d.wd] + ")"}</span>
                <span>{"-" + won(spentOf(R, d.key))}</span>
              </div>
              <ul className="tx">
                {getDay(R, d.key).items.map((it) => (
                  <TxRow key={it.id} it={it} onClick={() => openDay(d.key)} />
                ))}
              </ul>
            </Fragment>
          ))}
        </div>
        {withItems.length === 0 && <p className="hint">아직 기록이 없어요. 아래 '쓴 돈 적기'를 눌러 첫 기록을 남겨보세요.</p>}
      </section>
    </div>
  );
}
