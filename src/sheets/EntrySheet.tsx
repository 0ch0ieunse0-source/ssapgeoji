import { useEffect, useRef, useState } from "react";
import { MoneyInput } from "../components/common";
import { Sheet, SheetHead } from "../components/Sheet";
import { CATS } from "../lib/cats";
import { dOf, md } from "../lib/date";
import { fmt, parse, uid6, won } from "../lib/format";
import { getDay, limitOf, setDay, spentOf } from "../lib/ledger";
import { daysFor, periodOf, planFor, preZero } from "../lib/period";
import { MAX_ROUNDS, splitRounds } from "../lib/split";
import { tripSpent } from "../lib/trip";
import { SettlePanel } from "../components/SettlePanel";
import type { Item, Pay } from "../lib/types";
import { useApp } from "../state/app";

type Draft = {
  amount: string;
  memo: string;
  cat: string;
  pay: Pay;
  splitOn: boolean;
  splitN: string;
  splitMine: string;
  splitMode: "once" | "rounds";
  rounds: { amount: string; people: string }[];
  names: string[];
  attend: boolean[][];
};

/** 쓴 돈 적기·고치기. 닫아도 쓰던 값과 고른 분류·결제수단은 남아요 (고치기는 닫으면 원래대로). */
const DRAFT_KEY = "ssapgeoji-entry-draft";
function readDraft(): Partial<Draft> | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}
function writeDraft(d: Partial<Draft> | null) {
  try {
    if (d) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* 비공개 창 등 저장이 안 되면 그냥 넘어가요 */
  }
}

export function EntrySheet() {
  const { S, today, entry, closeEntry, model, update, toast, setView } = useApp();
  // 고치는 중이면 원래 기록 (닫거나 저장하면 쓰던 새 기록 값으로 돌아가요)
  const [orig, setOrig] = useState<{ day: string; it: Item } | null>(null);
  const draft = useRef<Draft | null>(null);
  // 적던 새 기록(금액·메모·분류·결제)은 창을 새로고침해도 남게 이 창에만 잠깐 보관해요 (기록·서버에는 안 들어가요)
  const saved = useRef<Partial<Draft> | null>(readDraft());
  const [amount, setAmount] = useState(saved.current?.amount || "");
  const [memo, setMemo] = useState(saved.current?.memo || "");
  const [day, setDayK] = useState(entry.day);
  const [cat, setCat] = useState(saved.current?.cat || "식비");
  const [pay, setPay] = useState<Pay>(saved.current?.pay || "check");
  const [splitOn, setSplitOn] = useState(false);
  const [splitN, setSplitN] = useState("2");
  const [splitMine, setSplitMine] = useState("");
  const [splitMode, setSplitMode] = useState<"once" | "rounds">("once");
  const blankRounds = () => [{ amount: "", people: "2" }];
  const [rounds, setRounds] = useState<{ amount: string; people: string }[]>(blankRounds);
  const [names, setNames] = useState<string[]>([]);
  const [attend, setAttend] = useState<boolean[][]>([]);
  const amtRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (orig) return; // 고치는 중엔 보관하지 않아요
    writeDraft(amount || memo ? { amount, memo, cat, pay } : null);
  }, [amount, memo, cat, pay, orig]);
  // 삭제는 한 번 더 물어봐요
  const [askDel, setAskDel] = useState(false);
  // 금액 없이 기록하기를 누르면 이유를 알려줘요
  const [amtErr, setAmtErr] = useState(false);
  useEffect(() => {
    setAskDel(false);
    setAmtErr(false);
  }, [entry.nonce, entry.open]);

  const snapshot = (): Draft => ({ amount, memo, cat, pay, splitOn, splitN, splitMine, splitMode, rounds, names, attend });
  const restore = (d: Draft | null) => {
    setAmount(d?.amount ?? "");
    setMemo(d?.memo ?? "");
    setCat(d?.cat ?? "식비");
    setPay(d?.pay ?? "check");
    setSplitOn(d?.splitOn ?? false);
    setSplitN(d?.splitN ?? "2");
    setSplitMine(d?.splitMine ?? "");
    setSplitMode(d?.splitMode ?? "once");
    setRounds(d?.rounds ?? blankRounds());
    setNames(d?.names ?? []);
    setAttend(d?.attend ?? []);
  };
  const endEdit = () => {
    if (!orig) return;
    setOrig(null);
    restore(draft.current);
    draft.current = null;
  };
  const close = () => {
    closeEntry();
    endEdit();
  };

  useEffect(() => {
    if (!entry.nonce) return;
    const ed = entry.edit;
    if (ed) {
      const it = getDay(S.days, ed.day).items.find((x) => x.id === ed.id);
      if (!it) {
        closeEntry();
        return;
      }
      if (!orig) draft.current = snapshot();
      setOrig({ day: ed.day, it });
      setDayK(ed.day);
      setAmount(fmt(it.amount));
      setMemo(it.memo || "");
      setCat(it.cat || "기타");
      setPay(it.pay || "check");
      const split = typeof it.mine === "number" && it.amount > it.mine;
      const byR = !!(it.rounds && it.rounds.length > 1);
      setSplitOn(split);
      setSplitMode(byR ? "rounds" : "once");
      setRounds(byR ? it.rounds!.map((r) => ({ amount: fmt(r.amount), people: String(r.people) })) : blankRounds());
      setSplitN(String(it.settle?.people ?? 2));
      setSplitMine(split && !byR ? fmt(it.mine!) : "");
      setNames(it.settle?.names ? it.settle.names.slice() : []);
      setAttend(it.settle?.attend ? it.settle.attend.map((r) => r.slice()) : []);
      return;
    }
    endEdit();
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
  const entryMin = orig && orig.day < (cfg.firstStart || cur.start) ? orig.day : cfg.firstStart || cur.start;
  const byRounds = splitOn && splitMode === "rounds";
  const rs = splitRounds(rounds.map((r) => ({ amount: parse(r.amount), people: Math.min(20, Math.max(1, parseInt(r.people, 10) || 1)) })));
  // 차수별이면 위쪽 금액 = 차수 합계
  const n = byRounds ? rs.total : parse(amount);
  // 나눠 내는 사람은 나 포함 2~20명 (칸 밖의 숫자는 가까운 쪽으로 맞추고 알려줘요)
  const peopleRaw = parseInt(splitN, 10);
  const people = Math.min(20, Math.max(2, peopleRaw || 2));
  const peopleOff = splitN.trim() !== "" && peopleRaw !== people;
  const shareNow = byRounds ? rs.mine : Math.min(n, parse(splitMine) || Math.round(n / people));
  const setRound = (i: number, patch: Partial<{ amount: string; people: string }>) => setRounds(rounds.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const addEntry = () => {
    if (!n) {
      setAmtErr(true);
      amtRef.current?.focus();
      return;
    }
    const k = day, mine = splitOn ? shareNow : n;
    const o = orig?.it;
    const it: Item = { id: o ? o.id : uid6(), amount: n, memo: memo.trim(), cat, pay, t: o ? o.t : Date.now() };
    if (splitOn) {
      it.mine = mine;
      it.received = o && typeof o.mine === "number" ? !!o.received : false;
      if (it.received && o?.receivedOn) it.receivedOn = o.receivedOn;
      if (byRounds && rs.valid.length > 1) it.rounds = rs.valid;
      const nm = names.map((x) => x.trim()).filter(Boolean);
      it.settle = { people: byRounds ? undefined : people, names: nm, attend: byRounds && rs.valid.length > 1 && nm.length ? attend : undefined };
      // 나누기를 안 건드렸으면 원래 차수별 분류·정산 금액을 그대로 살려요
      if (o && o.amount === n && o.mine === mine && JSON.stringify(o.rounds?.map((r) => [r.amount, r.people]) || null) === JSON.stringify(it.rounds?.map((r) => [r.amount, r.people]) || null)) {
        if (o.rounds) it.rounds = o.rounds;
        if (o.settle?.amounts && JSON.stringify(o.settle.names) === JSON.stringify(nm)) it.settle.amounts = o.settle.amounts;
      }
    }
    if (o && orig) {
      const from = orig.day;
      update((d) => {
        if (from === k) {
          setDay(d.days, k, { items: getDay(d.days, k).items.map((x) => (x.id === o.id ? it : x)), noSpend: false });
        } else {
          setDay(d.days, from, { items: getDay(d.days, from).items.filter((x) => x.id !== o.id) });
          setDay(d.days, k, { items: getDay(d.days, k).items.concat([it]), noSpend: false });
        }
      });
      closeEntry();
      endEdit();
      toast(from === k ? "기록을 고쳤어요." : md(dOf(k)) + "로 옮겨서 고쳤어요.");
      return;
    }
    update((d) => setDay(d.days, k, { items: getDay(d.days, k).items.concat([it]), noSpend: false }));
    setAmount("");
    setMemo("");
    setSplitMine("");
    setSplitOn(false);
    setRounds(blankRounds());
    setNames([]);
    setAttend([]);
    closeEntry();
    const p = periodOf(k, cfg.cycleDay);
    if (p.start !== view.start) setView(p);
    // 보고 있던 달이면 화면과 같은 한도(남은 날에 나눠 쓰기 포함)로 알려줘요
    const dd = (p.start === view.start && model.dayByKey(k)) || daysFor(p, planFor(S.periods, cfg, p), cfg.appts, cfg.trips, preZero(cfg, S.days)).find((x) => x.key === k)!;
    const oweNote = splitOn && n > mine ? " 받을 돈 " + won(n - mine) + "은 지금 송금 요청하세요." : "";
    if (dd.trip) {
      const tl = dd.trip.budget - (tripSpent(S.days, dd.trip) + mine);
      toast(won(mine) + " 기록했어요. " + (tl >= 0 ? dd.trip.name + " " + won(tl) + " 남았어요." : dd.trip.name + " 예산을 " + won(-tl) + " 넘었어요.") + oweNote, tl < 0);
      return;
    }
    if (!cfg.total) {
      toast(won(mine) + " 기록했어요." + oweNote);
      return;
    }
    const l = limitOf(S.days, dd) - (spentOf(S.days, k) + mine);
    toast(won(mine) + " 기록했어요. " + (l >= 0 ? "이날 " + won(l) + " 남았어요." : "이날 한도를 " + won(-l) + " 넘었어요.") + oweNote, l < 0);
  };
  const remove = () => {
    if (!orig) return;
    const { day: from, it: o } = orig;
    update((d) => setDay(d.days, from, { items: getDay(d.days, from).items.filter((x) => x.id !== o.id) }));
    closeEntry();
    endEdit();
    toast("기록을 지웠어요.");
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
    <Sheet open={entry.open} onClose={close} labelledBy="entryTitle" autoFocus={false}>
      <SheetHead id="entryTitle" title={orig ? "쓴 돈 고치기" : (day === today ? "오늘" : md(dOf(day))) + " 쓴 돈 적기"} onClose={close} />
      <div className="amount-wrap">
        <MoneyInput id="amount" ref={amtRef} className="" autoComplete="off" placeholder="0" aria-label="금액" value={byRounds ? fmt(rs.total) : amount} onValue={setAmount} onKeyDown={onEnter} readOnly={byRounds} aria-readonly={byRounds} />
        <span aria-hidden="true">원</span>
      </div>
      {byRounds && <p className="hint">차수별 금액을 더한 총액이에요. 아래 차수 칸에서 바꿔요.</p>}
      {amtErr && !n && (
        <p className="hint err" role="alert">
          {byRounds ? "차수별 금액을 넣어주세요." : "금액을 넣어주세요. 숫자만 들어가요 (소수점·마이너스는 빠져요)."}
        </p>
      )}
      <div className="chips" role="group" aria-label="금액 빠르게 더하기" hidden={byRounds}>
        <button className="chip" onClick={() => quick(1000)}>+1천</button>
        <button className="chip" onClick={() => quick(5000)}>+5천</button>
        <button className="chip" onClick={() => quick(10000)}>+1만</button>
        <button className="chip" onClick={() => quick(0)}>지우기</button>
      </div>
      <div className="row">
        <div className="field" style={{ flex: "2 1 160px" }}>
          <label htmlFor="memo">
            메모{memo.length >= 30 && <span className="count">{" " + memo.length + "/40"}</span>}
          </label>
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
          <div className="seg" role="group" aria-label="나누는 방법">
            <button aria-pressed={splitMode === "once"} onClick={() => setSplitMode("once")}>
              한 번에
            </button>
            <button
              aria-pressed={splitMode === "rounds"}
              onClick={() => {
                if (splitMode !== "rounds" && !parse(rounds[0].amount) && n) setRounds([{ amount: fmt(n), people: splitN }, ...rounds.slice(1)]);
                setSplitMode("rounds");
              }}
            >
              차수별
            </button>
          </div>
          {splitMode === "once" ? (
            <div className="row">
              <div className="field" style={{ flex: "1 1 100px" }}>
                <label htmlFor="splitN">나 포함 몇 명</label>
                <input id="splitN" type="number" min={2} max={20} inputMode="numeric" value={splitN} onChange={(e) => setSplitN(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} />
                {peopleOff && <p className="hint err">{"2~20명까지 나눌 수 있어요. " + people + "명으로 계산해요."}</p>}
              </div>
              <div className="field" style={{ flex: "2 1 140px" }}>
                <label htmlFor="splitMine">내 몫 (비우면 N분의 1)</label>
                <MoneyInput id="splitMine" value={splitMine} onValue={setSplitMine} placeholder={n ? Math.round(n / people).toLocaleString("ko-KR") : "0"} />
              </div>
            </div>
          ) : (
            <>
              <div className="rounds-head k" aria-hidden="true">
                <span />
                <span>금액</span>
                <span>나 포함 인원</span>
              </div>
              {rounds.map((r, i) => (
                <div key={i} className="round">
                  <span className="rl">{i + 1 + "차"}</span>
                  <MoneyInput aria-label={i + 1 + "차 금액"} value={r.amount} onValue={(v) => setRound(i, { amount: v })} placeholder="0" />
                  <span className="rp">
                    <input type="number" min={1} max={20} inputMode="numeric" aria-label={i + 1 + "차 인원 (나 포함)"} value={r.people} onChange={(e) => setRound(i, { people: e.target.value })} />
                    <span aria-hidden="true">명</span>
                  </span>
                  {rounds.length > 1 ? (
                    <button className="x" aria-label={i + 1 + "차 지우기"} onClick={() => setRounds(rounds.filter((_, k) => k !== i))}>
                      ✕
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
              {rounds.length < MAX_ROUNDS && (
                <button className="btn soft" onClick={() => setRounds([...rounds, { amount: "", people: rounds[rounds.length - 1].people }])}>
                  ＋ 차수 추가
                </button>
              )}
              {rs.per.length > 0 && (
                <p className="hint">
                  {rounds
                    .map((r, i) => (parse(r.amount) > 0 ? i + 1 + "차 1인 " + won(Math.round(parse(r.amount) / Math.max(1, parseInt(r.people, 10) || 1))) : ""))
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </>
          )}
          <p className="hint" aria-live="polite">
            {n
              ? (byRounds ? "총 " + won(n) + " 결제 · " : "") + "내 몫 " + won(shareNow) + "만 한도에서 빠지고, " + won(n - shareNow) + "은 받을 돈으로 적혀요."
              : "내 몫만 한도에서 빠지고, 나머지는 받을 돈으로 따로 적혀요."}
          </p>
          {(
            <SettlePanel
              input={{
                title: memo.trim() || cat,
                date: day,
                total: n,
                mine: shareNow,
                people: byRounds ? rs.valid[0]?.people || 2 : people,
                rounds: byRounds && rs.valid.length > 1 ? rs.valid : [],
              }}
              names={names}
              setNames={setNames}
              attend={attend}
              setAttend={setAttend}
            />
          )}
        </div>
      )}
      {orig && askDel ? (
        <div className="cta-bar ask" role="alertdialog" aria-labelledby="delAsk">
          <p className="cta-q" id="delAsk">
            {(orig.it.memo || orig.it.cat || "이 기록") + " " + won(orig.it.amount) + " 기록을 지울까요? 지우면 되돌릴 수 없어요."}
          </p>
          <button className="btn gray" onClick={() => setAskDel(false)}>
            취소
          </button>
          <button className="btn danger-fill" onClick={remove}>
            지우기
          </button>
        </div>
      ) : (
        <div className="cta-bar">
          {orig && (
            <button className="btn danger" onClick={() => setAskDel(true)}>
              삭제
            </button>
          )}
          <button className={"btn" + (n ? "" : " dim")} aria-disabled={!n} onClick={addEntry}>
            {orig ? "저장" : "기록하기"}
          </button>
        </div>
      )}
    </Sheet>
  );
}
