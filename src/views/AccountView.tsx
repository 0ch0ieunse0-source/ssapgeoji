import { useEffect, useState } from "react";
import { PageHead } from "../components/PageHead";
import { normalizeId, validId, validPassword } from "../lib/vault";
import { useApp } from "../state/app";
import { changePassword, deleteAccount, errorText, historyGet, historyList, idAvailable, lastId, logIn, logOut, signUp } from "../state/vault";

const ago = (t: number | null, now: number) => {
  if (!t) return "";
  const m = Math.floor((now - t) / 60000);
  return m < 1 ? "방금" : m < 60 ? m + "분 전" : m < 1440 ? Math.floor(m / 60) + "시간 전" : Math.floor(m / 1440) + "일 전";
};

/** 설정 → 계정 (선택). 로그인하면 Safari·홈 화면 아이콘·다른 폰에서 같은 기록을 이어 써요 */
export function AccountView() {
  const { S, today, account, refreshAccount, syncNow, replace, toast, go, tick } = useApp();
  // 이 폰에서 로그인한 적이 있으면 로그인 칸부터, 기록만 있는 처음 사용자는 가입부터
  const [mode, setMode] = useState<"login" | "signup">(() => (S.settings && !lastId() ? "signup" : "login"));
  const [id, setId] = useState(lastId);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState<"" | "password" | "history">("");
  const [hist, setHist] = useState<{ version: number; at: string }[] | null>(null);
  const [armed, setArmed] = useState<"" | "logout" | "delete">("");
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(""), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  void tick; // '몇 분 전'을 1분마다 새로

  const nid = normalizeId(id);
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validId(nid)) return setErr("아이디는 영어 소문자·숫자·밑줄로 4~16자예요.");
    if (!validPassword(pw)) return setErr("비밀번호는 8자 이상이에요.");
    if (mode === "signup" && pw !== pw2) return setErr("비밀번호 확인이 달라요.");
    run(async () => {
      if (mode === "signup") {
        if (!(await idAvailable(nid))) return setErr("이미 있는 아이디예요. 다른 아이디를 써 주세요.");
        await signUp(nid, pw, S);
        toast("가입했어요. 이제 이 기록이 잠긴 채로 저장돼요.");
      } else {
        const merged = await logIn(nid, pw, S, today);
        replace(merged);
        toast("로그인했어요. 기록을 불러왔어요.");
        if (!S.settings) go("home");
      }
      setPw("");
      setPw2("");
      refreshAccount();
    });
  };

  // ── 로그인 전 ──
  if (!account.id)
    return (
      <div className="view">
        <PageHead title="계정" fallback="setup" />
        {account.status === "error" && account.msg && (
          <p className="hint warn-note" role="alert">
            {account.msg}
          </p>
        )}
        <section className="card setup-sec">
          <div className="seg" role="group" aria-label="로그인 또는 가입">
            <button aria-pressed={mode === "login"} onClick={() => (setMode("login"), setErr(null))}>
              로그인
            </button>
            <button aria-pressed={mode === "signup"} onClick={() => (setMode("signup"), setErr(null))}>
              가입
            </button>
          </div>
          <p className="hint">
            {mode === "signup"
              ? "가입하면 지금 이 폰 기록이 잠긴 채로 저장돼요. Safari, 홈 화면 아이콘, 다른 폰에서 로그인하면 같은 기록이 보여요."
              : "가입한 아이디로 로그인하면 기록을 불러와요. 이 폰에 적어 둔 기록이 있으면 지우지 않고 합쳐요."}
          </p>
          <form className="acct-form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="acId">아이디</label>
              <input id="acId" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={16} placeholder="영어 소문자·숫자 4~16자" value={id} onChange={(e) => setId(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="acPw">비밀번호</label>
              <input id="acPw" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="8자 이상" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            {mode === "signup" && (
              <div className="field">
                <label htmlFor="acPw2">비밀번호 확인</label>
                <input id="acPw2" name="password2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
            )}
            {err && (
              <p className="hint" style={{ color: "var(--over)" }} role="alert">
                {err}
              </p>
            )}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "잠그는 중…" : mode === "signup" ? "가입하기" : "로그인"}
            </button>
          </form>
          {mode === "signup" && (
            <p className="hint warn-note">
              비밀번호를 잊으면 서버에 저장된 기록은 저희도 열 수 없어요. 가입할 때 폰이 <b>"암호를 저장할까요?"</b>라고 물으면 꼭 '저장'을 눌러 주세요. 로그인된 폰에서는 예전 비밀번호 없이도 비밀번호를 바꿀 수 있어요.
            </p>
          )}
        </section>
        <AccountInfo />
      </div>
    );

  // ── 비밀번호 바꾸기 ──
  if (page === "password")
    return (
      <div className="view">
        <div className="page-head">
          <button className="pbtn" aria-label="뒤로가기" onClick={() => setPage("")}>
            ‹
          </button>
          <h1>비밀번호 바꾸기</h1>
          <span aria-hidden="true" />
        </div>
        <section className="card setup-sec">
          <p className="hint">이 폰은 로그인돼 있어서 예전 비밀번호 없이 바꿀 수 있어요. 다른 기기는 새 비밀번호로 다시 로그인해야 해요.</p>
          <form
            className="acct-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!validPassword(pw)) return setErr("비밀번호는 8자 이상이에요.");
              if (pw !== pw2) return setErr("비밀번호 확인이 달라요.");
              run(async () => {
                await changePassword(pw);
                setPw("");
                setPw2("");
                setPage("");
                toast("비밀번호를 바꿨어요.");
              });
            }}
          >
            <input type="text" name="username" autoComplete="username" value={account.id} readOnly hidden />
            <div className="field">
              <label htmlFor="acNew">새 비밀번호</label>
              <input id="acNew" type="password" autoComplete="new-password" placeholder="8자 이상" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="acNew2">새 비밀번호 확인</label>
              <input id="acNew2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            {err && (
              <p className="hint" style={{ color: "var(--over)" }} role="alert">
                {err}
              </p>
            )}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "바꾸는 중…" : "바꾸기"}
            </button>
          </form>
        </section>
      </div>
    );

  // ── 예전 상태로 되돌리기 ──
  if (page === "history")
    return (
      <div className="view">
        <div className="page-head">
          <button className="pbtn" aria-label="뒤로가기" onClick={() => setPage("")}>
            ‹
          </button>
          <h1>예전 상태로 되돌리기</h1>
          <span aria-hidden="true" />
        </div>
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
          {err && <p className="hint" style={{ color: "var(--over)" }}>{err}</p>}
        </section>
      </div>
    );

  // ── 로그인된 상태 ──
  const st = account.status;
  return (
    <div className="view">
      <PageHead title="계정" fallback="setup" />
      <section className="card setup-sec">
        <div className="acct-who">
          <b>{account.id}</b>
          <span className={"acct-st " + st}>
            {st === "saving" ? "저장하는 중…" : st === "error" ? account.msg || "저장하지 못했어요" : account.at ? "마지막 저장 " + ago(account.at, Date.now()) + " ✓" : "로그인됨"}
          </span>
        </div>
        <p className="hint">적을 때마다 잠근 채로 저장돼요. 다른 기기에서 같은 아이디로 로그인하면 같은 기록이 보여요.</p>
        <button className="btn line" disabled={st === "saving"} onClick={() => syncNow("pull")}>
          지금 맞추기
        </button>
      </section>
      <section className="card menu">
        <button className="menu-row" onClick={() => (setErr(null), setPage("password"))}>
          <span className="mt">
            <b>비밀번호 바꾸기</b>
            <span>예전 비밀번호 없이 이 폰에서 바꿔요</span>
          </span>
          <span className="chev" aria-hidden="true">›</span>
        </button>
        <button
          className="menu-row"
          onClick={() => {
            setErr(null);
            setHist(null);
            setPage("history");
            historyList().then(setHist, (e) => (setHist([]), setErr(errorText(e))));
          }}
        >
          <span className="mt">
            <b>예전 상태로 되돌리기</b>
            <span>최근 10번 저장한 상태</span>
          </span>
          <span className="chev" aria-hidden="true">›</span>
        </button>
      </section>
      <section className="card setup-sec">
        <button
          className="btn line"
          onClick={() => {
            if (armed !== "logout") return setArmed("logout");
            logOut();
            refreshAccount();
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
              refreshAccount();
              toast("계정을 지웠어요. 이 폰 기록은 그대로 있어요.");
            });
          }}
        >
          {armed === "delete" ? "한 번 더 누르면 서버 기록이 모두 지워져요" : "계정 지우기"}
        </button>
        {err && <p className="hint" style={{ color: "var(--over)" }}>{err}</p>}
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
        <li>이메일, 전화번호는 받지 않아요.</li>
        <li>비밀번호를 10번 틀리면 15분 동안 잠겨요.</li>
        <li>계정 지우기를 누르면 서버 기록은 모두 지워지고, 폰 기록은 남아요.</li>
        <li>로그인하지 않으면 지금처럼 이 폰에만 저장돼요.</li>
      </ul>
    </details>
  );
}
