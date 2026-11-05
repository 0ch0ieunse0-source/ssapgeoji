import { useState } from "react";
import { BigWon, MoneyInput, SmallIco, Won } from "../components/common";
import { GoalChart } from "../components/GoalChart";
import { sd } from "../lib/date";
import { man, parse, uid6, won } from "../lib/format";
import { computeGoal, snapValue } from "../lib/goal";
import { useApp, useModel } from "../state/app";

export function GoalView() {
  const { S, now, today, update, toast, go } = useApp();
  const { cfg, cur } = useModel();
  const [sDate, setSDate] = useState(today);
  const [sCash, setSCash] = useState("");
  const [sCy, setSCy] = useState("");
  const [sEtf, setSEtf] = useState("");

  const has = !!(cfg.goalAmt && cfg.goalAmt > 0 && cfg.goalDate);
  if (!has)
    return (
      <div className="view">
        <section className="card">
          <h2>저축 목표를 정해보세요</h2>
          <p className="hint">설정에서 목표 금액과 날짜를 넣으면 지금 얼마나 왔는지, 매달 얼마를 모아야 하는지 보여줘요.</p>
          <button className="btn soft" onClick={() => go("setup")}>
            설정으로 가기
          </button>
        </section>
      </div>
    );

  const g = computeGoal(cfg, S.goal.snaps, now, cur.start);
  const addSnap = () => {
    const cash = parse(sCash);
    if (!cash || !sDate) return toast("날짜와 통장 금액을 적어주세요.", true);
    update((d) => {
      d.goal.snaps.push({ id: uid6(), date: sDate, cash, cy: parse(sCy), etf: parse(sEtf) });
    });
    setSCash("");
    setSCy("");
    setSEtf("");
    toast("자산을 기록했어요.");
  };

  return (
    <div className="view">
      <section className="card">
        <div>
          <div className="k">{g.goalEnd.getFullYear() + "년 " + (g.goalEnd.getMonth() + 1) + "월까지 " + man(g.goal) + "원"}</div>
          <div className="big2">
            <BigWon n={Math.round(g.current)} />
          </div>
        </div>
        <div
          className="bar"
          style={{ height: "12px" }}
          role="progressbar"
          aria-label="목표 진행률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.max(0, g.progress))}
        >
          <i style={{ width: g.progress + "%" }} />
        </div>
        <div className="chart-wrap">
          <GoalChart g={g} goalDate={cfg.goalDate!} />
        </div>
        <div className="goal-grid">
          <div className="tile">
            <span className="k">남은 금액</span>
            <Won className="v" n={g.remain} />
          </div>
          <div className="tile">
            <span className="k">{g.byPayday ? "남은 월급날" : "남은 달"}</span>
            <span className="v">{g.monthsLeft + (g.byPayday ? "번" : "달")}</span>
          </div>
          <div className="tile">
            <span className="k">한 달에 모을 돈</span>
            <span className="v">{won(g.monthly)}</span>
          </div>
          <div className="tile">
            <span className="k">목표 경로와 차이</span>
            <span className={"v " + (g.gap < 0 ? "minus" : "plus")}>{(g.gap >= 0 ? "+" : "") + won(g.gap)}</span>
          </div>
        </div>
        <p className="hint">{g.latest ? sd(g.latest.date) + " 기록 기준이에요." : "아직 자산 기록이 없어 통장 잔액으로 계산했어요. 첫 기록을 남겨주세요."}</p>
      </section>

      <section className="card">
        <h2>자산 기록하기</h2>
        <p className="hint">월급날마다 한 번씩 적으면 그래프에 점이 찍혀요. 투자는 평가액 대신 넣은 원금만 적어요.</p>
        <div className="row">
          <div className="field" style={{ flex: "1 1 130px" }}>
            <label htmlFor="sDate">날짜</label>
            <input id="sDate" type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} />
          </div>
          <div className="field" style={{ flex: "1 1 160px" }}>
            <label htmlFor="sCash">통장 · 파킹 · 적금</label>
            <MoneyInput id="sCash" value={sCash} onValue={setSCash} placeholder="0" />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="sCy">주택청약 잔액</label>
            <MoneyInput id="sCy" value={sCy} onValue={setSCy} placeholder="0" />
          </div>
          <div className="field">
            <label htmlFor="sEtf">투자 넣은 원금</label>
            <MoneyInput id="sEtf" value={sEtf} onValue={setSEtf} placeholder="0" />
          </div>
        </div>
        <button className="btn" onClick={addSnap}>
          기록 저장
        </button>
        <ul className="tx">
          {g.snaps
            .slice()
            .reverse()
            .map((s) => (
              <li key={s.id}>
                <SmallIco text={sd(s.date)} bg="var(--accent-soft)" fg="var(--accent)" />
                <span className="t">
                  <b>{won(snapValue(s))}</b>
                  <span>{"통장 " + won(s.cash) + " · 청약 " + won(s.cy) + " · 투자 " + won(s.etf)}</span>
                </span>
                <span className="a">
                  <button className="del" aria-label={sd(s.date) + " 자산 기록 삭제"} onClick={() => update((d) => void (d.goal.snaps = d.goal.snaps.filter((x) => x.id !== s.id)))}>
                    삭제
                  </button>
                </span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
