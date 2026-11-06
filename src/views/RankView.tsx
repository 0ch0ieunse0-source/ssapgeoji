import { useEffect, useState } from "react";
import { PageHead } from "../components/PageHead";
import { Sheet, SheetHead } from "../components/Sheet";
import { md, sd, dOf } from "../lib/date";
import { nextAnnounce, normalizeCode, type RankedRow } from "../lib/rank";
import { useApp } from "../state/app";
import { createProfile, deleteProfile, fetchRows, POKE_MEMO_MAX, sendPoke, submitScore, type PokeKind } from "../state/rank";
import { useRank } from "../state/useRank";

const MAX_FRIENDS = 30;

export function BrokeBadge() {
  return <span className="badge over">💀 파산</span>;
}

function resultText(r: RankedRow) {
  if (r.state === "pending") return "집계 전";
  if (r.state === "nolog") return "기록 없음";
  return r.grade + " · " + r.pct + "%";
}

/** 친구 랭킹 페이지. 금액은 보이지도, 보내지도 않아요. */
export function RankView({ sub = "" }: { sub?: string }) {
  const { model, today, toast, go, goBack } = useApp();
  const { local, rows, error, season, refresh, update, score } = useRank();
  const [nick, setNick] = useState(model?.cfg.name || "");
  const [askOpen, setAskOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [editNick, setEditNick] = useState<string | null>(null);
  const [leaveArmed, setLeaveArmed] = useState(false);
  const [pokeTo, setPokeTo] = useState<{ row: RankedRow; kind: PokeKind } | null>(null);
  const [pokeMemo, setPokeMemo] = useState("");
  useEffect(() => {
    if (!leaveArmed) return;
    const t = window.setTimeout(() => setLeaveArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [leaveArmed]);

  const start = async () => {
    setBusy(true);
    try {
      await createProfile(nick.trim());
      setAskOpen(false);
      toast("랭킹을 시작했어요. 친구 코드를 친구에게 알려주세요.");
      await refresh();
    } catch {
      toast("시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.", true);
    } finally {
      setBusy(false);
    }
  };

  const addFriend = async () => {
    if (!local) return;
    const c = normalizeCode(code);
    if (!c) return toast("친구 코드를 다시 확인해 주세요. 예: GEOJI-7K3P9Q", true);
    if (c === local.code) return toast("내 코드예요. 친구 코드를 넣어주세요.", true);
    if (local.friends.includes(c)) return toast("이미 추가한 친구예요.", true);
    if (local.friends.length >= MAX_FRIENDS) return toast("친구는 " + MAX_FRIENDS + "명까지 추가할 수 있어요.", true);
    setBusy(true);
    try {
      const found = await fetchRows([c]);
      if (!found.length) return toast("그런 친구 코드가 없어요.", true);
      update({ ...local, friends: [...local.friends, c] });
      setCode("");
      toast(found[0].nickname + "님을 친구로 추가했어요.");
      goBack("rank");
    } catch {
      toast("추가하지 못했어요. 잠시 뒤 다시 시도해 주세요.", true);
    } finally {
      setBusy(false);
    }
  };

  const removeFriend = async (c: string) => {
    if (!local) return;
    update({ ...local, friends: local.friends.filter((x) => x !== c) });
    await refresh();
  };

  const saveNick = async () => {
    if (!local || editNick == null || !score) return;
    const n = editNick.trim();
    if (!n) return toast("닉네임을 적어주세요.", true);
    setBusy(true);
    try {
      const next = { ...local, nickname: n };
      await submitScore(next, season, score);
      update({ ...next, submitted: season.start });
      setEditNick(null);
      toast("닉네임을 바꿨어요.");
      await refresh();
    } catch {
      toast("바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요.", true);
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!local) return;
    if (!leaveArmed) return setLeaveArmed(true);
    setBusy(true);
    try {
      await deleteProfile(local);
      update(null);
      toast("랭킹을 그만했어요. 서버에서 내 프로필을 지웠어요.");
    } catch {
      toast("지우지 못했어요. 잠시 뒤 다시 시도해 주세요.", true);
    } finally {
      setBusy(false);
      setLeaveArmed(false);
    }
  };

  const openPoke = (row: RankedRow, kind: PokeKind) => {
    setPokeMemo("");
    setPokeTo({ row, kind });
  };
  const sendNow = async () => {
    if (!local || !pokeTo) return;
    const { row: r, kind } = pokeTo;
    setBusy(true);
    try {
      const res = await sendPoke(local, r.code, kind, pokeMemo);
      setPokeTo(null);
      if (res === "already") toast(kind === "cheer" ? "오늘은 이미 응원했어요. 내일 또 해주세요." : "오늘은 이미 콕 찔렀어요. 내일 또 찔러요.");
      else toast(kind === "cheer" ? r.nickname + "님께 👏 응원을 보냈어요." : r.nickname + "님을 👉 콕 찔렀어요.");
    } catch {
      toast("보내지 못했어요. 잠시 뒤 다시 시도해 주세요.", true);
    } finally {
      setBusy(false);
    }
  };
  const quickMemos = pokeTo?.kind === "cheer" ? ["잘하고 있어!", "이대로 꽃거지 가자", "오늘도 무지출 멋져"] : ["오늘도 한도 지켜요!", "커피 참아!", "무지출 가즈아"];
  const pokeSheet = (
    <Sheet open={!!pokeTo} onClose={() => setPokeTo(null)} labelledBy="pokeTitle">
      <SheetHead
        id="pokeTitle"
        title={pokeTo ? pokeTo.row.nickname + (pokeTo.kind === "cheer" ? "님 응원하기" : "님 콕 찌르기") : ""}
        onClose={() => setPokeTo(null)}
      />
      <div className="chips" role="group" aria-label="빠른 메모">
        {quickMemos.map((m) => (
          <button key={m} className="chip" aria-pressed={pokeMemo === m} onClick={() => setPokeMemo(m)}>
            {m}
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="pokeMemo">메모 (선택)</label>
        <input id="pokeMemo" maxLength={POKE_MEMO_MAX} placeholder="비워도 돼요" value={pokeMemo} onChange={(e) => setPokeMemo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendNow()} />
      </div>
      <p className="hint">메모는 친구에게 보여요. 금액 같은 개인 정보는 적지 마세요.</p>
      <button className="btn" disabled={busy} onClick={sendNow}>
        {pokeTo?.kind === "cheer" ? "👏 응원 보내기" : "👉 콕 찌르기"}
      </button>
    </Sheet>
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(local!.code);
      toast("친구 코드를 복사했어요.");
    } catch {
      toast("복사하지 못했어요. 코드를 길게 눌러 복사해 주세요.", true);
    }
  };

  const privacy = (
    <Sheet open={askOpen} onClose={() => setAskOpen(false)} labelledBy="rankAskTitle">
      <SheetHead id="rankAskTitle" title="랭킹을 시작하기 전에" onClose={() => setAskOpen(false)} />
      <div className="privacy">
        <div className="pv ok">
          <b>친구에게 보이는 것</b>
          <span>닉네임, 지킴률(%), 등급, 💀 파산 배지</span>
        </div>
        <div className="pv no">
          <b>절대 밖으로 나가지 않는 것</b>
          <span>쓴 금액, 생활비, 통장 잔액, 월급, 내역과 메모 같은 가계부 기록 전부. 지금처럼 이 폰에만 있어요.</span>
        </div>
        <ul>
          <li>지킴률은 이 폰에서 계산하고, 퍼센트만 올려요.</li>
          <li>내 친구 코드를 아는 사람은 내 닉네임과 등급을 볼 수 있어요.</li>
          <li>'랭킹 그만하기'를 누르면 서버에서 내 프로필이 지워져요.</li>
        </ul>
      </div>
      <div className="row">
        <button className="btn line" style={{ flex: 1 }} onClick={() => setAskOpen(false)}>
          취소
        </button>
        <button className="btn" style={{ flex: 2 }} disabled={busy} onClick={start}>
          {busy ? "시작하는 중…" : "동의하고 시작하기"}
        </button>
      </div>
    </Sheet>
  );

  if (!local)
    return (
      <div className="view">
        <PageHead title="친구 랭킹" fallback="space" />
        <section className="card setup-sec">
          <h2>친구와 누가 더 잘 지키나 겨뤄요</h2>
          <p className="hint">2주마다 한도를 지킨 날의 비율로 순위를 매겨요. 금액은 절대 공유되지 않아요.</p>
          <div className="grades">
            <span>90% 이상 꽃거지</span>
            <span>70% 이상 알뜰거지</span>
            <span>50% 이상 보통거지</span>
            <span>30% 이상 흔들거지</span>
            <span>30% 미만 핵거지</span>
            <span>2주 한도보다 30% 넘게 쓰면 💀 파산</span>
          </div>
          <div className="field">
            <label htmlFor="rNick">랭킹 닉네임</label>
            <input id="rNick" maxLength={12} placeholder="친구들이 알아볼 이름" value={nick} onChange={(e) => setNick(e.target.value)} />
          </div>
          <button className="btn" disabled={!nick.trim()} onClick={() => setAskOpen(true)}>
            랭킹 시작하기
          </button>
        </section>
        {privacy}
      </div>
    );

  if (sub === "add")
    return (
      <div className="view">
        <PageHead title="친구 추가" fallback="rank" />
        <section className="card setup-sec" aria-label="내 친구 코드">
          <h2>내 친구 코드</h2>
          <p className="hint">이 코드를 친구에게 보내 주세요. 친구가 넣으면 친구 랭킹에 내가 보여요.</p>
          <div className="code-box">
            <b>{local.code}</b>
            <button className="btn soft" onClick={copy}>
              복사
            </button>
          </div>
        </section>
      <section className="card setup-sec" aria-label="친구 추가">
        <h2>친구 코드 입력</h2>
        <div className="row">
          <div className="field" style={{ flex: "2 1 160px" }}>
            <label htmlFor="rCode">친구 코드</label>
            <input id="rCode" placeholder="GEOJI-7K3P9Q" autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addFriend()} />
          </div>
          <button className="btn soft" style={{ flex: "0 0 auto" }} disabled={busy || !code.trim()} onClick={addFriend}>
            추가
          </button>
        </div>
        <p className="hint">친구도 내 코드를 넣어야 친구 화면에 내가 보여요.</p>
      </section>
      </div>
    );

  const me = rows?.find((r) => r.code === local.code);
  return (
    <div className="view">
      <PageHead title="친구 랭킹" fallback="space" />
      <section className="card setup-sec" aria-label="내 프로필">
        {editNick == null ? (
          <div className="card-head">
            <h2>{local.nickname}</h2>
            <button className="link" onClick={() => setEditNick(local.nickname)}>
              닉네임 바꾸기
            </button>
          </div>
        ) : (
          <div className="row">
            <div className="field" style={{ flex: "2 1 160px" }}>
              <label htmlFor="rNick2">랭킹 닉네임</label>
              <input id="rNick2" maxLength={12} value={editNick} onChange={(e) => setEditNick(e.target.value)} />
            </div>
            <button className="btn soft" style={{ flex: "0 0 auto" }} disabled={busy} onClick={saveNick}>
              저장
            </button>
          </div>
        )}
        <div className="code-box">
          <span className="k">내 친구 코드</span>
          <b>{local.code}</b>
          <button className="btn soft" onClick={copy}>
            복사
          </button>
        </div>
      </section>

      <section className="card" aria-label="랭킹">
        <div className="card-head">
          <h2>{sd(season.start) + "~" + sd(season.end) + " 결과"}</h2>
          <button className="link" onClick={() => go("rank/add")}>
            ＋ 친구 추가
          </button>
        </div>
        <span className="k" style={{ marginTop: "-8px" }}>{"다음 발표 " + md(dOf(nextAnnounce(today)))}</span>
        {error ? (
          <div className="empty-box">
            <span>랭킹을 불러오지 못했어요.</span>
            <button className="btn soft" onClick={refresh}>
              다시 시도
            </button>
          </div>
        ) : !rows ? (
          <p className="hint">불러오는 중…</p>
        ) : (
          <>
            <ol className="rank-list">
              {rows.map((r) => (
                <li key={r.code} className={r.code === local.code ? "me" : undefined}>
                  <span className="rk">{r.rank ?? "-"}</span>
                  <span className="rn">
                    <b>
                      {r.nickname}
                      {r.code === local.code && <small> (나)</small>}
                    </b>
                    <span className={r.state === "ranked" ? "" : "k"}>{resultText(r)}</span>
                    {r.code !== local.code && (
                      <span className="pokes">
                        <button className="chip" aria-label={r.nickname + "님 응원하기"} onClick={() => openPoke(r, "cheer")}>
                          👏 응원
                        </button>
                        <button className="chip" aria-label={r.nickname + "님 콕 찌르기"} onClick={() => openPoke(r, "poke")}>
                          👉 콕
                        </button>
                      </span>
                    )}
                  </span>
                  <span className="ra">
                    {r.broke && r.state === "ranked" && <BrokeBadge />}
                    {r.code !== local.code && (
                      <button className="del" aria-label={r.nickname + " 친구 삭제"} onClick={() => removeFriend(r.code)}>
                        삭제
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            {rows.length <= 1 && (
              <div className="empty-box">
                <span>아직 친구가 없어요.</span>
                <button className="btn soft" onClick={() => go("rank/add")}>
                  친구 추가하기
                </button>
              </div>
            )}
            {me?.state === "nolog" && <p className="hint">지난 2주 동안 기록이 없어서 순위에 들지 않았어요.</p>}
          </>
        )}
      </section>


      {pokeSheet}
      <button className="btn line" style={{ color: "var(--over)" }} disabled={busy} onClick={leave} aria-live="polite">
        {leaveArmed ? "한 번 더 누르면 서버에서 내 프로필이 지워져요" : "랭킹 그만하기"}
      </button>
    </div>
  );
}
