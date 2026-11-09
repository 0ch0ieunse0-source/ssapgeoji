import { useState } from "react";
import { BigWon, MoneyInput } from "../components/common";
import { addDays, sd } from "../lib/date";
import { computeFlow, type FlowItem } from "../lib/flow";
import { parse, parseSigned, uid6, won } from "../lib/format";
import { daysFor, planFor, preZero } from "../lib/period";
import type { FlowOver } from "../lib/types";
import { useApp, useModel } from "../state/app";

const ST_LABEL = { plan: "예정", done: "완료", skip: "제외" } as const;
const ST_NEXT = { plan: "done", done: "skip", skip: "plan" } as const;

/** 일정 금액칸: 입력이 끝나면(칸을 벗어나거나 Enter) 저장해요 */
function FlowAmount({ it, onCommit }: { it: FlowItem; onCommit: (n: number) => void }) {
  const [v, setV] = useState(it.amount.toLocaleString("ko-KR"));
  const commit = () => {
    if (parse(v) !== it.amount) onCommit(parse(v));
  };
  return (
    <MoneyInput
      id={"amt-" + it.id}
      value={v}
      onValue={setV}
      aria-label={it.label + (it.type === "card" ? " 앱에 안 적은 카드 사용액" : " 금액")}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
    />
  );
}

export function FlowView() {
  const { S, today, update, toast, go } = useApp();
  // 삭제는 한 번 더 물어봐요
  const [askDel, setAskDel] = useState<string | null>(null);
  const { cfg, cur } = useModel();
  const [fDate, setFDate] = useState(today);
  const [fLabel, setFLabel] = useState("");
  const [fType, setFType] = useState<"out" | "in">("out");
  const [fAmt, setFAmt] = useState("");
  const [rBal, setRBal] = useState("");

  const has = typeof cfg.balance === "number";
  if (!has)
    return (
      <div className="view">
        <section className="card">
          <h2>통장 잔액을 넣어주세요</h2>
          <p className="hint">설정에서 지금 통장 잔액을 넣으면 월급, 고정지출, 카드값을 날짜순으로 보여주고 통장 예상 잔액을 계산해요.</p>
          <button className="btn soft" onClick={() => go("setup")}>
            설정으로 가기
          </button>
        </section>
      </div>
    );

  const curDays = daysFor(cur, planFor(S.periods, cfg, cur), cfg.appts, cfg.trips, preZero(cfg, S.days));
  const { rows, lastBal, minBal, minAt, last, low } = computeFlow(S, cfg, cur, curDays, today);

  const patchFlow = (it: FlowItem, patch: FlowOver) =>
    update((d) => {
      if (it.auto) d.flows.over[it.id] = Object.assign({}, d.flows.over[it.id] || {}, patch);
      else Object.assign(d.flows.custom.find((x) => x.id === it.id)!, patch);
    });

  const rematch = () => {
    const n = rBal.trim();
    if (!n) return toast("오늘 통장 잔액을 적어주세요.", true);
    update((d) => {
      d.settings!.balance = parseSigned(n);
      d.settings!.balanceDate = today;
    });
    setRBal("");
    toast("잔액을 맞췄어요. 오늘 들어오고 나간 돈은 이미 반영된 걸로 봐요.");
  };

  const addFlow = () => {
    const n = parse(fAmt), label = fLabel.trim();
    if (!n || !label || !fDate) return toast("날짜, 내용, 금액을 모두 적어주세요.", true);
    update((d) => {
      d.flows.custom.push({ id: uid6(), date: fDate, label, type: fType, amount: n, status: "plan" });
    });
    setFAmt("");
    setFLabel("");
    toast("일정을 추가했어요.");
  };

  return (
    <div className="view">
      <section className="card">
        <div>
          <div className="k">{(last ? sd(last.date) + " 이후 " : "") + "통장 예상 잔액"}</div>
          <div className={"big2" + (lastBal < 0 ? " minus" : "")}>
            <BigWon n={lastBal} />
          </div>
        </div>
        <p className="hint">마지막으로 맞춘 잔액에서 출발해요. 이번 달 남은 날은 남은 한도만큼 쓴다고 보고 미리 뺐어요. 다음 달 생활비는 계산에 없어요.</p>
        <div>
          {minAt && (
            <div className={"alert " + (low ? "bad" : "ok")} role={low ? "alert" : undefined}>
              {low
                ? sd(minAt.date) + " " + minAt.label + " 뒤 잔액이 " + won(minBal) + "까지 내려가요. 이날 전에는 저축이나 투자로 옮기지 마세요."
                : "가장 적을 때도 " + won(minBal) + " 남아요 (" + sd(minAt.date) + " " + minAt.label + " 뒤)."}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <h2>통장 잔액 다시 맞추기</h2>
        <p className="hint">{sd(cfg.balanceDate!) + " 기준 잔액 " + won(cfg.balance!) + "에서 계산하고 있어요. 월급날이나 카드값 나간 뒤에 한 번씩 맞추면 정확해져요."}</p>
        <div className="row">
          <div className="field" style={{ flex: "2 1 150px" }}>
            <label htmlFor="rBal">오늘 통장 잔액</label>
            <MoneyInput id="rBal" value={rBal} onValue={setRBal} placeholder="0" signed />
          </div>
          <button className="btn soft" style={{ flex: "1 1 100px" }} onClick={rematch}>
            맞추기
          </button>
        </div>
      </section>

      <section className="card">
        <h2>입금 · 출금 일정</h2>
        <p className="hint">상태를 누르면 예정 → 완료 → 제외 순서로 바뀌어요. 카드값 칸에는 이 앱에 적지 않은 카드 사용액(할부 등)을 넣어요.</p>
        <ul className="flow">
          {!rows.length && (
            <li style={{ display: "block" }}>
              <span className="hint">월급, 매달 나가는 돈, 카드 결제일을 설정에 넣거나 아래에서 일정을 추가하세요.</span>
            </li>
          )}
          {rows.map(({ it, amt, bal }) => (
            <li key={it.id} className={it.status === "skip" ? "skipped" : undefined}>
              <span className="date">{sd(it.date)}</span>
              <div className="what">
                <b>{it.label}</b>
                {it.note && it.status === "plan" && <span className="note">{it.note}</span>}
                {it.type === "card" && <span className="k">{sd(it.cycle!.from) + "~" + sd(it.cycle!.to) + " 신용카드 생활비 + 칸에 넣은 금액"}</span>}
              </div>
              <div className="amt">
                <b className={amt >= 0 ? "plus" : undefined}>{(amt >= 0 ? "+" : "") + won(amt)}</b>
                <span className="bal">{"잔액 " + won(bal)}</span>
              </div>
              <div className="tools">
                <button
                  className="st"
                  data-s={it.status}
                  aria-label={it.label + " 상태: " + ST_LABEL[it.status] + ". 눌러서 바꾸기"}
                  onClick={() => patchFlow(it, { status: ST_NEXT[it.status] })}
                >
                  {ST_LABEL[it.status]}
                </button>
                <FlowAmount key={it.id + ":" + it.amount} it={it} onCommit={(n) => patchFlow(it, { amount: n })} />
                {!it.auto && askDel !== it.id && (
                  <button className="del" aria-label={it.label + " 일정 삭제"} onClick={() => setAskDel(it.id)}>
                    삭제
                  </button>
                )}
                {!it.auto && askDel === it.id && (
                  <span className="del-ask" role="group" aria-label={it.label + " 일정을 지울까요?"}>
                    <span>지울까요?</span>
                    <button className="del" onClick={() => setAskDel(null)}>
                      취소
                    </button>
                    <button
                      className="del on"
                      onClick={() => {
                        update((d) => void (d.flows.custom = d.flows.custom.filter((x) => x.id !== it.id)));
                        setAskDel(null);
                        toast("'" + it.label + "' 일정을 지웠어요.");
                      }}
                    >
                      지우기
                    </button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>일정 추가</h2>
        <div className="row">
          <div className="field" style={{ flex: "1 1 130px" }}>
            <label htmlFor="fDate">날짜</label>
            <input id="fDate" type="date" min={cur.start} max={addDays(cur.end, 62)} value={fDate} onChange={(e) => setFDate(e.target.value)} />
          </div>
          <div className="field" style={{ flex: "2 1 160px" }}>
            <label htmlFor="fLabel">내용</label>
            <input id="fLabel" maxLength={30} placeholder="예: 친구 생일 선물" value={fLabel} onChange={(e) => setFLabel(e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field" style={{ flex: "1 1 110px" }}>
            <label htmlFor="fType">구분</label>
            <select id="fType" value={fType} onChange={(e) => setFType(e.target.value as "out" | "in")}>
              <option value="out">나가는 돈</option>
              <option value="in">들어오는 돈</option>
            </select>
          </div>
          <div className="field" style={{ flex: "2 1 160px" }}>
            <label htmlFor="fAmt">금액 (원)</label>
            <MoneyInput id="fAmt" value={fAmt} onValue={setFAmt} placeholder="0" />
          </div>
        </div>
        <button className="btn" onClick={addFlow}>
          일정 추가
        </button>
      </section>
    </div>
  );
}

