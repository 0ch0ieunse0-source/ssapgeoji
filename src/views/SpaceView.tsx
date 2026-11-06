import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../components/common";
import { PageHead } from "../components/PageHead";
import { RoomScene } from "../components/RoomScene";
import { COIN_MEMO_MAX, nextTier, ROOM_TIERS, tierOf } from "../lib/space";
import { useApp } from "../state/app";
import { loadRank } from "../state/rank";
import { fetchSpace, fetchVisits, giveCoin, setAvatar, shrinkPhoto, type CoinVisit, type SpaceRow } from "../state/space";

/** 프로필 사진 (없으면 닉네임 첫 글자) */
export function Avatar({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {src ? <img src={src} alt="" width={size} height={size} /> : (name || "?").slice(0, 1)}
    </span>
  );
}

/** 사진 고르기 → 줄이기 → 올리기. 내 프로필(랭킹 프로필)이 있어야 해요 */
export function AvatarPicker({ row, onDone }: { row: SpaceRow | null; onDone: (src: string | null) => void }) {
  const { toast } = useApp();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const me = loadRank();
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !me) return;
    setBusy(true);
    try {
      const src = await shrinkPhoto(f);
      const r = await setAvatar(me, src);
      if (r !== "ok") throw new Error(r);
      onDone(src);
      toast("프로필 사진을 바꿨어요.");
    } catch {
      toast("사진을 올리지 못했어요. 다른 사진으로 해 보세요.", true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="avatar-pick">
      <button className="avatar-btn" aria-label="프로필 사진 바꾸기" disabled={busy || !me} onClick={() => ref.current?.click()}>
        <Avatar src={row?.avatar} name={row?.nickname || me?.nickname || ""} size={64} />
        <i aria-hidden="true">{Icon.camera}</i>
      </button>
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
      {row?.avatar && (
        <button
          className="link avatar-del"
          disabled={busy}
          onClick={async () => {
            if (!me) return;
            setBusy(true);
            try {
              await setAvatar(me, null);
              onDone(null);
              toast("프로필 사진을 지웠어요.");
            } catch {
              toast("지우지 못했어요. 잠시 뒤 다시 해 주세요.", true);
            } finally {
              setBusy(false);
            }
          }}
        >
          사진 지우기
        </button>
      )}
    </span>
  );
}

function CoinBar({ coins }: { coins: number }) {
  const n = nextTier(coins);
  return (
    <div className="coinbar">
      <div className="coinbar-top">
        <b>
          {Icon.coin}
          {coins + "개"}
        </b>
        <span className="k">{n ? n.name + "까지 " + n.left + "개" : "최고 단계예요"}</span>
      </div>
      {n && (
        <div className="coinbar-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(n.ratio * 100)} aria-label="다음 단계까지">
          <i style={{ width: n.ratio * 100 + "%" }} />
        </div>
      )}
    </div>
  );
}

function Visits({ code, reload }: { code: string; reload: number }) {
  const [list, setList] = useState<CoinVisit[] | null>(null);
  useEffect(() => {
    fetchVisits(code).then(setList, () => setList([]));
  }, [code, reload]);
  return (
    <section className="card">
      <div className="card-head">
        <h2>최근 동전</h2>
      </div>
      {list === null && <p className="hint">불러오는 중…</p>}
      {list && !list.length && <p className="hint">아직 동전을 받은 적이 없어요.</p>}
      <ul className="visits">
        {(list || []).map((v, i) => (
          <li key={i}>
            <i aria-hidden="true">{Icon.coin}</i>
            <span>
              <b>{v.from_nickname}</b>
              {v.memo ? <span>{v.memo}</span> : <span className="k">동전 주고 갔어요</span>}
            </span>
            <span className="k">{v.day.slice(5, 10).replace("-", "/")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 스페이스 탭: 내 방 · 친구 방 · 동전 */
export function SpaceView({ sub = "" }: { sub?: string }) {
  const { go, toast } = useApp();
  const me = loadRank();
  const [rows, setRows] = useState<SpaceRow[] | null>(null);
  const [err, setErr] = useState(false);
  const [reload, setReload] = useState(0);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const codes = me ? [me.code, ...me.friends] : [];
  const load = useCallback(() => {
    if (!me) return;
    setErr(false);
    fetchSpace([me.code, ...me.friends]).then(setRows, () => setErr(true));
  }, [me?.code, me?.friends.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [load, reload]);

  // 방 단계 구경하기
  if (sub === "tiers")
    return (
      <div className="view">
        <PageHead title="방 단계" fallback="space" />
        {ROOM_TIERS.map((t, i) => (
          <section key={t.name} className="card room-card">
            <RoomScene tier={i} />
            <div className="room-meta">
              <b>{i + 1 + "단계 · " + t.name}</b>
              <span className="k">{(i ? "동전 " + t.min + "개부터 · " : "처음 · ") + t.desc}</span>
            </div>
          </section>
        ))}
        <p className="hint">시즌 발표 때 파산(💀)이면 동전 30%를 잃어요. 단계가 내려갈 수도 있어요.</p>
      </div>
    );

  if (!me)
    return (
      <div className="view">
        <section className="card room-card">
          <RoomScene tier={0} />
          <div className="room-meta">
            <b>아직 내 방이 없어요</b>
            <span className="k">스페이스를 만들면 친구가 놀러 와서 동전을 주고 가요. 동전이 쌓일수록 길바닥이 펜트하우스가 돼요.</span>
          </div>
          <button className="btn" onClick={() => go("rank")}>
            스페이스 시작하기
          </button>
          <p className="hint">친구 랭킹과 같은 프로필을 써요. 금액·가계부 기록은 친구에게 보이지 않아요.</p>
        </section>
        <button className="link" style={{ alignSelf: "center" }} onClick={() => go("space/tiers")}>
          방 단계 구경하기
        </button>
      </div>
    );

  const mine = rows?.find((r) => r.code === me.code) || null;

  // 친구 방
  if (sub && sub !== me.code) {
    const f = rows?.find((r) => r.code === sub);
    const isFriend = me.friends.includes(sub);
    const give = async () => {
      setBusy(true);
      try {
        const r = await giveCoin(me, sub, memo);
        if (r === "ok") {
          toast("동전 1개 주고 왔어요.");
          setMemo("");
          setReload((x) => x + 1);
        } else if (r === "already") toast("오늘은 이미 동전을 줬어요. 내일 또 와요.");
        else toast("동전을 주지 못했어요.", true);
      } catch {
        toast("동전을 주지 못했어요. 인터넷 연결을 확인해 주세요.", true);
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="view">
        <PageHead title={f ? f.nickname + "의 방" : "친구 방"} fallback="space" />
        {!f && !err && <p className="hint">불러오는 중…</p>}
        {err && <p className="hint">불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>}
        {!isFriend && rows && <p className="hint">친구 목록에 없는 방이에요.</p>}
        {f && (
          <>
            <section className="card room-card">
              <RoomScene tier={tierOf(f.coins)} />
              <div className="room-who">
                <Avatar src={f.avatar} name={f.nickname} size={48} />
                <span>
                  <b>{f.nickname}</b>
                  <span className="k">
                    {ROOM_TIERS[tierOf(f.coins)].name + (f.grade ? " · " + f.grade + " " + f.pct + "%" : "")}
                    {f.broke ? " · 💀 파산" : ""}
                  </span>
                </span>
              </div>
              <CoinBar coins={f.coins} />
            </section>
            {isFriend && (
              <section className="card">
                <div className="field">
                  <label htmlFor="coinMemo">한마디 (선택)</label>
                  <input id="coinMemo" maxLength={COIN_MEMO_MAX} placeholder="예: 힘내라 거지야" value={memo} onChange={(e) => setMemo(e.target.value)} />
                </div>
                <button className="btn coin-btn" disabled={busy} onClick={give}>
                  {Icon.coin}동전 주고 가기
                </button>
                <p className="hint">한 친구에게 하루 1개 줄 수 있어요. 진짜 돈이 아니에요.</p>
              </section>
            )}
            <Visits code={f.code} reload={reload} />
          </>
        )}
      </div>
    );
  }

  // 내 스페이스
  const friends = (rows || []).filter((r) => r.code !== me.code).sort((a, b) => b.coins - a.coins);
  const t = tierOf(mine?.coins || 0);
  return (
    <div className="view">
      {err && (
        <p className="hint warn-note">
          스페이스를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요. (서버에 스페이스 기능이 아직 없을 수도 있어요)
        </p>
      )}
      <section className="card room-card">
        <RoomScene tier={t} />
        <div className="room-who">
          {/* 사진은 마이페이지에서만 바꿔요 */}
          <Avatar src={mine?.avatar} name={me.nickname} size={64} />
          <span>
            <b>{me.nickname + "의 방"}</b>
            <span className="k">{ROOM_TIERS[t].name + " · " + ROOM_TIERS[t].desc}</span>
          </span>
        </div>
        {mine && mine.coin_lost > 0 && <p className="hint warn-note">{"지난 시즌 파산해서 동전 " + mine.coin_lost + "개를 잃었어요 💀"}</p>}
        <CoinBar coins={mine?.coins || 0} />
        <div className="row">
          <button className="btn line" style={{ flex: 1 }} onClick={() => go("space/tiers")}>
            방 단계 보기
          </button>
          <button className="btn line" style={{ flex: 1 }} onClick={() => go("rank")}>
            랭킹 보기
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>친구 방</h2>
          <button className="link" onClick={() => go("rank/add")}>
            + 친구 추가
          </button>
        </div>
        {!me.friends.length && <p className="hint">친구를 추가하면 친구 방에 놀러 가서 동전을 줄 수 있어요. 내 친구 코드: {me.code}</p>}
        <ul className="friend-rooms">
          {friends.map((f) => (
            <li key={f.code}>
              <button onClick={() => go(`space/${f.code}`)}>
                <RoomScene tier={tierOf(f.coins)} className="mini" />
                <span className="fr-who">
                  <Avatar src={f.avatar} name={f.nickname} size={28} />
                  <b>{f.nickname}</b>
                </span>
                <span className="k">
                  {ROOM_TIERS[tierOf(f.coins)].name + " · "}
                  {Icon.coin}
                  {f.coins}
                </span>
              </button>
            </li>
          ))}
          {rows === null && codes.length > 1 && <li className="hint">불러오는 중…</li>}
        </ul>
      </section>

      <Visits code={me.code} reload={reload} />
    </div>
  );
}
