import { useEffect, useRef, useState } from "react";
import { MoneyInput } from "../components/common";
import { Sheet, SheetHead } from "../components/Sheet";
import { CATS } from "../lib/cats";
import { dOf, md } from "../lib/date";
import { fmt, parse, uid6, won } from "../lib/format";
import { getDay, limitOf, setDay, spentOf } from "../lib/ledger";
import { daysFor, periodOf, planFor } from "../lib/period";
import type { Item, Pay } from "../lib/types";
import { useApp } from "../state/app";

/** 쓴 돈 적기. 닫아도 쓰던 값과 고른 분류·결제수단은 남아요 (프로토타입과 같아요). */
export function EntrySheet() {
  const { S, today, entry, closeEntry, model, update, toast, setView } = useApp();
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [day, setDayK] = useState(entry.day);
  const [cat, setCat] = useState("식비");
  const [pay, setPay] = useState<Pay>("check");
  const [splitOn, setSplitOn] = useState(false);
  const [splitN, setSplitN] = useState("2");
  const [splitMine, setSplitMine] = useState("");
  const amtRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!entry.nonce) return;
    setDayK(entry.day);
    const pre = entry.pre;
    if (pre) {
      setAmount(pre.amount ? pre.amount.toLocaleString("ko-KR") : "");
      setMemo(pre.memo || "");
      if (pre.cat) setCat(pre.cat);
    }
    const t = window.setTimeout(() => amtRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [entry.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!model) return null;
  const { cfg, cur, view } = model;
  const entryMin = cfg.firstStart || cur.start;
  const n = parse(amount);
  const people = Math.max(2, parseInt(splitN, 10) || 2);
  const shareNow = Math.min(n, parse(splitMine) || Math.round(n / people));

  const addEntry = () => {
    if (!n) return;
    const k = day, mine = splitOn ? shareNow : n;
    const it: Item = { id: uid6(), amount: n, memo: memo.trim(), cat, pay, t: Date.now() };
    if (splitOn) {
      it.mine = mine;
      it.received = false;
    }
    update((d) => setDay(d.days, k, { items: getDay(d.days, k).items.concat([it]), noSpend: false }));
    setAmount("");
    setMemo("");
    setSplitMine("");
    setSplitOn(false);
    closeEntry();
    const p = periodOf(k, cfg.cycleDay);
    if (p.start !== view.start) setView(p);
    const dd = daysFor(p, planFor(S.periods, cfg, p), cfg.appts).find((x) => x.key === k)!;
    const l = limitOf(S.days, dd) - (spentOf(S.days, k) + mine);
    const oweNote = splitOn && n > mine ? " 받을 돈 " + won(n - mine) + "은 지금 송금 요청하세요." : "";
    toast(won(mine) + " 기록했어요. " + (l >= 0 ? "이날 " + won(l) + " 남았어요." : "이날 한도를 " + won(-l) + " 넘었어요.") + oweNote, l < 0);
  };
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") addEntry();
  };
  const quick = (add: number) => {
    const v = add ? parse(amount) + add : 0;
    setAmount(fmt(v));
    amtRef.current?.focus();
  };

  return (
    <Sheet open={entry.open} onClose={closeEntry} labelledBy="entryTitle" autoFocus={false}>
      <SheetHead id="entryTitle" title={(day === today ? "오늘" : md(dOf(day))) + " 쓴 돈 적기"} onClose={closeEntry} />
      <div className="amount-wrap">
        <MoneyInput id="amount" ref={amtRef} className="" autoComplete="off" placeholder="0" aria-label="금액" value={amount} onValue={setAmount} onKeyDown={onEnter} />
        <span aria-hidden="true">원</span>
      </div>
      <div className="chips" role="group" aria-label="금액 빠르게 더하기">
        <button className="chip" onClick={() => quick(1000)}>+1천</button>
        <button className="chip" onClick={() => quick(5000)}>+5천</button>
        <button className="chip" onClick={() => quick(10000)}>+1만</button>
        <button className="chip" onClick={() => quick(0)}>지우기</button>
      </div>
      <div className="row">
        <div className="field" style={{ flex: "2 1 160px" }}>
          <label htmlFor="memo">메모</label>
          <input id="memo" maxLength={40} placeholder="예: 점심 김밥" autoComplete="off" value={memo} onChange={(e) => setMemo(e.target.value)} onKeyDown={onEnter} />
        </div>
        <div className="field" style={{ flex: "1 1 120px" }}>
          <label htmlFor="entryDate">날짜</label>
          <input
            id="entryDate"
            type="date"
            min={entryMin}
            max={cur.end}
            value={day}
            onChange={(e) => {
              const k = e.target.value;
              if (k && k >= entryMin && k <= cur.end) setDayK(k);
            }}
          />
        </div>
      </div>
      <div className="lbl" id="catLbl">분류</div>
      <div className="chips" role="group" aria-labelledby="catLbl">
        {CATS.map((c) => (
          <button key={c.n} className="chip" aria-pressed={c.n === cat} onClick={() => setCat(c.n)}>
            <i style={{ background: "var(" + c.c + ")" }} aria-hidden="true" />
            {c.n}
          </button>
        ))}
      </div>
      <div className="lbl" id="payLbl">결제 수단</div>
      <div className="seg" role="group" aria-labelledby="payLbl">
        <button aria-pressed={pay === "check"} onClick={() => setPay("check")}>
          체크카드 · 현금
        </button>
        <button aria-pressed={pay === "card"} onClick={() => setPay("card")}>
          신용카드
        </button>
      </div>
      <label className="split" htmlFor="splitOn">
        <input type="checkbox" id="splitOn" checked={splitOn} onChange={(e) => setSplitOn(e.target.checked)} /> 친구 몫까지 내가 먼저 냈어요
      </label>
      {splitOn && (
        <div className="splitbox">
          <div className="row">
            <div className="field" style={{ flex: "1 1 100px" }}>
              <label htmlFor="splitN">나 포함 몇 명</label>
              <input id="splitN" type="number" min={2} max={20} inputMode="numeric" value={splitN} onChange={(e) => setSplitN(e.target.value)} />
            </div>
            <div className="field" style={{ flex: "2 1 140px" }}>
              <label htmlFor="splitMine">내 몫 (비우면 N분의 1)</label>
              <MoneyInput id="splitMine" value={splitMine} onValue={setSplitMine} placeholder={n ? Math.round(n / people).toLocaleString("ko-KR") : "0"} />
            </div>
          </div>
          <p className="hint" aria-live="polite">
            {n ? "내 몫 " + won(shareNow) + "만 한도에서 빠지고, " + won(n - shareNow) + "은 받을 돈으로 적혀요." : "내 몫만 한도에서 빠지고, 나머지는 받을 돈으로 따로 적혀요."}
          </p>
        </div>
      )}
      <button className="btn" disabled={!n} onClick={addEntry}>
        기록하기
      </button>
    </Sheet>
  );
}
