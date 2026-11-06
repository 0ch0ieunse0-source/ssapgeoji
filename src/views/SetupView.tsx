import { useEffect, useRef, useState } from "react";
import { MoneyInput, SmallIco } from "../components/common";
import { dOf, DOW, md, sd } from "../lib/date";
import { fmt, man, parse, uid6, won } from "../lib/format";
import { countsFor, daysFor, periodOf, shiftPeriod, splitFor } from "../lib/period";
import { tripLength, tripsOverlap, type Trip, type TripFund } from "../lib/trip";
import { EMPTY, normalize } from "../lib/storage";
import type { Data, Fixed, Settings } from "../lib/types";
import { PageHead } from "../components/PageHead";
import { RangePicker } from "../components/RangePicker";
import { Icon } from "../components/common";
import { ACCENTS, accentLabel, accentOf, applyAccent, type AccentId } from "../lib/theme";
import { currentUnread } from "../notices";
import { useApp } from "../state/app";
import { AccountView } from "./AccountView";

const DEFAULTS: Partial<Settings> = { cycleDay: 1, total: 0, apptLimit: 30000, appts: [], fixed: [], autoLimits: true };
const intOrNull = (s: string) => parseInt(s, 10) || null;

export function SetupView({ section = "" }: { section?: string }) {
  const { S, today, update, replace, setView, toast, go, goBack, bumpForm, openGuide, account } = useApp();
  const cfg = S.settings;
  const c = cfg || DEFAULTS;
  // 처음에 '나중에 입력하기'로 시작해서 생활비가 비어 있어요
  const blank = !!cfg && !cfg.total;
  const [fstep, setFstep] = useState<1 | 2>(1);

  const [name, setName] = useState(c.name || "");
  const [cycle, setCycle] = useState(c.cycleDay || 1);
  const [total, setTotal] = useState(fmt(c.total));
  const [apptLimit, setApptLimit] = useState(fmt(c.apptLimit || (blank ? DEFAULTS.apptLimit : 0)));
  const [appts, setAppts] = useState<string[]>(() => (c.appts || []).filter((k) => k >= periodOf(today, c.cycleDay || 1).start));
  const [apptDate, setApptDate] = useState("");
  const [apptName, setApptName] = useState("");
  const [apptNames, setApptNames] = useState<Record<string, string>>(() => ({ ...(c.apptNames || {}) }));
  const [trips, setTrips] = useState<Trip[]>(() => (c.trips || []).filter((t) => t.end >= periodOf(today, c.cycleDay || 1).start).map((t) => ({ ...t })));
  const [tName, setTName] = useState("");
  const [tStart, setTStart] = useState("");
  const [tEnd, setTEnd] = useState("");
  const [tBudget, setTBudget] = useState("");
  const [tFund, setTFund] = useState<TripFund>("living");
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
  // 처음 쓰기 전 날: 기존 사용자는 '그대로', 새로 시작하면 '0으로 처리'가 기본이에요
  const [preStart, setPreStart] = useState<"zero" | "keep">(c.preStart || (cfg ? "keep" : "zero"));
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
  const counts = countsFor(p, appts, trips);
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
  const join = cfg?.joinDate || today;
  const preDays =
    join > p.start
      ? daysFor(p, { total: totalN, apptLimit: apl, auto: auto, weekday: parse(shownWd), weekend: parse(shownWe) }, appts, trips, (k) => k < join && !S.days[k]?.items?.length && !S.days[k]?.noSpend && typeof S.days[k]?.limit !== "number").filter((d) => d.pre)
      : [];
  const preCut = preDays.reduce((x, d) => x + (d.preBase || 0), 0);
  const sum = counts.wd * parse(shownWd) + counts.we * parse(shownWe) + counts.ap * apl + (counts.trip || 0);
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
    const nm = apptName.trim();
    setApptNames((m) => {
      const next = { ...m };
      if (nm) next[k] = nm;
      else delete next[k];
      return next;
    });
    setApptDate("");
    setApptName("");
  };
  const addTrip = () => {
    const budget = parse(tBudget);
    if (!tStart || !tEnd || !budget) return toast("여행 시작일, 끝날, 예산을 모두 넣어주세요.", true);
    if (tEnd < tStart) return toast("끝날이 시작일보다 빨라요.", true);
    if (tEnd < p.start) return toast("이미 지난 여행은 넣을 수 없어요.", true);
    const t: Trip = { id: uid6(), name: tName.trim() || "여행", start: tStart, end: tEnd, budget, fund: tFund };
    if (tripLength(t) > 60) return toast("여행은 60일까지 넣을 수 있어요.", true);
    if (tripsOverlap(trips, tStart, tEnd)) return toast("다른 여행과 날짜가 겹쳐요.", true);
    setTrips([...trips, t].sort((a, b) => (a.start < b.start ? -1 : 1)));
    setTName("");
    setTStart("");
    setTEnd("");
    setTBudget("");
  };
  const addFixed = () => {
    const nm = fxName.trim(), dayN = parseInt(fxDay, 10), amount = parse(fxAmt);
    if (!nm || !dayN || !amount) return toast("이름, 날짜, 금액을 모두 적어주세요.", true);
    setFixed([...fixed, { id: uid6(), name: nm, day: Math.min(31, Math.max(1, dayN)), amount }]);
    setFxName("");
    setFxDay("");
    setFxAmt("");
  };

  /** skip: "all"은 아무것도 넣지 않고 시작, "optional"은 2장(선택 항목)만 비우고 시작 */
  const saveSettings = (skip?: "all" | "optional") => {
    if (skip) {
      const all = skip === "all";
      update((d) => {
        d.settings = {
          name: all ? "" : name.trim(),
          cycleDay: all ? 1 : cycle,
          total: all ? 0 : totalN,
          autoLimits: all ? true : auto,
          weekday: all ? 0 : parse(shownWd),
          weekend: all ? 0 : parse(shownWe),
          appts: [],
          trips: [],
          apptNames: {},
          apptLimit: all ? 0 : apl,
          balance: null,
          balanceDate: null,
          payday: null,
          salary: null,
          fixed: [],
          cardPay: null,
          cardCut: null,
          goalAmt: null,
          goalDate: null,
          firstStart: null,
          accent,
          joinDate: today,
          preStart: all ? "zero" : preStart,
        };
        d.periods = {};
      });
      appliedAccent.current = accent;
      setView(null);
      toast(all ? "시작했어요. 생활비는 설정에서 넣을 수 있어요." : "시작했어요.");
      go("home");
      return;
    }
    // 생활비를 아직 안 넣었어도 다른 설정 페이지는 저장할 수 있어요
    if (!totalN && !(blank && section !== "budget")) return setErr("한 달 생활비를 적어주세요.");
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
        trips: (prev?.trips || []).filter((t) => t.end < curStart).concat(trips),
        apptNames: Object.fromEntries(
          Object.entries({ ...(prev?.apptNames || {}), ...apptNames }).filter(([k, v]) => v && (oldAppts.includes(k) || appts.includes(k))),
        ),
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
        firstStart: prev && prev.cycleDay === cycle && prev.total ? prev.firstStart : null,
        accent,
        joinDate: prev?.joinDate || today,
        preStart,
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

  const step = (_n: number, t: string) => (cfg ? t.replace(" (선택)", "") : t);
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
            <MoneyInput id="cTotal" value={total} onValue={setTotal} placeholder="예: 400,000" />
          </div>
        </div>
        <div className="preview">
          <span>{"이번 달: " + md(dOf(p.start)) + " ~ " + md(dOf(p.end))}</span>
          <span className="k">{"다음 달: " + md(dOf(nx.start)) + " ~ " + md(dOf(nx.end))}</span>
        </div>
        {preDays.length > 0 && totalN > 0 && (
          <div className="pre-box">
            <div className="lbl" id="preLbl">
              {"이번 달 이미 지난 날 (" + sd(preDays[0].key) + "~" + sd(preDays[preDays.length - 1].key) + " · " + preDays.length + "일)"}
            </div>
            <div className="seg" role="group" aria-labelledby="preLbl">
              <button aria-pressed={preStart === "zero"} onClick={() => setPreStart("zero")}>
                0으로 처리
              </button>
              <button aria-pressed={preStart === "keep"} onClick={() => setPreStart("keep")}>
                그대로 두기
              </button>
            </div>
            <p className="hint">
              {preStart === "zero"
                ? "그 날들 한도 " + won(preCut) + "을 이번 달 생활비에서 빼요. 이번 달 생활비는 " + won(Math.max(0, totalN - preCut)) + "이 돼요. 다른 날 한도는 그대로예요."
                : "지난 날도 원래 한도로 계산해요. 기록하지 않은 날의 한도는 쓴 돈 없이 남아 있어요."}
              {" 기록을 적은 날은 바뀌지 않아요."}
            </p>
          </div>
        )}
        <p className="hint">월급날로 맞추면 편해요. 31일처럼 없는 날은 그 달 마지막 날로 맞춰요. 한 달이 끝나면 다음 달이 저절로 시작돼요.</p>
      </section>
  );
  const s2 = (
      <section className="card setup-sec">
        <span className="step">{step(2, "약속과 여행")}</span>
        <p className="hint">약속 있는 날은 한도를 더 크게 잡아요. 가계부 달력에서 날짜를 눌러 약속 날로 표시해도 돼요.</p>
        <div className="field">
          <label htmlFor="cApptName">어떤 약속이에요? (선택)</label>
          <input id="cApptName" maxLength={14} placeholder="예: 민지 생일" value={apptName} onChange={(e) => setApptName(e.target.value)} />
        </div>
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
                {sd(k) + " (" + DOW[dOf(k).getDay()] + ")" + (apptNames[k] ? " " + apptNames[k] : "")}
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
        <div className="trip-box">
          <b className="trip-title">여행 (여러 날)</b>
          <p className="hint">여행 기간에는 하루 한도 없이 여행 예산 안에서 써요.</p>
          <div className="field">
            <label htmlFor="tName">여행 이름</label>
            <input id="tName" maxLength={14} placeholder="예: 부산 여행" value={tName} onChange={(e) => setTName(e.target.value)} />
          </div>
          <div className="lbl">기간</div>
          <RangePicker
            start={tStart}
            end={tEnd}
            today={today}
            onChange={(a, b) => {
              setTStart(a);
              setTEnd(b);
            }}
          />
          <div className="field">
            <label htmlFor="tBudget">여행 예산 (전체)</label>
            <MoneyInput id="tBudget" value={tBudget} onValue={setTBudget} placeholder="0" />
          </div>
          <div className="lbl" id="tFundLbl">
            예산은 어디서 써요?
          </div>
          <div className="seg" role="group" aria-labelledby="tFundLbl">
            <button aria-pressed={tFund === "living"} onClick={() => setTFund("living")}>
              생활비 안에서
            </button>
            <button aria-pressed={tFund === "separate"} onClick={() => setTFund("separate")}>
              따로 모아 둔 돈
            </button>
          </div>
          <p className="hint">{tFund === "living" ? "여행 예산만큼 이번 달 다른 날 한도가 줄어요." : "생활비와 따로 계산해요. 다른 날 한도는 그대로예요."}</p>
          <button className="btn soft" onClick={addTrip}>
            여행 추가
          </button>
          {trips.length > 0 && (
            <ul className="tx">
              {trips.map((t) => (
                <li key={t.id}>
                  <SmallIco text={tripLength(t) + "일"} bg="var(--accent-soft)" fg="var(--accent)" />
                  <span className="t">
                    <b>{t.name}</b>
                    <span>{sd(t.start) + "~" + sd(t.end) + " · " + (t.fund === "living" ? "생활비 안에서" : "따로 모아 둔 돈")}</span>
                  </span>
                  <span className="a">
                    <b>{won(t.budget)}</b>
                    <button className="del" aria-label={t.name + " 삭제"} onClick={() => setTrips(trips.filter((x) => x.id !== t.id))}>
                      삭제
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
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
          <span>{"이번 달 평일 " + counts.wd + "일 · 주말 " + counts.we + "일 · 약속 " + counts.ap + "일" + (counts.td ? " · 여행 " + counts.td + "일" : "")}</span>
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
          {!account.id && (
            <button className="link" style={{ textAlign: "left" }} onClick={() => go("setup/account")}>
              로그인해 두면 백업 없이도 자동으로 보관돼요 →
            </button>
          )}
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
      <button className="btn" onClick={() => saveSettings()}>
        {cfg ? "설정 저장" : "저장하고 시작하기"}
      </button>
      {err && (
        <p className="hint" style={{ color: "var(--over)" }} role="alert">
          {err}
        </p>
      )}
    </>
  );

  // 전에 쓰던 기록 불러오기: Safari·홈 화면 아이콘·카톡 안 브라우저는 기록을 따로 저장해서, 다른 곳에서 열면 비어 보여요
  const restoreCard = (
    <section className="card setup-sec restore">
      <h2>전에 쓰던 기록이 있나요?</h2>
      <button className="btn" onClick={() => go("setup/account")}>
        로그인해서 이어 쓰기
      </button>
      <p className="hint">계정이 없다면 아래 방법으로 옮길 수 있어요.</p>
      <p className="hint">
        기록은 연 곳마다 따로 저장돼요. Safari, 홈 화면 아이콘, 카카오톡 안에서 연 화면은 서로의 기록을 볼 수 없어요. 쓰던 곳에서 <b>설정 → 기록 보관 → 백업 파일 저장</b>을 한 다음, 여기서 불러오면 그대로 이어서 쓸 수 있어요.
      </p>
      <button className="btn line" onClick={() => fileRef.current?.click()}>
        백업 불러오기
      </button>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={readBackup} />
      {pending && (
        <>
          <div className="preview">{pending.text}</div>
          <button className="btn" onClick={applyBackup}>
            이 백업으로 시작하기
          </button>
        </>
      )}
    </section>
  );

  if (section === "account") return <AccountView />;

  // 처음 시작할 때: 두 장으로 나눠요. 둘 다 '나중에 입력하기'로 건너뛸 수 있어요
  if (!cfg) {
    const goStep2 = () => {
      if (!totalN) return setErr("한 달 생활비를 적거나 '나중에 입력하기'를 눌러 주세요.");
      setErr(null);
      setFstep(2);
      window.scrollTo(0, 0);
    };
    return (
      <div className="view">
        <section className="welcome">
          <span className="k fstep">{fstep + " / 2"}</span>
          <h2>{fstep === 1 ? "내 생활비, 하루 단위로 지키기" : "통장·카드·목표 (선택)"}</h2>
          <p>{fstep === 1 ? "기간과 생활비만 넣으면 하루 한도를 나눠드려요." : "넣으면 돈 일정과 카드값, 목표를 계산해 드려요."}</p>
          <p className="later-note">지금 안 넣어도 돼요. 나중에 설정에서 언제든 넣을 수 있어요.</p>
        </section>
        {fstep === 1 && restoreCard}
        {fstep === 1 ? (
          <>
            {s1}
            {s3}
            <p className="hint">약속·여행은 시작한 뒤 가계부 달력에서 날짜를 눌러 추가해요.</p>
            <button className="btn" onClick={goStep2}>
              다음
            </button>
          </>
        ) : (
          <>
            {s4}
            {s5}
            {s6}
            {s7}
            <div className="onb-actions two">
              <button
                className="btn line"
                onClick={() => {
                  setErr(null);
                  setFstep(1);
                  window.scrollTo(0, 0);
                }}
              >
                이전
              </button>
              <button className="btn" onClick={() => saveSettings()}>
                시작하기
              </button>
            </div>
          </>
        )}
        {err && (
          <p className="hint" style={{ color: "var(--over)" }} role="alert">
            {err}
          </p>
        )}
        <button className="btn line" onClick={() => saveSettings(fstep === 1 ? "all" : "optional")}>
          나중에 입력하기
        </button>
        <button className="link" style={{ alignSelf: "center" }} onClick={() => openGuide()}>
          사용법 다시 보기
        </button>
      </div>
    );
  }

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
      <PageHead title="설정" fallback="home" />
      <section className="card menu" aria-label="내 설정">
        {row("budget", "생활비와 한도", blank ? "아직 안 넣었어요" : "매달 " + cfg.cycleDay + "일 시작 · 생활비 " + man(cfg.total) + "원", () => go("setup/budget"))}
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
        {row("account", "계정", account.id ? account.id + "로 로그인됨" : "로그인하면 어디서 열어도 같은 기록 (선택)", () => go("setup/account"), account.id ? undefined : <span className="badge">추천</span>)}
        {row("data", "기록 보관", "백업 저장·불러오기, 모든 기록 지우기", () => go("setup/data"))}
        {row("notice", "공지사항", "", () => go("notice"), unread ? <span className="badge">{"새 소식 " + unread}</span> : undefined)}
        {row("install", "홈 화면에 추가하는 법", "Safari·Chrome에서 앱처럼 쓰기", () => openGuide(true))}
        {row("guide", "사용법 다시 보기", "", () => openGuide())}
      </section>
    </div>
  );
}
