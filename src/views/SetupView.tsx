import { useEffect, useRef, useState } from "react";
import { MoneyInput, SmallIco } from "../components/common";
import { dOf, DOW, md, sd } from "../lib/date";
import { fmt, man, parse, uid6, won } from "../lib/format";
import { countsFor, periodOf, shiftPeriod, splitFor } from "../lib/period";
import { EMPTY, normalize } from "../lib/storage";
import type { Data, Fixed, Settings } from "../lib/types";
import { PageHead } from "../components/PageHead";
import { Icon } from "../components/common";
import { ACCENTS, accentLabel, accentOf, applyAccent, type AccentId } from "../lib/theme";
import { currentUnread } from "../notices";
import { useApp } from "../state/app";

const DEFAULTS: Partial<Settings> = { cycleDay: 1, total: 400000, apptLimit: 30000, appts: [], fixed: [], autoLimits: true };
const intOrNull = (s: string) => parseInt(s, 10) || null;

export function SetupView({ section = "" }: { section?: string }) {
  const { S, today, update, replace, setView, toast, go, goBack, bumpForm, openGuide } = useApp();
  const cfg = S.settings;
  const c = cfg || DEFAULTS;

  const [name, setName] = useState(c.name || "");
  const [cycle, setCycle] = useState(c.cycleDay || 1);
  const [total, setTotal] = useState(fmt(c.total));
  const [apptLimit, setApptLimit] = useState(fmt(c.apptLimit));
  const [appts, setAppts] = useState<string[]>(() => (c.appts || []).filter((k) => k >= periodOf(today, c.cycleDay || 1).start));
  const [apptDate, setApptDate] = useState("");
  const [auto, setAuto] = useState(c.autoLimits !== false);
  const [weekday, setWeekday] = useState(fmt(c.weekday));
  const [weekend, setWeekend] = useState(fmt(c.weekend));
  const [balance, setBalance] = useState(fmt(c.balance));
  const [payday, setPayday] = useState(String(c.payday || ""));
  const [salary, setSalary] = useState(fmt(c.salary));
  const [fixed, setFixed] = useState<Fixed[]>(() => (c.fixed || []).map((f) => ({ ...f })));
  const [fxName, setFxName] = useState("");
  const [fxDay, setFxDay] = useState("");
  const [fxAmt, setFxAmt] = useState("");
  const [cardPay, setCardPay] = useState(String(c.cardPay || ""));
  const [cardCut, setCardCut] = useState(String(c.cardCut || ""));
  const [goalAmt, setGoalAmt] = useState(fmt(c.goalAmt));
  const [goalDate, setGoalDate] = useState(c.goalDate || "");
  const [err, setErr] = useState<string | null>(null);
  const [accent, setAccent] = useState<AccentId>(accentOf(c.accent));
  // 화면 페이지에서 고르는 동안 바로 미리 보여주고, 저장 안 하고 나가면 원래 색으로 돌려놔요
  const appliedAccent = useRef<AccentId>(accentOf(cfg?.accent));
  useEffect(() => {
    if (section !== "look") return;
    applyAccent(accent);
    return () => applyAccent(appliedAccent.current);
  }, [section, accent]);

  // 미리 보기
  const p = periodOf(today, cycle), nx = shiftPeriod(p, 1, cycle);
  const counts = countsFor(p, appts);
  const totalN = parse(total), apl = parse(apptLimit);
  const split = auto && totalN ? splitFor(totalN, apl, counts) : null;
  const shownWd = split ? fmt(split.weekday) : weekday;
  const shownWe = split ? fmt(split.weekend) : weekend;
  useEffect(() => {
    // 자동으로 나눈 값은 입력칸에 남겨요 (자동을 끄면 그 값에서 고칠 수 있게)
    if (split) {
      setWeekday(fmt(split.weekday));
      setWeekend(fmt(split.weekend));
    }
  }, [split?.weekday, split?.weekend]); // eslint-disable-line react-hooks/exhaustive-deps
  const sum = counts.wd * parse(shownWd) + counts.we * parse(shownWe) + counts.ap * apl;
  const reserve = totalN - sum;

  const changeCycle = (n: number) => {
    setCycle(n);
    setAppts((a) => a.filter((k) => k >= periodOf(today, n).start));
  };
  const addAppt = () => {
    const k = apptDate;
    if (!k) return;
    if (k < p.start || k > nx.end) return toast("이번 달이나 다음 달 날짜를 골라주세요.", true);
    if (!appts.includes(k)) setAppts([...appts, k]);
    setApptDate("");
  };
  const addFixed = () => {
    const nm = fxName.trim(), dayN = parseInt(fxDay, 10), amount = parse(fxAmt);
    if (!nm || !dayN || !amount) return toast("이름, 날짜, 금액을 모두 적어주세요.", true);
    setFixed([...fixed, { id: uid6(), name: nm, day: Math.min(31, Math.max(1, dayN)), amount }]);
    setFxName("");
    setFxDay("");
    setFxAmt("");
  };

  const saveSettings = () => {
    if (!totalN) return setErr("한 달 생활비를 적어주세요.");
    const wdN = parse(shownWd), weN = parse(shownWe);
    if (!auto && !wdN && !weN) return setErr("하루 한도를 적거나 자동으로 나누기를 켜주세요.");
    const paydayN = intOrNull(payday), cardPayN = intOrNull(cardPay), cardCutN = intOrNull(cardCut);
    if ((cardPayN && !cardCutN) || (!cardPayN && cardCutN)) return setErr("신용카드는 결제일과 사용 마감일을 둘 다 넣어주세요.");
    const goalAmtN = parse(goalAmt) || null, goalDateV = goalDate || null;
    if ((goalAmtN && !goalDateV) || (!goalAmtN && goalDateV)) return setErr("저축 목표는 금액과 날짜를 둘 다 넣어주세요.");
    const prev = cfg;
    const balRaw = balance.trim(), balanceN = balRaw ? parse(balRaw) : null;
    const balanceChanged = !prev || balanceN !== prev.balance;
    const curStart = periodOf(today, cycle).start;
    const oldAppts = prev ? (prev.appts || []).filter((k) => k < curStart) : [];
    update((d) => {
      d.settings = {
        name: name.trim(),
        cycleDay: cycle,
        total: totalN,
        autoLimits: auto,
        weekday: wdN,
        weekend: weN,
        appts: oldAppts.concat(appts),
        apptLimit: apl,
        balance: balanceN,
        balanceDate: balanceN == null ? null : balanceChanged ? today : prev!.balanceDate,
        payday: paydayN,
        salary: parse(salary) || null,
        fixed,
        cardPay: cardPayN,
        cardCut: cardCutN,
        goalAmt: goalAmtN,
        goalDate: goalDateV,
        firstStart: prev && prev.cycleDay === cycle ? prev.firstStart : null,
        accent,
      };
      // 이번 달부터는 새 설정으로 다시 나누기 (지난 달 계획은 그대로)
      Object.keys(d.periods).forEach((k) => {
        if (k >= curStart) delete d.periods[k];
      });
      if (prev && prev.cycleDay !== cycle) d.periods = {};
    });
    appliedAccent.current = accent;
    setView(null);
    toast(prev ? "저장했어요. 이번 달부터 새 설정이 적용돼요." : "시작했어요.");
    if (prev && section) goBack("setup");
    else go("home");
  };

  // 백업
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: Data; text: string } | null>(null);
  const [resetArmed, setResetArmed] = useState(false);
  useEffect(() => {
    if (!resetArmed) return;
    const t = window.setTimeout(() => setResetArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [resetArmed]);

  const saveBackup = () => {
    try {
      const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "거지노트-백업-" + today + ".json";
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("백업 파일을 저장했어요.");
    } catch {
      toast("백업 파일을 저장하지 못했어요.", true);
    }
  };
  const readBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const f = input.files && input.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = normalize(JSON.parse(String(r.result)), today);
        if (!data.settings) throw new Error("no settings");
        const n = Object.values(data.days).reduce((s, d) => s + ((d && d.items) || []).length, 0);
        setPending({ data, text: "매달 " + data.settings.cycleDay + "일 시작 · 기록 " + n + "건. 불러오면 지금 기록은 이 백업으로 바뀌어요." });
      } catch {
        toast("거지노트 백업 파일이 아니에요.", true);
      }
      input.value = "";
    };
    r.readAsText(f);
  };
  const applyBackup = () => {
    if (!pending) return;
    replace(pending.data);
    setPending(null);
    setView(null);
    toast("백업을 불러왔어요.");
    go("home");
  };
  const reset = () => {
    if (!resetArmed) return setResetArmed(true);
    replace(EMPTY());
    setView(null);
    go("");
    bumpForm();
    toast("모든 기록을 지웠어요.");
  };

  const step = (n: number, t: string) => (cfg ? t.replace(" (선택)", "") : n + " · " + t);
  const nameField = (
        <div className="field">
          <label htmlFor="cName">이름 (선택)</label>
          <input id="cName" maxLength={12} placeholder="예: 지민" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
  );
  const s1 = (
      <section className="card setup-sec">
        <span className="step">{step(1, "한 달 생활비")}</span>
        {!cfg && nameField}
        <div className="row">
          <div className="field" style={{ flex: "1 1 120px" }}>
            <label htmlFor="cCycle">매달 시작하는 날</label>
            <select id="cCycle" value={cycle} onChange={(e) => changeCycle(parseInt(e.target.value, 10) || 1)}>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1 + "일"}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "2 1 150px" }}>
            <label htmlFor="cTotal">한 달 생활비 (식비, 카페, 교통, 약속 등)</label>
            <MoneyInput id="cTotal" value={total} onValue={setTotal} placeholder="0" />
          </div>
        </div>
        <div className="preview">
          <span>{"이번 달: " + md(dOf(p.start)) + " ~ " + md(dOf(p.end))}</span>
          <span className="k">{"다음 달: " + md(dOf(nx.start)) + " ~ " + md(dOf(nx.end))}</span>
        </div>
        <p className="hint">월급날로 맞추면 편해요. 31일처럼 없는 날은 그 달 마지막 날로 맞춰요. 한 달이 끝나면 다음 달이 저절로 시작돼요.</p>
      </section>
  );
  const s2 = (
      <section className="card setup-sec">
        <span className="step">{step(2, "약속 날짜")}</span>
        <p className="hint">약속 있는 날은 한도를 더 크게 잡아요. 가계부 달력에서 날짜를 눌러 약속 날로 표시해도 돼요.</p>
        <div className="row">
          <div className="field" style={{ flex: "2 1 150px" }}>
            <label htmlFor="cApptDate">날짜</label>
            <input id="cApptDate" type="date" min={p.start} max={nx.end} value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
          </div>
          <button className="btn soft" style={{ flex: "0 0 auto" }} onClick={addAppt}>
            추가
          </button>
        </div>
        <div className="chips">
          {appts
            .slice()
            .sort()
            .map((k) => (
              <span key={k} className="chip">
                {sd(k) + " (" + DOW[dOf(k).getDay()] + ")"}
                <button className="rm" aria-label={sd(k) + " 약속 지우기"} onClick={() => setAppts(appts.filter((x) => x !== k))}>
                  ✕
                </button>
              </span>
            ))}
        </div>
        <div className="field">
          <label htmlFor="cApptLimit">약속 날 한도</label>
          <MoneyInput id="cApptLimit" value={apptLimit} onValue={setApptLimit} placeholder="0" />
        </div>
      </section>
  );
  const s3 = (
      <section className="card setup-sec">
        <span className="step">{step(3, "하루 한도")}</span>
        <div className="row">
          <div className="field">
            <label htmlFor="cWeekday">평일</label>
            <MoneyInput id="cWeekday" value={shownWd} onValue={setWeekday} placeholder="0" disabled={auto} />
          </div>
          <div className="field">
            <label htmlFor="cWeekend">주말</label>
            <MoneyInput id="cWeekend" value={shownWe} onValue={setWeekend} placeholder="0" disabled={auto} />
          </div>
        </div>
        <label className="split" htmlFor="cAutoOn">
          <input type="checkbox" id="cAutoOn" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> 매달 생활비에 맞춰 자동으로 나누기
        </label>
        <div className="preview" aria-live="polite">
          <span>{"이번 달 평일 " + counts.wd + "일 · 주말 " + counts.we + "일 · 약속 " + counts.ap + "일"}</span>
          <span className="k">
            {"한도 합계 " + won(sum) + " · "}
            <b className={reserve < 0 ? "minus" : "plus"}>{reserve < 0 ? "생활비보다 " + won(-reserve) + " 많아요" : "예비비 " + won(reserve)}</b>
          </span>
          {auto && <span className="k">달마다 날짜 수가 달라서 한도는 매달 새로 나눠요.</span>}
        </div>
      </section>
  );
  const s4 = (
      <section className="card setup-sec">
        <span className="step">{step(4, "통장과 월급 (선택)")}</span>
        <p className="hint">넣으면 '돈 일정' 탭에서 날짜별 통장 예상 잔액을 계산해요.</p>
        <div className="field">
          <label htmlFor="cBalance">지금 통장 잔액 (오늘 기준, 파킹통장 포함)</label>
          <MoneyInput id="cBalance" value={balance} onValue={setBalance} placeholder="0" />
        </div>
        <div className="row">
          <div className="field" style={{ flex: "1 1 100px" }}>
            <label htmlFor="cPayday">월급날 (일)</label>
            <input id="cPayday" type="number" min={1} max={31} inputMode="numeric" placeholder="예: 10" value={payday} onChange={(e) => setPayday(e.target.value)} />
          </div>
          <div className="field" style={{ flex: "2 1 150px" }}>
            <label htmlFor="cSalary">예상 실수령액</label>
            <MoneyInput id="cSalary" value={salary} onValue={setSalary} placeholder="0" />
          </div>
        </div>
      </section>
  );
  const s5 = (
      <section className="card setup-sec">
        <span className="step">{step(5, "매달 나가는 돈 (선택)")}</span>
        <p className="hint">월세, 대출, 통신비, 적금처럼 날짜가 정해진 돈이에요.</p>
        <div className="row">
          <div className="field" style={{ flex: "2 1 120px" }}>
            <label htmlFor="cFxName">이름</label>
            <input id="cFxName" maxLength={16} placeholder="예: 월세" value={fxName} onChange={(e) => setFxName(e.target.value)} />
          </div>
          <div className="field" style={{ flex: "1 1 70px" }}>
            <label htmlFor="cFxDay">날짜 (일)</label>
            <input id="cFxDay" type="number" min={1} max={31} inputMode="numeric" placeholder="19" value={fxDay} onChange={(e) => setFxDay(e.target.value)} />
          </div>
          <div className="field" style={{ flex: "2 1 110px" }}>
            <label htmlFor="cFxAmt">금액</label>
            <MoneyInput id="cFxAmt" value={fxAmt} onValue={setFxAmt} placeholder="0" />
          </div>
        </div>
        <button className="btn soft" onClick={addFixed}>
          추가
        </button>
        <ul className="tx">
          {fixed.map((f) => (
            <li key={f.id}>
              <SmallIco text={f.day + "일"} bg="var(--surface-2)" fg="var(--muted)" />
              <span className="t">
                <b>{f.name}</b>
                <span>{"매달 " + f.day + "일"}</span>
              </span>
              <span className="a">
                <b>{won(f.amount)}</b>
                <button className="del" aria-label={f.name + " 삭제"} onClick={() => setFixed(fixed.filter((x) => x.id !== f.id))}>
                  삭제
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
  );
  const s6 = (
      <section className="card setup-sec">
        <span className="step">{step(6, "신용카드 (선택)")}</span>
        <p className="hint">결제일과 사용 마감일을 넣으면 신용카드로 쓴 생활비가 어느 카드값에 붙는지 알려줘요.</p>
        <div className="row">
          <div className="field">
            <label htmlFor="cCardPay">결제일 (일)</label>
            <input id="cCardPay" type="number" min={1} max={31} inputMode="numeric" placeholder="예: 25" value={cardPay} onChange={(e) => setCardPay(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cCardCut">사용 마감일 (일)</label>
            <input id="cCardCut" type="number" min={1} max={31} inputMode="numeric" placeholder="예: 12" value={cardCut} onChange={(e) => setCardCut(e.target.value)} />
          </div>
        </div>
      </section>
  );
  const s7 = (
      <section className="card setup-sec">
        <span className="step">{step(7, "저축 목표 (선택)")}</span>
        <div className="row">
          <div className="field">
            <label htmlFor="cGoalAmt">목표 금액</label>
            <MoneyInput id="cGoalAmt" value={goalAmt} onValue={setGoalAmt} placeholder="예: 10,000,000" />
          </div>
          <div className="field">
            <label htmlFor="cGoalDate">목표 날짜</label>
            <input id="cGoalDate" type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} />
          </div>
        </div>
      </section>
  );
  const dataCard = (
      <section className="card setup-sec">
          <h2>기록 보관</h2>
          <p className="hint">기록은 이 기기의 브라우저에만 저장돼요. 기기를 바꾸거나 브라우저 기록을 지우기 전에 백업 파일을 저장해 두세요.</p>
          <div className="row">
            <button className="btn line" style={{ flex: 1 }} onClick={saveBackup}>
              백업 파일 저장
            </button>
            <button className="btn line" style={{ flex: 1, textAlign: "center" }} onClick={() => fileRef.current?.click()}>
              백업 불러오기
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={readBackup} />
          </div>
          {pending && (
            <>
              <div className="preview">{pending.text}</div>
              <button className="btn soft" onClick={applyBackup}>
                이 백업으로 바꾸기
              </button>
            </>
          )}
          <button className="btn line" style={{ color: "var(--over)" }} onClick={reset} aria-live="polite">
            {resetArmed ? "한 번 더 누르면 모든 기록이 지워져요" : "모든 기록 지우기"}
          </button>
        </section>
  );
  const saveArea = (
    <>
      <button className="btn" onClick={saveSettings}>
        {cfg ? "설정 저장" : "저장하고 시작하기"}
      </button>
      {err && (
        <p className="hint" style={{ color: "var(--over)" }} role="alert">
          {err}
        </p>
      )}
    </>
  );

  // 처음 시작할 때: 한 장에 모두 (그대로)
  if (!cfg)
    return (
      <div className="view">
        <section className="welcome">
          <h2>내 생활비, 하루 단위로 지키기</h2>
          <p>기간과 생활비만 넣으면 하루 한도를 나눠드려요. 나머지는 비워둬도 되고 나중에 바꿀 수 있어요.</p>
        </section>
        {s1}
        {s2}
        {s3}
        {s4}
        {s5}
        {s6}
        {s7}
        {saveArea}
        <button className="link" style={{ alignSelf: "center" }} onClick={openGuide}>
          사용법 다시 보기
        </button>
      </div>
    );

  // 시작한 뒤: 메뉴 → 하위 페이지
  const PAGES: Record<string, { title: string; body: JSX.Element; save: boolean }> = {
    budget: { title: "생활비와 한도", body: <>{s1}{s2}{s3}</>, save: true },
    money: { title: "통장과 수입·지출", body: <>{s4}{s5}{s6}</>, save: true },
    goal: { title: "저축 목표", body: s7, save: true },
    look: {
      title: "화면",
      body: (
        <>
          <section className="card setup-sec">
            <span className="step">이름</span>
            {nameField}
          </section>
          <section className="card setup-sec">
            <span className="step">메인 컬러</span>
            <p className="hint">버튼, 탭, 위쪽 큰 카드 색이 바뀌어요. 한도 초과(빨강)처럼 뜻이 있는 색은 그대로예요.</p>
            <div className="swatches" role="radiogroup" aria-label="메인 컬러">
              {ACCENTS.map((a) => (
                <button key={a.id} className="swatch" role="radio" aria-checked={accent === a.id} onClick={() => setAccent(a.id)}>
                  <i style={{ background: a.sw }} aria-hidden="true" />
                  {a.label}
                </button>
              ))}
            </div>
          </section>
        </>
      ),
      save: true,
    },
    data: { title: "기록 보관", body: dataCard, save: false },
  };
  const page = PAGES[section];
  if (page)
    return (
      <div className="view">
        <PageHead title={page.title} fallback="setup" />
        {page.body}
        {page.save && saveArea}
      </div>
    );

  const unread = currentUnread().length;
  const row = (key: string, title: string, desc: string, onClick: () => void, extra?: JSX.Element) => (
    <button key={key} className="menu-row" onClick={onClick}>
      <span className="mt">
        <b>{title}</b>
        {desc && <span>{desc}</span>}
      </span>
      <span className="chev" aria-hidden="true">
        {extra}
        {Icon.next}
      </span>
    </button>
  );
  return (
    <div className="view">
      <div className="page-head">
        <h1>설정</h1>
      </div>
      <section className="card menu" aria-label="내 설정">
        {row("budget", "생활비와 한도", "매달 " + cfg.cycleDay + "일 시작 · 생활비 " + man(cfg.total) + "원", () => go("setup/budget"))}
        {row(
          "money",
          "통장과 수입·지출",
          (typeof cfg.balance === "number" ? "통장 " + won(cfg.balance) : "통장 잔액 안 넣음") + " · 매달 나가는 돈 " + (cfg.fixed || []).length + "개",
          () => go("setup/money"),
        )}
        {row(
          "goal",
          "저축 목표",
          cfg.goalAmt && cfg.goalDate ? cfg.goalDate.slice(0, 4) + "년 " + Number(cfg.goalDate.slice(5, 7)) + "월까지 " + man(cfg.goalAmt) + "원" : "아직 안 정했어요",
          () => go("setup/goal"),
        )}
        {row("look", "화면", (cfg.name || "이름 없음") + " · " + accentLabel(cfg.accent), () => go("setup/look"))}
      </section>
      <section className="card menu" aria-label="기록과 도움말">
        {row("data", "기록 보관", "백업 저장·불러오기, 모든 기록 지우기", () => go("setup/data"))}
        {row("notice", "공지사항", "", () => go("notice"), unread ? <span className="badge">{"새 소식 " + unread}</span> : undefined)}
        {row("guide", "사용법 다시 보기", "", openGuide)}
      </section>
    </div>
  );
}
