import { useEffect, useState } from "react";
import { PageHead } from "../components/PageHead";
import { BOARD_URL } from "../board";
import { BOARD_MAX_NAME, BOARD_MAX_TEXT, checkPost, normalizePosts, timeAgo, type BoardPost } from "../lib/board";
import { useApp } from "../state/app";

const NAME_KEY = "ssapgeoji-board-name";
const LAST_KEY = "ssapgeoji-board-last";
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* 저장이 막혀 있어도 글은 올라가요 */
    }
  },
};

/** 기능 제안 (베타): 글은 구글 시트에 모이고, 모두에게 보여요. 가계부 기록과는 따로예요. */
export function BoardView() {
  const { toast } = useApp();
  const [posts, setPosts] = useState<BoardPost[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [name, setName] = useState(() => ls.get(NAME_KEY) || "");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoadErr(false);
    try {
      const r = await fetch(BOARD_URL + "?t=" + Date.now());
      setPosts(normalizePosts(await r.json()));
    } catch {
      setLoadErr(true);
    }
  };
  useEffect(() => {
    if (BOARD_URL) load();
  }, []);

  const submit = async () => {
    const problem = checkPost(text, Number(ls.get(LAST_KEY)) || null, Date.now());
    if (problem) return toast(problem, true);
    setSending(true);
    try {
      const body = { name: name.trim().slice(0, BOARD_MAX_NAME), text: text.trim().slice(0, BOARD_MAX_TEXT) };
      const r = await fetch(BOARD_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!j.ok) throw new Error(j.error || "fail");
      ls.set(LAST_KEY, String(Date.now()));
      ls.set(NAME_KEY, body.name);
      setPosts((p) => [{ t: Date.now(), name: body.name || "익명", text: body.text }, ...(p || [])]);
      setText("");
      toast("제안을 올렸어요. 고마워요!");
    } catch (e) {
      toast((e as Error).message === "busy" ? "지금 글이 많아요. 잠시 뒤에 다시 올려주세요." : "올리지 못했어요. 잠시 뒤 다시 시도해 주세요.", true);
    } finally {
      setSending(false);
    }
  };

  const now = Date.now();
  return (
    <div className="view">
      <PageHead title="기능 제안" fallback="setup" />
      {!BOARD_URL ? (
        <section className="card">
          <p className="hint">게시판을 준비하고 있어요.</p>
        </section>
      ) : (
        <>
          <section className="card setup-sec" aria-label="제안 쓰기">
            <div className="card-head">
              <h2>있었으면 하는 기능이 있나요?</h2>
              <span className="badge warn">베타</span>
            </div>
            <p className="hint">불편한 점이나 바라는 기능을 적어주세요. 쓴 글은 모든 사람에게 보여요. 이름, 연락처, 계좌 같은 개인 정보는 적지 마세요.</p>
            <div className="field">
              <label htmlFor="bName">닉네임 (선택)</label>
              <input id="bName" maxLength={BOARD_MAX_NAME} placeholder="비우면 익명" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="bText">제안 내용</label>
              <textarea
                id="bText"
                maxLength={BOARD_MAX_TEXT}
                placeholder="예: 카테고리를 직접 추가할 수 있으면 좋겠어요"
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-describedby="bCount"
              />
              <span id="bCount" className="k count">
                {text.length + " / " + BOARD_MAX_TEXT}
              </span>
            </div>
            <button className="btn" disabled={sending || !text.trim()} onClick={submit}>
              {sending ? "올리는 중…" : "제안 올리기"}
            </button>
          </section>

          <section className="card" aria-label="제안 목록" aria-busy={posts === null && !loadErr}>
            <div className="card-head">
              <h2>모두의 제안</h2>
              {posts && <span className="k">{posts.length + "개"}</span>}
            </div>
            {loadErr ? (
              <div className="empty-box">
                <span>불러오지 못했어요.</span>
                <button className="btn soft" onClick={load}>
                  다시 시도
                </button>
              </div>
            ) : posts === null ? (
              <p className="hint">불러오는 중…</p>
            ) : posts.length === 0 ? (
              <p className="hint">아직 제안이 없어요. 첫 제안을 남겨주세요.</p>
            ) : (
              <ul className="posts">
                {posts.map((p, i) => (
                  <li key={p.t + ":" + i}>
                    <div className="ph">
                      <b>{p.name}</b>
                      <span className="k">{timeAgo(p.t, now)}</span>
                    </div>
                    <p>{p.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
