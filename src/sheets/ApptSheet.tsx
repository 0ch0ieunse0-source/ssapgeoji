import { useEffect, useState } from "react";
import { MoneyInput } from "../components/common";
import { Sheet, SheetHead } from "../components/Sheet";
import { dOf, DOW, md } from "../lib/date";
import { fmt, parse, uid6, won } from "../lib/format";
import { periodsTouching, resplitPlans } from "../lib/period";
import { tripLength, tripsOverlap, type Trip, type TripFund } from "../lib/trip";
import type { Key } from "../lib/types";
import { useApp, useModel } from "../state/app";

export type ApptTarget = { day: Key; mode: "new" | "appt" | "trip"; trip?: Trip } | null;

/** 달력에서 약속·여행 추가·수정 */
export function ApptSheet({ target, onClose }: { target: ApptTarget; onClose: () => void }) {
  const { update, toast } = useApp();
  const { cfg, plan } = useModel();
  const [kind, setKind] = useState<"appt" | "trip">("appt");
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [budget, setBudget] = useState("");
  const [fund, setFund] = useState<TripFund>("living");
  const [delArmed, setDelArmed] = useState(false);

  useEffect(() => {
    if (!target) return;
    setDelArmed(false);
    const t = target.trip;
    setKind(target.mode === "trip" ? "trip" : "appt");
    setName(target.mode === "appt" ? cfg.apptNames?.[target.day] || "" : t?.name || "");
    setStart(t?.start || target.day);
    setEnd(t?.end || "");
    setBudget(t ? fmt(t.budget) : "");
    setFund(t?.fund || "living");
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return <Sheet open={false} onClose={onClose} labelledBy="apptTitle">{null}</Sheet>;
  const day = target.day;
  const title =
    target.mode === "new" ? "약속 추가 · " + md(dOf(day)) + " (" + DOW[dOf(day).getDay()] + ")" : target.mode === "appt" ? "약속 수정 · " + md(dOf(day)) : "여행 수정";

  /** 설정을 바꾸고, 걸친 달의 자동 한도를 다시 나눠요 */
  const commit = (fn: (c: NonNullable<typeof cfg>) => void, from: Key, to: Key) =>
    update((d) => {
      const c = d.settings!;
      fn(c);
      resplitPlans(d.periods, c, periodsTouching(from, to, c.cycleDay));
    });

  const saveAppt = () => {
    const n = name.trim();
    commit(
      (c) => {
        const set = new Set(c.appts || []);
        set.add(day);
        c.appts = Array.from(set).sort();
        const names = { ...(c.apptNames || {}) };
        if (n) names[day] = n;
        else delete names[day];
        c.apptNames = names;
      },
      day,
      day,
    );
    toast(target.mode === "new" ? (n || "약속") + " 날로 표시했어요. 이날 한도가 " + won(plan.apptLimit) + "이 돼요." : "약속을 바꿨어요.");
    onClose();
  };
  const removeAppt = () => {
    commit(
      (c) => {
        c.appts = (c.appts || []).filter((k) => k !== day);
        const names = { ...(c.apptNames || {}) };
        delete names[day];
        c.apptNames = names;
      },
      day,
      day,
    );
    toast("약속을 취소했어요.");
    onClose();
  };

  const saveTrip = () => {
    const b = parse(budget);
    if (!start || !end || !b) return toast("여행 시작일, 끝날, 예산을 모두 넣어주세요.", true);
    if (end < start) return toast("끝날이 시작일보다 빨라요.", true);
    const t: Trip = { id: target.trip?.id || uid6(), name: name.trim() || "여행", start, end, budget: b, fund };
    if (tripLength(t) > 60) return toast("여행은 60일까지 넣을 수 있어요.", true);
    if (tripsOverlap(cfg.trips || [], start, end, target.trip?.id)) return toast("다른 여행과 날짜가 겹쳐요.", true);
    const from = target.trip && target.trip.start < start ? target.trip.start : start;
    const to = target.trip && target.trip.end > end ? target.trip.end : end;
    commit(
      (c) => {
        c.trips = (c.trips || []).filter((x) => x.id !== t.id).concat(t).sort((a, z) => (a.start < z.start ? -1 : 1));
      },
      from,
      to,
    );
    toast(target.trip ? "여행을 바꿨어요." : t.name + "을 추가했어요. 그 기간은 여행 예산 안에서 써요.");
    onClose();
  };
  const removeTrip = () => {
    const t = target.trip!;
    if (!delArmed) return setDelArmed(true);
    commit(
      (c) => {
        c.trips = (c.trips || []).filter((x) => x.id !== t.id);
      },
      t.start,
      t.end,
    );
    toast("여행을 지웠어요. 기록은 그대로예요.");
    onClose();
  };

  return (
    <Sheet open={!!target} onClose={onClose} labelledBy="apptTitle">
      <SheetHead id="apptTitle" title={title} onClose={onClose} />
      {target.mode === "new" && (
        <div className="seg" role="group" aria-label="약속 종류">
          <button aria-pressed={kind === "appt"} onClick={() => setKind("appt")}>
            하루 약속
          </button>
          <button aria-pressed={kind === "trip"} onClick={() => setKind("trip")}>
            여행 (여러 날)
          </button>
        </div>
      )}
      {kind === "appt" ? (
        <>
          <div className="field">
            <label htmlFor="apName">어떤 약속이에요? (선택)</label>
            <input id="apName" maxLength={14} placeholder="예: 민지 생일" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveAppt()} />
          </div>
          <p className="hint">{"이날 한도는 약속 날 한도 " + won(plan.apptLimit) + "이 돼요."}</p>
          <button className="btn" onClick={saveAppt}>
            {target.mode === "new" ? "추가" : "저장"}
          </button>
          {target.mode === "appt" && (
            <button className="btn line" style={{ color: "var(--over)" }} onClick={removeAppt}>
              약속 취소
            </button>
          )}
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="apTName">여행 이름</label>
            <input id="apTName" maxLength={14} placeholder="예: 부산 여행" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="apStart">시작일</label>
              <input id="apStart" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="apEnd">끝날</label>
              <input id="apEnd" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="apBudget">여행 예산 (전체)</label>
            <MoneyInput id="apBudget" value={budget} onValue={setBudget} placeholder="0" />
          </div>
          <div className="lbl" id="apFundLbl">
            예산은 어디서 써요?
          </div>
          <div className="seg" role="group" aria-labelledby="apFundLbl">
            <button aria-pressed={fund === "living"} onClick={() => setFund("living")}>
              생활비 안에서
            </button>
            <button aria-pressed={fund === "separate"} onClick={() => setFund("separate")}>
              따로 모아 둔 돈
            </button>
          </div>
          <p className="hint">{fund === "living" ? "여행 예산만큼 그 달 다른 날 한도가 줄어요." : "생활비와 따로 계산해요. 다른 날 한도는 그대로예요."}</p>
          <button className="btn" onClick={saveTrip}>
            {target.trip ? "저장" : "여행 추가"}
          </button>
          {target.trip && (
            <button className="btn line" style={{ color: "var(--over)" }} onClick={removeTrip} aria-live="polite">
              {delArmed ? "한 번 더 누르면 여행이 지워져요" : "여행 삭제"}
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}
