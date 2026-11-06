import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../components/common";
import { PageHead } from "../components/PageHead";
import { Sheet } from "../components/Sheet";
import { normalizeId, validId, validPassword } from "../lib/vault";
import { useApp } from "../state/app";
import { forgetPasskeyHere, loginWithPasskey, passkeyOnThisPhone, passkeySupported, registerPasskey, removePasskey } from "../state/passkey";
import { changePassword, deleteAccount, errorText, historyGet, historyList, idAvailable, lastId, logIn, logOut, signUp } from "../state/vault";

const MASCOT = import.meta.env.BASE_URL + "mascot.png";

const ago = (t: number | null, now: number) => {
  if (!t) return "";
  const m = Math.floor((now - t) / 60000);
  return m < 1 ? "방금" : m < 60 ? m + "분 전" : m < 1440 ? Math.floor(m / 60) + "시간 전" : Math.floor(m / 1440) + "일 전";
};

type Flow = "intro" | "id" | "pw" | "face" | "done" | "login";

/** 단계 화면 머리: 뒤로가기 + (단계 표시) + 진행 막대 */
function FlowHead({ title, step, onBack }: { title?: string; step?: number; onBack: () => void }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), [step, title]);
  return (
    <>
      <div className="page-head">
        <button className="pbtn" aria-label="뒤로가기" onClick={onBack}>
          {Icon.prev}
        </button>
        <h1 ref={ref} tabIndex={-1}>
          {step ? step + " / 3" : title || ""}
        </h1>
        <span aria-hidden="true" />
      </div>
      {step ? (
        <div className="acct-prog" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} aria-label="가입 단계">
          <i style={{ width: (step / 3) * 100 + "%" }} />
        </div>
      ) : null}
    </>
  );
}

/** 아래에 붙는 버튼 영역 */
const Cta = ({ children }: { children: ReactNode }) => <div className="acct-cta">{children}</div>;

/** 설정 → 계정 (선택). 로그인하면 Safari·홈 화면 아이콘·다른 폰에서 같은 기록을 이어 써요 */
export function AccountView() {
  const { S, today, account, refreshAccount, syncNow, replace, toast, go, goBack, tick } = useApp();
  const [flow, setFlow] = useState<Flow>(() => (lastId() ? "login" : "intro"));
  const [id, setId] = useState(lastId);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [idState, setIdState] = useState<"" | "checking" | "ok" | "taken" | "bad" | "offline">("");
  const [forgot, setForgot] = useState(false);
  const [page, setPage] = useState<"" | "password" | "history">("");
  const [hist, setHist] = useState<{ version: number; at: string }[] | null>(null);
  const [armed, setArmed] = useState<"" | "logout" | "delete">("");
  const [pkOk, setPkOk] = useState(false);
  const [pkOn, setPkOn] = useState(passkeyOnThisPhone);
  void tick; // '몇 분 전'을 1분마다 새로
  useEffect(() => {
    passkeySupported().then(setPkOk);
  }, []);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(""), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);

  // 가입·로그인 단계 화면은 흰 바탕(다크 모드에선 다크 표면색)으로 보여줘요
  const plain = flow === "face" || flow === "done" || !account.id || page === "password";
  useEffect(() => {
    document.body.classList.toggle("page-plain", plain);
    return () => document.body.classList.remove("page-plain");
  }, [plain]);

  const nid = normalizeId(id);
  const records = Object.values(S.days).reduce((n, d) => n + (d?.items?.length || 0), 0);

  // 가입 1단계: 쓰는 동안 아이디를 쓸 수 있는지 바로 확인
  useEffect(() => {
    if (flow !== "id") return;
    if (!nid) return setIdState("");
    if (!validId(nid)) return setIdState("bad");
    setIdState("checking");
    let alive = true;
    const t = window.setTimeout(() => {
      idAvailable(nid).then(
        (free) => alive && setIdState(free ? "ok" : "taken"),
        () => alive && setIdState("offline"),
      );
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [nid, flow]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const to = (f: Flow) => {
    setErr(null);
    setShow(false);
    setFlow(f);
    window.scrollTo(0, 0);
  };

  const pwField = (autoComplete: "new-password" | "current-password", inputId: string) => (
    <div className="acct-f">
      <label htmlFor={inputId}>비밀번호</label>
      <div className="acct-in">
        <input
          id={inputId}
          name="password"
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder="8자 이상"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button type="button" className="acct-eye" aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"} aria-pressed={show} onClick={() => setShow(!show)}>
          {show ? Icon.eyeOff : Icon.eye}
        </button>
      </div>
    </div>
  );
  const errLine = err && (
    <p className="acct-err" role="alert">
      {err}
    </p>
  );
  const finishLogin = (merged: typeof S, how: string) => {
    replace(merged);
    refreshAccount();
    setPkOn(passkeyOnThisPhone());
    setPw("");
    toast(how + " 로그인했어요. 기록을 불러왔어요.");
    if (!S.settings) go("home");
  };
  const faceLogin = () => run(async () => finishLogin(await loginWithPasskey(S, today), "Face ID로"));

  // ── 가입 흐름 (가입 직후 Face ID·완료 화면은 로그인된 뒤에도 이어서 보여줘요) ──
  if (flow === "face" || flow === "done" || !account.id) {
    if (flow === "intro")
      return (
        <div className="view acct">
          <PageHead title="계정" fallback="setup" />
          {account.status === "error" && account.msg && (
            <p className="hint warn-note" role="alert">
              {account.msg}
            </p>
          )}
          <div className="acct-body">
            <h2 className="acct-h">
              어디서 열어도
              <br />
              같은 기록
            </h2>
            <p className="acct-sub">로그인해 두면 Safari, 홈 화면 아이콘, 새 폰 어디서 열어도 그대로 이어서 써요.</p>
            <ul className="acct-ben">
              <li>
                <i>{Icon.lock}</i>
                <span>
                  <b>나만 열 수 있게 잠가요</b>금액·메모는 잠근 채 저장돼서 저희도 못 봐요
                </span>
              </li>
              <li>
                <i>{Icon.cloud}</i>
                <span>
                  <b>적을 때마다 자동 저장</b>폰을 바꾸거나 브라우저 기록을 지워도 남아요
                </span>
              </li>
              <li>
                <i>{Icon.faceid}</i>
                <span>
                  <b>Face ID로 바로</b>다음부터는 비밀번호 없이 열어요
                </span>
              </li>
            </ul>
          </div>
          <Cta>
            <button className="btn acct-btn" onClick={() => to("id")}>
              시작하기
            </button>
            <button className="btn gray acct-btn" onClick={() => to("login")}>
              이미 계정이 있어요
            </button>
          </Cta>
          <AccountInfo />
        </div>
      );

    if (flow === "id")
      return (
        <div className="view acct">
          <FlowHead step={1} onBack={() => to("intro")} />
          <form
            className="acct-body"
            onSubmit={(e) => {
              e.preventDefault();
              if (idState === "ok") to("pw");
            }}
          >
            <h2 className="acct-h">
              쓸 아이디를
              <br />
              정해 주세요
            </h2>
            <p className="acct-sub">영어 소문자·숫자·밑줄로 4~16자. 나중에 로그인할 때 써요.</p>
            <div className="acct-f">
              <label htmlFor="suId">아이디</label>
              <div className="acct-in">
                <input
                  id="suId"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={16}
                  placeholder="예: jimin_01"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  autoFocus
                />
              </div>
              <p className={"acct-note " + (idState === "ok" ? "good" : idState === "taken" || idState === "bad" ? "bad" : "")} aria-live="polite">
                {idState === "ok" && Icon.check}
                {idState === "ok"
                  ? "쓸 수 있는 아이디예요"
                  : idState === "taken"
                  ? "이미 있는 아이디예요"
                  : idState === "bad"
                  ? "영어 소문자·숫자·밑줄로 4~16자예요"
                  : idState === "checking"
                  ? "확인하는 중…"
                  : idState === "offline"
                  ? "인터넷 연결을 확인해 주세요"
                  : ""}
              </p>
            </div>
            <Cta>
              <button className="btn acct-btn" type="submit" disabled={idState !== "ok"}>
                다음
              </button>
            </Cta>
          </form>
        </div>
      );

    if (flow === "pw")
      return (
        <div className="view acct">
          <FlowHead step={2} onBack={() => to("id")} />
          <form
            className="acct-body"
            onSubmit={(e) => {
              e.preventDefault();
              if (!validPassword(pw)) return setErr("비밀번호는 8자 이상이에요.");
              run(async () => {
                await signUp(nid, pw, S);
                setPw("");
                refreshAccount();
                to(pkOk ? "face" : "done");
              });
            }}
          >
            <h2 className="acct-h">
              비밀번호를
              <br />
              정해 주세요
            </h2>
            <p className="acct-sub">폰이 '암호 저장'을 물으면 꼭 저장해 주세요. 잊어도 로그인된 폰에서 바꿀 수 있어요.</p>
            <input type="text" name="username" autoComplete="username" value={nid} readOnly hidden />
            {pwField("new-password", "suPw")}
            <p className={"acct-note " + (validPassword(pw) ? "good" : "")}>
              {Icon.check}8자 이상
            </p>
            {errLine}
            <Cta>
              <button className="btn acct-btn" type="submit" disabled={busy || !validPassword(pw)}>
                {busy ? "잠그는 중…" : "가입하기"}
              </button>
            </Cta>
          </form>
        </div>
      );

    if (flow === "face")
      return (
        <div className="view acct">
          <FlowHead step={3} onBack={() => to("done")} />
          <div className="acct-body center">
            <div className="acct-art">{Icon.faceid}</div>
            <h2 className="acct-h">
              Face ID로
              <br />
              바로 열까요?
            </h2>
            <p className="acct-sub">다음부터 비밀번호 없이 Face ID·지문으로 로그인해요. 얼굴·지문 정보는 폰 밖으로 나가지 않아요.</p>
            {errLine}
          </div>
          <Cta>
            <button
              className="btn acct-btn"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await registerPasskey();
                  setPkOn(passkeyOnThisPhone());
                  to("done");
                })
              }
            >
              Face ID 켜기
            </button>
            <button className="link acct-later" onClick={() => to("done")}>
              나중에 할게요
            </button>
          </Cta>
        </div>
      );

    if (flow === "done")
      return (
        <div className="view acct">
          <div className="acct-body center">
            <div className="acct-done">
              <img src={MASCOT} alt="" width={160} height={131} />
              <i>{Icon.check}</i>
            </div>
            <h2 className="acct-h">보관을 시작했어요</h2>
            <p className="acct-sub">{account.id || nid}</p>
            <ul className="acct-list">
              <li>
                {Icon.check}
                {records ? "지금까지 기록 " + records + "건을 잠가서 보관했어요" : "이 폰 기록을 잠가서 보관했어요"}
              </li>
              <li>
                {Icon.check}앞으로 적을 때마다 자동으로 저장돼요
              </li>
              {pkOn && (
                <li>
                  {Icon.check}Face ID로 로그인 켜짐
                </li>
              )}
            </ul>
          </div>
          <Cta>
            <button className="btn acct-btn" onClick={() => (setFlow("login"), goBack(S.settings ? "setup" : ""))}>
              확인
            </button>
          </Cta>
        </div>
      );

    // 로그인
    return (
      <div className="view acct">
        <FlowHead title="로그인" onBack={() => (lastId() ? goBack("setup") : to("intro"))} />
        {account.status === "error" && account.msg && (
          <p className="hint warn-note" role="alert">
            {account.msg}
          </p>
        )}
        <form
          className="acct-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (!validId(nid)) return setErr("아이디를 다시 확인해 주세요.");
            if (!validPassword(pw)) return setErr("비밀번호는 8자 이상이에요.");
            run(async () => finishLogin(await logIn(nid, pw, S, today), ""));
          }}
        >
          <h2 className="acct-h">다시 오셨네요</h2>
          <p className="acct-sub">로그인하면 이 폰 기록과 합쳐서 보여드려요. 아무것도 지우지 않아요.</p>
          {pkOk && (
            <>
              <button type="button" className="btn dark acct-btn acct-face" disabled={busy} onClick={faceLogin}>
                {Icon.faceid}Face ID로 로그인
              </button>
              <div className="acct-or">또는 아이디로</div>
            </>
          )}
          <div className="acct-f">
            <label htmlFor="liId">아이디</label>
            <div className="acct-in">
              <input id="liId" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={16} value={id} onChange={(e) => setId(e.target.value)} />
            </div>
          </div>
          {pwField("current-password", "liPw")}
          {errLine}
          <Cta>
            <button className="btn acct-btn" type="submit" disabled={busy}>
              {busy ? "여는 중…" : "로그인"}
            </button>
            <button type="button" className="link acct-later" onClick={() => setForgot(true)}>
              비밀번호를 잊었어요
            </button>
            {!lastId() && (
              <button type="button" className="link acct-later" onClick={() => to("id")}>
                처음이에요? <b>가입하기</b>
              </button>
            )}
          </Cta>
        </form>
        <Sheet open={forgot} onClose={() => setForgot(false)} labelledBy="forgotTitle">
          <div className="sheet-head">
            <h2 id="forgotTitle">비밀번호를 잊었다면</h2>
            <button className="x" aria-label="닫기" onClick={() => setForgot(false)}>
              ✕
            </button>
          </div>
          <ol className="acct-forgot">
            <li>
              <b>로그인된 폰이 있나요?</b>그 폰에서 설정 → 계정 → 비밀번호 바꾸기. 예전 비밀번호 없이 바꿀 수 있어요.
            </li>
            <li>
              <b>Face ID를 켜 뒀나요?</b>'Face ID로 로그인'을 눌러 보세요.
            </li>
            <li>
              <b>폰에 저장돼 있을 수 있어요.</b>아이폰은 설정 → 암호(또는 '암호' 앱), 안드로이드는 구글 비밀번호 관리자에서 '거지노트'를 찾아보세요.
            </li>
          </ol>
          <p className="hint">기록은 잠겨 있어서 저희도 비밀번호를 알려드릴 수 없어요. 이 폰 기록은 그대로 남아요.</p>
          <button className="btn" onClick={() => setForgot(false)}>
            확인
          </button>
        </Sheet>
      </div>
    );
  }

  // ── 비밀번호 바꾸기 (로그인된 폰에서, 예전 비밀번호 없이) ──
  if (page === "password")
    return (
      <div className="view acct">
        <FlowHead title="비밀번호 바꾸기" onBack={() => (setPage(""), setErr(null))} />
        <form
          className="acct-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (!validPassword(pw)) return setErr("비밀번호는 8자 이상이에요.");
            run(async () => {
              await changePassword(pw);
              forgetPasskeyHere();
              setPkOn(null);
              setPw("");
              setPage("");
              toast("비밀번호를 바꿨어요." + (pkOk ? " Face ID는 다시 켜 주세요." : ""));
            });
          }}
        >
          <h2 className="acct-h">
            새 비밀번호를
            <br />
            정해 주세요
          </h2>
          <p className="acct-sub">이 폰은 로그인돼 있어서 예전 비밀번호 없이 바꿀 수 있어요. 다른 기기는 새 비밀번호로 다시 로그인해요.</p>
          <input type="text" name="username" autoComplete="username" value={account.id} readOnly hidden />
          {pwField("new-password", "cpPw")}
          <p className={"acct-note " + (validPassword(pw) ? "good" : "")}>
            {Icon.check}8자 이상
          </p>
          {errLine}
          <Cta>
            <button className="btn acct-btn" type="submit" disabled={busy || !validPassword(pw)}>
              {busy ? "바꾸는 중…" : "바꾸기"}
            </button>
          </Cta>
        </form>
      </div>
    );

  // ── 예전 상태로 되돌리기 ──
  if (page === "history")
    return (
      <div className="view">
        <FlowHead title="예전 상태로 되돌리기" onBack={() => setPage("")} />
        <section className="card setup-sec">
          <p className="hint">서버에 최근 10번 저장한 상태가 남아 있어요. 고르면 그때 기록으로 돌아가고, 지금 기록은 다시 예전 목록에 남아요.</p>
          {!hist && <p className="hint">불러오는 중…</p>}
          {hist && !hist.length && <p className="hint">아직 예전 상태가 없어요.</p>}
          <ul className="tx">
            {(hist || []).map((h) => (
              <li key={h.version}>
                <span className="t" style={{ gridColumn: "1 / 3" }}>
                  <b>{new Date(h.at).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</b>
                  <span>{h.version + "번째 저장"}</span>
                </span>
                <span className="a">
                  <button
                    className="btn line"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const d = await historyGet(h.version, today);
                        replace(d);
                        syncNow("push");
                        setPage("");
                        toast("그때 기록으로 되돌렸어요.");
                      })
                    }
                  >
                    되돌리기
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {errLine}
        </section>
      </div>
    );

  // ── 로그인된 상태 ──
  const st = account.status;
  const row = (title: string, desc: string, onClick: () => void, icon: ReactNode) => (
    <button className="menu-row acct-row" disabled={busy} onClick={onClick}>
      <i className="acct-ri">{icon}</i>
      <span className="mt">
        <b>{title}</b>
        <span>{desc}</span>
      </span>
      <span className="chev" aria-hidden="true">
        {Icon.next}
      </span>
    </button>
  );
  return (
    <div className="view">
      <PageHead title="계정" fallback="setup" />
      <section className="card setup-sec">
        <div className="acct-who">
          <i className="acct-ri">{Icon.shield}</i>
          <span>
            <b>{account.id}</b>
            <span className={"acct-st " + st}>
              {st === "saving" ? "저장하는 중…" : st === "error" ? account.msg || "저장하지 못했어요" : account.at ? "마지막 저장 " + ago(account.at, Date.now()) : "로그인됨"}
            </span>
          </span>
        </div>
        <p className="hint">적을 때마다 잠근 채로 저장돼요. 다른 기기에서 같은 아이디로 로그인하면 같은 기록이 보여요.</p>
        <button className="btn line" disabled={st === "saving"} onClick={() => syncNow("pull")}>
          지금 맞추기
        </button>
      </section>
      <section className="card menu">
        {pkOk &&
          row(
            pkOn ? "Face ID 로그인 켜짐" : "Face ID로 로그인 켜기",
            pkOn ? "누르면 이 폰에서 꺼요" : "비밀번호 없이 Face ID·지문으로 들어와요",
            () =>
              run(async () => {
                if (pkOn) {
                  await removePasskey();
                  setPkOn(null);
                  toast("이 폰의 Face ID 로그인을 껐어요.");
                } else {
                  await registerPasskey();
                  setPkOn(passkeyOnThisPhone());
                  toast("Face ID 로그인을 켰어요.");
                }
              }),
            Icon.faceid,
          )}
        {row("비밀번호 바꾸기", "예전 비밀번호 없이 이 폰에서 바꿔요", () => (setErr(null), setPw(""), setPage("password")), Icon.lock)}
        {row(
          "예전 상태로 되돌리기",
          "최근 10번 저장한 상태",
          () => {
            setErr(null);
            setHist(null);
            setPage("history");
            historyList().then(setHist, (e) => (setHist([]), setErr(errorText(e))));
          },
          Icon.cloud,
        )}
      </section>
      {errLine}
      <section className="card setup-sec">
        <button
          className="btn line"
          onClick={() => {
            if (armed !== "logout") return setArmed("logout");
            logOut();
            refreshAccount();
            setFlow("login");
            toast("로그아웃했어요. 이 폰 기록은 그대로 있어요.");
          }}
        >
          {armed === "logout" ? "한 번 더 누르면 로그아웃해요 (이 폰 기록은 남아요)" : "로그아웃"}
        </button>
        <button
          className="btn line"
          style={{ color: "var(--over)" }}
          disabled={busy}
          onClick={() => {
            if (armed !== "delete") return setArmed("delete");
            run(async () => {
              await deleteAccount();
              forgetPasskeyHere();
              refreshAccount();
              setFlow("intro");
              toast("계정을 지웠어요. 이 폰 기록은 그대로 있어요.");
            });
          }}
        >
          {armed === "delete" ? "한 번 더 누르면 서버 기록이 모두 지워져요" : "계정 지우기"}
        </button>
      </section>
      <AccountInfo />
    </div>
  );
}

function AccountInfo() {
  return (
    <details className="card setup-sec acct-info">
      <summary>무엇을 저장하나요?</summary>
      <ul className="hint">
        <li>서버에는 아이디와, 이 폰에서 잠근 기록만 저장돼요. 금액·메모·이름은 잠근 상태라 저희도 볼 수 없어요.</li>
        <li>비밀번호는 서버로 보내지 않아요. 폰에서 비밀번호로 만든 '출입증'만 보내요.</li>
        <li>Face ID·지문 정보는 폰 밖으로 나가지 않아요.</li>
        <li>이메일, 전화번호는 받지 않아요.</li>
        <li>비밀번호를 10번 틀리면 15분 동안 잠겨요.</li>
        <li>계정 지우기를 누르면 서버 기록은 모두 지워지고, 폰 기록은 남아요.</li>
        <li>로그인하지 않으면 지금처럼 이 폰에만 저장돼요.</li>
      </ul>
    </details>
  );
}
