import { useMemo, useRef, useState } from "react";
import { Icon, MoneyInput } from "../components/common";
import { AccountFields, ShareButtons } from "../components/SettlePanel";
import { CATS } from "../lib/cats";
import { dOf, md } from "../lib/date";
import { fmt, parse, uid6, won } from "../lib/format";
import { getDay, setDay } from "../lib/ledger";
import { attendNote, computeShares, settleMessageFrom } from "../lib/settle";
import { MAX_ROUNDS } from "../lib/split";
import type { Item, Pay } from "../lib/types";
import { loadAccount } from "../state/account";
import { useApp, useModel } from "../state/app";

const RECENT_KEY = "ssapgeoji-recent-names";
const loadRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
};
const saveRecent = (names: string[]) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([...new Set([...names, ...loadRecent()])].slice(0, 12)));
  } catch {
    /* 저장이 막혀 있어도 정산은 돼요 */
  }
};
const AV = ["--c1", "--c3", "--c5", "--c6", "--c2", "--c4"];
const avColor = (name: string, i: number) => (i === 0 ? "var(--accent)" : "var(" + AV[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length] + ")");

function Avatar({ name, i, off }: { name: string; i: number; off?: boolean }) {
  return (
    <span className={"av" + (off ? " off" : "")} style={{ background: avColor(name, i) }} aria-hidden="true">
      {i === 0 ? "나" : name.slice(0, 1)}
    </span>
  );
}

/** 정산하기: ① 금액 ② 사람 ③ 나누기 → 저장하면 가계부에 내 몫으로 적혀요 */
export function SettleView() {
  const { today, update, toast, goBack, go } = useApp();
  const { cfg, cur } = useModel();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [useRounds, setUseRounds] = useState(false);
  const [rounds, setRounds] = useState<string[]>(["", ""]);
  const [day, setDay2] = useState(today);
  const [cat, setCat] = useState("식비");
  const [pay, setPay] = useState<Pay>("check");
  const [names, setNames] = useState<string[]>([]);
  const [nameIn, setNameIn] = useState("");
  const [attend, setAttend] = useState<boolean[][]>([[]]); // [사람(0=나)][차수]
  const [custom, setCustom] = useState(false);
  const [customVals, setCustomVals] = useState<string[]>([]);
  const [up100, setUp100] = useState(false);
  const [, bump] = useState(0);
  const [saved, setSaved] = useState<{ text: string; mine: number; owe: number } | null>(null);
  const recent = useMemo(loadRecent, []);
  const topRef = useRef<HTMLHeadingElement>(null);

  const roundAmts = useRounds ? rounds.map(parse) : [];
  const validRounds = roundAmts.filter((x) => x > 0);
  const total = useRounds ? validRounds.reduce((a, b) => a + b, 0) : parse(amount);
  const people = names.length + 1;
  const rN = useRounds && validRounds.length > 1 ? validRounds.length : 0;
  const att = (i: number, k: number) => attend[i]?.[k] ?? true;
  const attendRows = Array.from({ length: people }, (_, i) => Array.from({ length: rN }, (_, k) => att(i, k)));
  const res = computeShares({
    total,
    rounds: rN ? validRounds.map((a) => ({ amount: a })) : [],
    people,
    attend: rN ? attendRows : undefined,
    roundUp100: !custom && up100,
    custom: custom ? [null, ...names.map((_, i) => (customVals[i] === "" || customVals[i] == null ? null : parse(customVals[i])))] : undefined,
  });
  const entryMin = cfg.firstStart || cur.start;

  const goStep = (s: 1 | 2 | 3 | 4) => {
    setStep(s);
    window.scrollTo(0, 0);
    window.setTimeout(() => topRef.current?.focus(), 0);
  };
  const back = () => (step === 1 || step === 4 ? goBack("home") : goStep((step - 1) as 1 | 2));
  const addName = (n0?: string) => {
    const n = (n0 ?? nameIn).trim();
    if (!n) return;
    if (names.includes(n)) return toast("이미 추가한 이름이에요.", true);
    if (names.length >= 19) return toast("20명까지 나눌 수 있어요.", true);
    setNames([...names, n]);
    setAttend([...attendRows, Array.from({ length: rN }, () => true)]);
    if (!n0) setNameIn("");
  };
  const removeName = (i: number) => {
    setNames(names.filter((_, j) => j !== i));
    setAttend(attendRows.filter((_, j) => j !== i + 1));
    setCustomVals(customVals.filter((_, j) => j !== i));
  };
  const toggleAtt = (i: number, k: number) => setAttend(attendRows.map((row, j) => row.map((v, kk) => (j === i && kk === k ? !v : v))));

  const next1 = () => {
    if (!total) return toast(useRounds ? "차수 금액을 넣어주세요." : "나눌 금액을 넣어주세요.", true);
    goStep(2);
  };
  const next2 = () => {
    if (!names.length) return toast("함께한 친구를 한 명 이상 추가해 주세요.", true);
    if (rN && Array.from({ length: rN }, (_, k) => attendRows.some((r) => r[k])).some((x) => !x)) return toast("차수마다 한 명 이상은 있어야 해요.", true);
    setCustomVals(res.shares.slice(1).map((x) => fmt(x)));
    goStep(3);
  };

  const save = () => {
    if (res.error) return toast(res.error, true);
    const mine = res.mine;
    const it: Item = { id: uid6(), amount: total, memo: title.trim() || cat, cat, pay, t: Date.now(), mine, received: false };
    if (rN) it.rounds = validRounds.map((a, k) => ({ amount: a, people: attendRows.filter((r) => r[k]).length }));
    it.settle = { names, amounts: res.shares.slice(1), attend: rN ? attendRows.slice(1) : undefined };
    update((d) => setDay(d.days, day, { items: getDay(d.days, day).items.concat([it]), noSpend: false }));
    saveRecent(names);
    const text = messageText();
    setSaved({ text, mine, owe: total - mine });
    goStep(4);
  };
  const messageText = () =>
    settleMessageFrom({
      title: title.trim() || cat,
      date: day,
      total,
      rounds: rN ? validRounds.map((a, k) => ({ amount: a, people: attendRows.filter((r) => r[k]).length })) : [],
      lines: names.map((n, i) => ({ name: n, amount: res.shares[i + 1], note: attendNote(attendRows[i + 1], rN) })),
      account: loadAccount(),
    });

  const head = (
    <div className="st-head">
      <button className="pbtn" aria-label="뒤로가기" onClick={back}>
        {Icon.prev}
      </button>
      <h1 ref={topRef} tabIndex={-1}>
        정산하기
      </h1>
      {step < 4 && <span className="k">{step + " / 3"}</span>}
    </div>
  );

  return (
    <div className="view settle-view">
      {head}

      {step === 1 && (
        <>
          <section className="card setup-sec">
            <h2 className="st-q">얼마를 나눌까요?</h2>
            <div className="field">
              <label htmlFor="stTitle">무엇을 정산할까요?</label>
              <input id="stTitle" maxLength={20} placeholder="예: 치킨, 회식" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            {!useRounds ? (
              <>
                <div className="amount-wrap st-amt">
                  <MoneyInput id="stAmount" className="" aria-label="나눌 금액" placeholder="0" value={amount} onValue={setAmount} />
                  <span aria-hidden="true">원</span>
                </div>
                <div className="chips" role="group" aria-label="금액 빠르게 더하기">
                  {[10000, 50000, 100000].map((a) => (
                    <button key={a} className="chip" onClick={() => setAmount(fmt(parse(amount) + a))}>
                      {"+" + (a / 10000) + "만"}
                    </button>
                  ))}
                  <button className="chip" onClick={() => setAmount("")}>
                    지우기
                  </button>
                </div>
              </>
            ) : (
              <>
                {rounds.map((r, k) => (
                  <div key={k} className="st-round">
                    <span className="rl">{k + 1 + "차"}</span>
                    <MoneyInput aria-label={k + 1 + "차 금액"} placeholder="0" value={r} onValue={(v) => setRounds(rounds.map((x, j) => (j === k ? v : x)))} />
                    {rounds.length > 2 ? (
                      <button className="x" aria-label={k + 1 + "차 지우기"} onClick={() => setRounds(rounds.filter((_, j) => j !== k))}>
                        ✕
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
                {rounds.length < MAX_ROUNDS && (
                  <button className="btn soft" onClick={() => setRounds([...rounds, ""])}>
                    ＋ 차수 추가
                  </button>
                )}
                <div className="st-total">{"총 " + won(total)}</div>
              </>
            )}
            <button
              className="link"
              style={{ alignSelf: "flex-start" }}
              onClick={() => {
                if (!useRounds && parse(amount)) setRounds([amount, ""]);
                if (useRounds && validRounds.length) setAmount(fmt(total));
                setUseRounds(!useRounds);
              }}
            >
              {useRounds ? "한 번에 나누기로" : "＋ 차수 나누기 (1차, 2차…)"}
            </button>
          </section>
          <section className="card setup-sec">
            <div className="row">
              <div className="field">
                <label htmlFor="stDate">날짜</label>
                <input
                  id="stDate"
                  type="date"
                  min={entryMin}
                  max={cur.end}
                  value={day}
                  onChange={(e) => {
                    const k = e.target.value;
                    if (k && k >= entryMin && k <= cur.end) setDay2(k);
                  }}
                />
              </div>
            </div>
            <div className="lbl" id="stCatLbl">
              분류
            </div>
            <div className="chips" role="group" aria-labelledby="stCatLbl">
              {CATS.map((c) => (
                <button key={c.n} className="chip" aria-pressed={c.n === cat} onClick={() => setCat(c.n)}>
                  <i style={{ background: "var(" + c.c + ")" }} aria-hidden="true" />
                  {c.n}
                </button>
              ))}
            </div>
            <div className="seg" role="group" aria-label="결제 수단">
              <button aria-pressed={pay === "check"} onClick={() => setPay("check")}>
                체크카드 · 현금
              </button>
              <button aria-pressed={pay === "card"} onClick={() => setPay("card")}>
                신용카드
              </button>
            </div>
          </section>
          <button className="btn st-next" onClick={next1}>
            다음
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <section className="card setup-sec">
            <h2 className="st-q">누구랑 나눴어요?</h2>
            <ul className="people">
              <li>
                <Avatar name="나" i={0} />
                <b>나</b>
              </li>
              {names.map((n, i) => (
                <li key={n}>
                  <Avatar name={n} i={i + 1} />
                  <b>{n}</b>
                  <button className="del" aria-label={n + " 빼기"} onClick={() => removeName(i)}>
                    빼기
                  </button>
                </li>
              ))}
            </ul>
            <div className="row">
              <div className="field" style={{ flex: "2 1 160px" }}>
                <label htmlFor="stName">친구 이름</label>
                <input id="stName" maxLength={10} placeholder="이름 넣고 추가" value={nameIn} onChange={(e) => setNameIn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addName()} />
              </div>
              <button className="btn soft" style={{ flex: "0 0 auto" }} onClick={() => addName()}>
                추가
              </button>
            </div>
            {recent.filter((r) => !names.includes(r)).length > 0 && (
              <>
                <div className="lbl">최근 함께한 사람</div>
                <div className="chips">
                  {recent
                    .filter((r) => !names.includes(r))
                    .map((r) => (
                      <button key={r} className="chip" onClick={() => addName(r)}>
                        {"+ " + r}
                      </button>
                    ))}
                </div>
              </>
            )}
          </section>
          {rN > 0 && names.length > 0 && (
            <section className="card setup-sec">
              <h2>차수마다 누가 있었어요?</h2>
              <p className="hint">빠진 사람은 눌러서 꺼 주세요.</p>
              {Array.from({ length: rN }, (_, k) => (
                <div key={k} className="att-row">
                  <span className="rl">{k + 1 + "차"}</span>
                  <span className="att-people">
                    {["나", ...names].map((n, i) => (
                      <button key={i} className="att" aria-pressed={att(i, k)} aria-label={k + 1 + "차 " + n + (att(i, k) ? " 참여" : " 빠짐")} onClick={() => toggleAtt(i, k)}>
                        <Avatar name={n} i={i} off={!att(i, k)} />
                        <span>{n}</span>
                      </button>
                    ))}
                  </span>
                </div>
              ))}
            </section>
          )}
          <button className="btn st-next" onClick={next2}>
            다음
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <section className="card setup-sec">
            <h2 className="st-q">이렇게 나눠요</h2>
            <div className="st-total big">{"총 " + won(total)}</div>
            <div className="seg" role="group" aria-label="나누는 방법">
              <button aria-pressed={!custom} onClick={() => setCustom(false)}>
                1/N
              </button>
              <button
                aria-pressed={custom}
                onClick={() => {
                  setCustomVals(res.shares.slice(1).map((x) => fmt(x)));
                  setCustom(true);
                }}
              >
                직접 입력
              </button>
            </div>
            <ul className="shares">
              {["나", ...names].map((n, i) => (
                <li key={i} className={i === 0 ? "me" : undefined}>
                  <Avatar name={n} i={i} />
                  <span className="t">
                    <b>{n}</b>
                    <span>{i === 0 ? "가계부에 적혀요" : attendNote(attendRows[i], rN) || "받을 돈"}</span>
                  </span>
                  {custom && i > 0 ? (
                    <MoneyInput aria-label={n + " 금액"} value={customVals[i - 1] ?? ""} onValue={(v) => setCustomVals(customVals.map((x, j) => (j === i - 1 ? v : x)))} />
                  ) : (
                    <b className={"amt" + (i === 0 && res.mine < 0 ? " minus" : "")}>{won(res.shares[i])}</b>
                  )}
                </li>
              ))}
            </ul>
            {res.error && (
              <p className="hint" style={{ color: "var(--over)" }} role="alert">
                {res.error}
              </p>
            )}
            {!custom && (
              <>
                <div className="lbl" id="upLbl">
                  끝전
                </div>
                <div className="seg" role="group" aria-labelledby="upLbl">
                  <button aria-pressed={!up100} onClick={() => setUp100(false)}>
                    그대로
                  </button>
                  <button aria-pressed={up100} onClick={() => setUp100(true)}>
                    100원 단위 올림
                  </button>
                </div>
              </>
            )}
            <details className="settle-acc">
              <summary>💳 내 계좌 (메시지에 넣어요)</summary>
              <AccountFields idp="st" onChange={() => bump((x) => x + 1)} />
            </details>
          </section>
          <button className="btn st-next" disabled={!!res.error} onClick={save}>
            정산 저장하고 요청하기
          </button>
        </>
      )}

      {step === 4 && saved && (
        <>
          <section className="card setup-sec st-done">
            <div className="st-check" aria-hidden="true">
              ✓
            </div>
            <h2>정산을 가계부에 적었어요</h2>
            <p className="hint">
              {md(dOf(day)) + " · 내 몫 " + won(saved.mine) + "은 생활비에서 빠지고, " + won(saved.owe) + "은 받을 돈으로 적혔어요."}
            </p>
          </section>
          <section className="card setup-sec">
            <h2>친구에게 보내기</h2>
            <pre className="settle-preview">{saved.text}</pre>
            <ShareButtons text={saved.text} />
          </section>
          <button className="btn line" onClick={() => go("home")}>
            홈으로
          </button>
        </>
      )}
    </div>
  );
}
