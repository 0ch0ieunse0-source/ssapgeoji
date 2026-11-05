import { useEffect, useState } from "react";
import { settleMessage, type SettleInput } from "../lib/settle";
import { loadAccount, saveAccount } from "../state/account";
import { useApp } from "../state/app";

/** 복사 · 공유하기 버튼 */
export function ShareButtons({ text }: { text: string }) {
  const { toast } = useApp();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast("정산 메시지를 복사했어요. 단톡방에 붙여 넣어 주세요.");
    } catch {
      toast("복사하지 못했어요. 미리보기를 길게 눌러 복사해 주세요.", true);
    }
  };
  const share = async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ text });
    } catch {
      /* 공유 창을 닫았어요 */
    }
  };
  return (
    <div className="row">
      <button className="btn line" style={{ flex: 1 }} onClick={copy}>
        복사
      </button>
      <button className="btn soft" style={{ flex: 1 }} onClick={share}>
        공유하기
      </button>
    </div>
  );
}

/** 계좌 입력칸 (이 폰에만 저장) */
export function AccountFields({ onChange, idp = "ac" }: { onChange?: () => void; idp?: string }) {
  const [a, setA] = useState(loadAccount);
  const set = (patch: Partial<typeof a>) => {
    const next = { ...a, ...patch };
    setA(next);
    saveAccount(next);
    onChange?.();
  };
  return (
    <>
      <div className="row">
        <div className="field" style={{ flex: "1 1 90px" }}>
          <label htmlFor={idp + "Bank"}>은행</label>
          <input id={idp + "Bank"} maxLength={12} placeholder="예: 카카오뱅크" value={a.bank} onChange={(e) => set({ bank: e.target.value })} />
        </div>
        <div className="field" style={{ flex: "1 1 80px" }}>
          <label htmlFor={idp + "Holder"}>예금주</label>
          <input id={idp + "Holder"} maxLength={12} value={a.holder} onChange={(e) => set({ holder: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={idp + "Num"}>계좌번호</label>
        <input id={idp + "Num"} inputMode="numeric" maxLength={30} placeholder="예: 3333-01-1234567" value={a.number} onChange={(e) => set({ number: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor={idp + "Link"}>송금 링크 (선택)</label>
        <input id={idp + "Link"} maxLength={80} placeholder="toss.me/… 또는 카카오페이 송금 링크" value={a.link} onChange={(e) => set({ link: e.target.value })} />
      </div>
      <p className="hint">계좌는 이 폰에만 저장되고, 다음에도 자동으로 채워져요.</p>
    </>
  );
}

/** 정산 메시지 만들기 (베타) — 쓴 돈 적기 시트 안, 누를 때만 펼쳐져요 */
export function SettlePanel({
  defaultOpen = false,
  input,
  names,
  setNames,
  attend,
  setAttend,
}: {
  defaultOpen?: boolean;
  input: Omit<SettleInput, "names" | "attend" | "account">;
  names: string[];
  setNames: (v: string[]) => void;
  attend: boolean[][];
  setAttend: (v: boolean[][]) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [nameIn, setNameIn] = useState("");
  const [, bump] = useState(0);
  const roundsN = input.rounds.length > 1 ? input.rounds.length : 0;
  useEffect(() => {
    // 차수 수가 바뀌면 참여 표시를 맞춰요 (새 차수는 참여로)
    if (roundsN && attend.some((a) => a.length !== roundsN)) setAttend(names.map((_, i) => Array.from({ length: roundsN }, (_, k) => attend[i]?.[k] ?? true)));
  }, [roundsN]); // eslint-disable-line react-hooks/exhaustive-deps

  const addName = () => {
    const n = nameIn.trim();
    if (!n || names.length >= 19) return;
    setNames([...names, n]);
    setAttend([...attend, Array.from({ length: roundsN }, () => true)]);
    setNameIn("");
  };
  const text = settleMessage({ ...input, names, attend, account: loadAccount() });

  return (
    <div className="settle">
      <button className="settle-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        정산 메시지 만들기 <span className="badge warn">베타</span> <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && input.total <= 0 && <p className="hint">위에 금액을 넣으면 정산 메시지가 만들어져요.</p>}
      {open && input.total > 0 && (
        <>
          <div className="lbl">친구 이름 (선택)</div>
          <div className="row">
            <div className="field" style={{ flex: "2 1 140px" }}>
              <input aria-label="친구 이름" maxLength={10} placeholder="이름 넣고 추가" value={nameIn} onChange={(e) => setNameIn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addName()} />
            </div>
            <button className="btn soft" style={{ flex: "0 0 auto" }} onClick={addName}>
              추가
            </button>
          </div>
          {names.length > 0 && (
            <ul className="settle-names">
              {names.map((n, i) => (
                <li key={i}>
                  <b>{n}</b>
                  {roundsN > 0 && (
                    <span className="chips">
                      {Array.from({ length: roundsN }, (_, k) => (
                        <button
                          key={k}
                          className="chip"
                          aria-pressed={attend[i]?.[k] ?? true}
                          onClick={() => setAttend(names.map((_, j) => Array.from({ length: roundsN }, (_, kk) => (j === i && kk === k ? !(attend[j]?.[kk] ?? true) : attend[j]?.[kk] ?? true))))}
                        >
                          {k + 1 + "차"}
                        </button>
                      ))}
                    </span>
                  )}
                  <button
                    className="del"
                    aria-label={n + " 지우기"}
                    onClick={() => {
                      setNames(names.filter((_, j) => j !== i));
                      setAttend(attend.filter((_, j) => j !== i));
                    }}
                  >
                    지우기
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="lbl">내 계좌</div>
          <AccountFields onChange={() => bump((x) => x + 1)} />
          <div className="lbl">미리보기</div>
          <pre className="settle-preview">{text}</pre>
          <ShareButtons text={text} />
        </>
      )}
    </div>
  );
}
