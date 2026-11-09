import { BigWon } from "../components/common";
import { Sheet, SheetHead } from "../components/Sheet";
import type { Leftover } from "../lib/flex";
import { won } from "../lib/format";
import { useApp, useModel } from "../state/app";

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + won(Math.abs(n));

/** 홈의 예비비를 누르면: 어떻게 계산됐는지, 어디에 쓰는지, 남은 돈을 어떻게 할지 */
export function ReserveSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { update, toast, go } = useApp();
  const { flex, isCur } = useModel();
  const f = flex;
  const pool = f.diff - f.moved;
  const avg = f.n ? Math.floor(f.given / f.n / 10) * 10 : 0;

  const setMode = (v: Leftover) => {
    if (v === f.mode) return;
    update((d) => {
      if (d.settings) d.settings.leftover = v;
    });
    toast(v === "spread" ? "이제 남은 돈은 남은 날 한도에 나눠 더해요." : "이제 남은 돈은 예비비에 모아요. 하루 한도는 그대로예요.");
  };
  const goTo = (r: "ledger" | "save") => {
    onClose();
    go(r);
  };

  return (
    <Sheet open={open} onClose={onClose} labelledBy="reserveTitle">
      <SheetHead id="reserveTitle" title="예비비" onClose={onClose} />
      <div className={"rs-big" + (f.reserve < 0 ? " minus" : "")}>
        <BigWon n={f.reserve} />
      </div>

      <ul className="rs-rows">
        <li>
          <span>
            처음 예비비
            <small>생활비 − 하루 한도 합계</small>
          </span>
          <b>{won(f.base)}</b>
        </li>
        {f.mode === "reserve" ? (
          <>
            <li>
              <span>
                {f.diff >= 0 ? "지난날 덜 쓴 돈" : "지난날 더 쓴 돈"}
                <small>기록한 날만 (한도 − 쓴 돈)</small>
              </span>
              <b className={f.diff < 0 ? "minus" : f.diff > 0 ? "plus" : ""}>{sign(f.diff)}</b>
            </li>
            {f.moved > 0 && (
              <li>
                <span>저축통장으로 옮긴 돈</span>
                <b>{sign(-f.moved)}</b>
              </li>
            )}
          </>
        ) : (
          <>
            <li>
              <span>
                {pool >= 0 ? "지난날 남은 돈" : "지난날 더 쓴 돈"}
                <small>{f.moved > 0 ? "옮긴 돈 " + won(f.moved) + " 빼고" : "기록한 날만 (한도 − 쓴 돈)"}</small>
              </span>
              <b className={pool < 0 ? "minus" : pool > 0 ? "plus" : ""}>{sign(pool)}</b>
            </li>
            <li>
              <span>
                남은 날 한도로 나눔
                <small>{f.n ? "오늘부터 " + f.n + "일, 하루 평균 " + sign(avg) : "나눌 날이 없어요"}</small>
              </span>
              <b>{sign(-f.given)}</b>
            </li>
          </>
        )}
      </ul>
      {!isCur && <p className="hint">지난달·다음 달은 원래 한도로 보여줘요.</p>}

      <div className="lbl" id="leftLbl">
        덜 쓴 돈은
      </div>
      <div className="seg" role="group" aria-labelledby="leftLbl">
        <button aria-pressed={f.mode === "spread"} onClick={() => setMode("spread")}>
          남은 날에 나눠 쓰기
        </button>
        <button aria-pressed={f.mode === "reserve"} onClick={() => setMode("reserve")}>
          예비비에 모으기
        </button>
      </div>
      <p className="hint">
        {f.mode === "spread"
          ? "평일 한도 1만원 중 1천원만 쓰면, 남은 9천원이 다음 날부터 남은 날 한도에 조금씩 더해져요. 더 쓰면 남은 날 한도가 조금씩 줄어요."
          : "하루 한도는 그대로예요. 덜 쓴 돈은 예비비에 모이고, 더 쓴 날은 예비비에서 빠져요."}
      </p>

      <div className="rs-use">
        <b>예비비는 이렇게 써요</b>
        <span>· 약속이 생기거나 급한 날, 달력에서 날짜를 눌러 한도를 올리면 예비비에서 빠져요.</span>
        <span>· 넉넉하면 아끼기 탭에서 저축통장으로 옮기거나 목표에 보태요.</span>
        <span>· 기록 안 한 날은 계산에서 빠져요. 안 쓴 날은 '오늘은 안 썼어요'를 눌러 주세요.</span>
      </div>

      <div className="cta-bar">
        <button className="btn gray" onClick={() => goTo("ledger")}>
          한도 바꾸기
        </button>
        <button className="btn" onClick={() => goTo("save")}>
          저축하러 가기
        </button>
      </div>
    </Sheet>
  );
}
