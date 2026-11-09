import { useEffect, useRef, useState } from "react";
import { BigWon, MoneyInput, SmallIco } from "../components/common";
import { DOW, md, sd } from "../lib/date";
import { fmt, parse, uid6, won } from "../lib/format";
import { isNoSpend, limitOf, spentOf } from "../lib/ledger";
import { movedIn, movesIn, savedDays, WAIT_OPTIONS, waitForPrice, waitLabel, waitLeft } from "../lib/savings";
import type { Data, Wish } from "../lib/types";
import { useApp, useModel } from "../state/app";

export function SaveView() {
  const { S, today, update, toast, openEntry } = useApp();
  const { cfg, days, view, L, flex } = useModel();
  const D = L; // 생활비 계산용
  const cd = cfg.cycleDay;
  const sdays = savedDays(D, days, today);
  const saved = sdays.reduce((s, x) => s + x.v, 0);
  const moved = movedIn(S.savings.moves, view, cd);
  const avail = Math.max(0, saved - moved);
  const allMoved = S.savings.moves.reduce((s, m) => s + (m.amount || 0), 0);

  const [moveAmt, setMoveAmt] = useState(fmt(avail));
  const moveRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // 프로토타입처럼: 입력 중이 아니면 옮길 수 있는 금액을 미리 채워요
    if (document.activeElement !== moveRef.current) setMoveAmt(fmt(avail));
  }, [avail, S]);

  const move = () => {
    const n = parse(moveAmt);
    if (!n) return;
    update((d) => {
      d.savings.moves.push({ id: uid6(), date: today, period: view.start, amount: n });
    });
    toast(won(n) + " 옮긴 걸로 기록했어요. 생활비 남은 돈에서 빠졌어요.");
  };

  // 사고 싶은 것 대기 목록
  const [wName, setWName] = useState("");
  const [wPrice, setWPrice] = useState("");
  const [waitH, setWaitH] = useState(24);
  const [waitManual, setWaitManual] = useState(false); // 직접 고르면 가격이 바뀌어도 그대로 둬요
  const onPrice = (v: string) => {
    setWPrice(v);
    if (!waitManual) setWaitH(waitForPrice(parse(v)));
  };
  const editWish = (fn: (w: Data["wish"]) => void) => update((d) => fn(d.wish));
  const items = S.wish.items;
  const order = { waiting: 0, skipped: 1, bought: 2 };
  const nowMs = Date.now();
  const addWish = () => {
    const name = wName.trim(), price = parse(wPrice);
    if (!name || !price) return toast("물건 이름과 가격을 적어주세요.", true);
    editWish((x) => {
      x.items.push({ id: uid6(), name, price, wait: waitH, addedAt: Date.now(), status: "waiting" });
    });
    setWName("");
    setWPrice("");
    setWaitH(24);
    setWaitManual(false);
    toast(waitLabel(waitH) + " 뒤에 다시 물어볼게요.");
  };
  const decide = (w: Wish, status: "skipped" | "bought") =>
    editWish((x) => {
      const y = x.items.find((z) => z.id === w.id)!;
      y.status = status;
      y.decidedAt = Date.now();
    });

  return (
    <div className="view">
      <section className="card" aria-label="아낀 돈 저축하기">
        <div>
          <div className="k">저축통장으로 옮길 수 있는 아낀 돈</div>
          <div className="big2">
            <BigWon n={avail} />
          </div>
        </div>
        <div className="tiles">
          <div className="tile">
            <span className="k">지금까지 아낀 돈</span>
            <span className="v">{won(saved)}</span>
          </div>
          <div className="tile">
            <span className="k">이미 옮긴 돈</span>
            <span className="v">{won(moved)}</span>
          </div>
        </div>
        <p className="hint">
          기록을 남긴 지난날 중 한도보다 덜 쓴 만큼이에요. 기록하지 않은 날은 넣지 않아요. 옮긴 돈은 생활비에서 빠져요.
          {flex.mode === "spread" && flex.given > 0 ? " 지금은 '남은 날에 나눠 쓰기' 중이라, 옮기면 남은 날 한도가 그만큼 줄어요." : ""}
        </p>
        <div className="row">
          <div className="field" style={{ flex: "1 1 150px" }}>
            <label htmlFor="moveAmt">저축통장으로 옮긴 금액</label>
            <MoneyInput id="moveAmt" ref={moveRef} value={moveAmt} onValue={setMoveAmt} placeholder="0" />
          </div>
          <button className="btn" style={{ flex: "0 0 auto" }} disabled={!avail} onClick={move}>
            옮겼어요
          </button>
        </div>
        <ul className="tx">
          {sdays
            .filter((x) => x.v > 0)
            .slice(-5)
            .reverse()
            .map(({ d, v, trip }) => (
              <li key={d.key}>
                <SmallIco text={sd(d.key)} bg="var(--good-soft)" fg="var(--good)" />
                <span className="t">
                  <b>{trip ? trip.name + " (" + sd(trip.start) + "~" + sd(trip.end) + ")" : md(d.date) + " (" + DOW[d.wd] + ")"}</b>
                  <span>{trip ? "여행 예산 " + won(trip.budget) + " 중 " + won(trip.budget - v) + " 씀" : "한도 " + won(limitOf(D, d)) + " 중 " + won(spentOf(D, d.key)) + " 씀" + (isNoSpend(D, d.key) ? " · 무지출" : "")}</span>
                </span>
                <span className="a">
                  <b className="plus">{"+" + won(v)}</b>
                </span>
              </li>
            ))}
        </ul>
        <ul className="tx">
          {movesIn(S.savings.moves, view, cd)
            .slice()
            .reverse()
            .map((m) => (
              <li key={m.id}>
                <SmallIco text={sd(m.date)} bg="var(--accent-soft)" fg="var(--accent)" />
                <span className="t">
                  <b>저축통장으로 옮김</b>
                  <span>생활비에서 빠진 돈</span>
                </span>
                <span className="a">
                  <b>{won(m.amount)}</b>
                  <button
                    className="del"
                    aria-label={sd(m.date) + " " + won(m.amount) + " 옮긴 기록 취소"}
                    onClick={() => update((d) => void (d.savings.moves = d.savings.moves.filter((x) => x.id !== m.id)))}
                  >
                    취소
                  </button>
                </span>
              </li>
            ))}
          {allMoved > moved && (
            <li style={{ display: "block" }}>
              <span className="k">{"지금까지 모두 " + won(allMoved) + " 옮겼어요."}</span>
            </li>
          )}
        </ul>
      </section>

      <section className="card" aria-label="사고 싶은 것 대기 목록">
        <h2>사고 싶은 것 대기 목록</h2>
        <p className="hint">바로 사지 말고 여기 넣어두세요. 기다린 뒤에도 사고 싶으면 그때 사요. 안 사면 그 금액이 참은 돈으로 쌓여요.</p>
        <div className="tiles">
          <div className="tile">
            <span className="k">기다리는 중</span>
            <span className="v">{items.filter((w) => w.status === "waiting").length + "개"}</span>
          </div>
          <div className="tile">
            <span className="k">안 사고 참은 돈</span>
            <span className="v plus">{won(items.filter((w) => w.status === "skipped").reduce((s, w) => s + w.price, 0))}</span>
          </div>
        </div>
        <div className="row">
          <div className="field" style={{ flex: "2 1 160px" }}>
            <label htmlFor="wName">뭘 사고 싶어요?</label>
            <input id="wName" maxLength={30} placeholder="예: 겨울 니트" value={wName} onChange={(e) => setWName(e.target.value)} />
          </div>
          <div className="field" style={{ flex: "1 1 110px" }}>
            <label htmlFor="wPrice">가격</label>
            <MoneyInput id="wPrice" value={wPrice} onValue={onPrice} placeholder="0" />
          </div>
        </div>
        <div className="lbl" id="waitLbl">
          얼마나 기다릴까요?
        </div>
        <div className="seg seg-5" role="group" aria-labelledby="waitLbl">
          {WAIT_OPTIONS.map((o) => (
            <button
              key={o.h}
              aria-pressed={waitH === o.h}
              onClick={() => {
                setWaitH(o.h);
                setWaitManual(true);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        {parse(wPrice) > 0 && !waitManual && <p className="hint">가격에 맞춰 골라뒀어요. 더 길게 또는 짧게 바꿔도 돼요.</p>}
        <button className="btn" onClick={addWish}>
          대기 목록에 넣기
        </button>
        <ul className="tx">
          {items
            .slice()
            .sort((a, b) => order[a.status] - order[b.status] || b.addedAt - a.addedAt)
            .map((w) => {
              const left = w.status === "waiting" ? waitLeft(w, nowMs) : null;
              return (
                <li key={w.id}>
                  <span className="ico" style={{ background: "color-mix(in srgb, var(--c5) 18%, var(--surface))", color: "var(--c5)" }} aria-hidden="true">
                    {w.name.slice(0, 1)}
                  </span>
                  <span className="t">
                    <b>{w.name}</b>
                    {w.status === "waiting" ? (
                      left ? (
                        <span className="wish-wait">{left + " · 그때도 사고 싶으면 사요"}</span>
                      ) : (
                        <span className="wish-ready">아직도 사고 싶어요?</span>
                      )
                    ) : (
                      <span>{w.status === "skipped" ? "안 샀어요" : "기다린 뒤 샀어요"}</span>
                    )}
                  </span>
                  <span className="a">
                    <b>{won(w.price)}</b>
                    {w.status === "waiting" && left && (
                      <button className="del" aria-label={w.name + " 삭제"} onClick={() => editWish((x) => void (x.items = x.items.filter((y) => y.id !== w.id)))}>
                        삭제
                      </button>
                    )}
                    {w.status === "waiting" && !left && (
                      <span className="mini-btns">
                        <button
                          className="btn soft"
                          onClick={() => {
                            decide(w, "skipped");
                            toast(won(w.price) + " 참았어요. 잘했어요!");
                          }}
                        >
                          안 살래요
                        </button>
                        <button
                          className="btn line"
                          onClick={() => {
                            decide(w, "bought");
                            openEntry(today, { amount: w.price, memo: w.name, cat: "쇼핑" });
                          }}
                        >
                          살게요
                        </button>
                      </span>
                    )}
                    {w.status !== "waiting" && (
                      <span className={"badge" + (w.status === "bought" ? " warn" : "")}>{w.status === "skipped" ? "참은 돈" : "구매"}</span>
                    )}
                  </span>
                </li>
              );
            })}
        </ul>
        {items.length === 0 && <p className="hint">아직 담은 게 없어요.</p>}
      </section>
    </div>
  );
}
