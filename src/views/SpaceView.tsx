import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/common";
import { PageHead } from "../components/PageHead";
import { RoomScene } from "../components/RoomScene";
import { COIN_MEMO_MAX, nextTier, ROOM_TIERS, tierOf } from "../lib/space";
import { useApp } from "../state/app";
import { loadRank } from "../state/rank";
import { fetchExtra, fetchSpace, fetchVisits, giveCoin, setAvatar, shrinkPhoto, type CoinVisit, type SpaceExtra, type SpaceRow } from "../state/space";
import type { PublicWish } from "../lib/space";

export { Avatar };

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

function WishList({ wish, mine }: { wish: PublicWish[] | null | undefined; mine?: boolean }) {
  const today = new Date();
  const dleft = (d: string) => Math.ceil((new Date(d + "T00:00:00").getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 864e5);
  if (!wish) return null;
  return (
    <section className="card">
      <div className="card-head">
        <h2>갖고 싶은 물건</h2>
        {mine && <span className="k">친구에게 이렇게 보여요</span>}
      </div>
      {!wish.length && <p className="hint">{mine ? "아끼기의 '사고 싶은 것'에 넣으면 여기 보여요." : "지금 참고 있는 물건이 없어요."}</p>}
      <ul className="wish-pub">
        {wish.map((w, i) => {
          const n = dleft(w.d);
          return (
            <li key={i}>
              <b>{w.n}</b>
              <span className={"badge" + (w.s === "bought" ? " over" : w.s === "skip" ? " good" : "")}>
                {w.s === "wait" ? (n > 0 ? "참는 중 D-" + n : "고민 끝") : w.s === "skip" ? "참았어요 👏" : "결국 샀어요"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Visits({ code, reload, hidden }: { code: string; reload: number; hidden?: boolean }) {
  const [list, setList] = useState<CoinVisit[] | null>(null);
  useEffect(() => {
    fetchVisits(code).then(setList, () => setList([]));
  }, [code, reload]);
  return (
    <section className="card">
      <div className="card-head">
        <h2>최근 동전</h2>
      </div>
      {hidden && <p className="hint">최근 동전을 공개하지 않은 방이에요.</p>}
      {!hidden && list === null && <p className="hint">불러오는 중…</p>}
      {!hidden && list && !list.length && <p className="hint">아직 동전을 받은 적이 없어요.</p>}
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
  const [extra, setExtra] = useState<Record<string, SpaceExtra>>({});
  const [err, setErr] = useState(false);
  const [reload, setReload] = useState(0);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const codes = me ? [me.code, ...me.friends] : [];
  const load = useCallback(() => {
    if (!me) return;
    setErr(false);
    fetchSpace([me.code, ...me.friends]).then(setRows, () => setErr(true));
    // 갖고 싶은 물건 · 최근 동전 공개 여부 (서버에 아직 없으면 그냥 안 보여요)
    fetchExtra([me.code, ...me.friends]).then((x) => setExtra(Object.fromEntries(x.map((e) => [e.code, e]))), () => undefined);
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
            <WishList wish={extra[f.code]?.wish} />
            <Visits code={f.code} reload={reload} hidden={extra[f.code] ? !extra[f.code].visits : false} />
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

      <WishList wish={extra[me.code] ? extra[me.code].wish : null} mine />
      <Visits code={me.code} reload={reload} />
      <button className="link" style={{ alignSelf: "center" }} onClick={() => go("setup/share")}>
        친구에게 보여줄 것 고르기
      </button>
    </div>
  );
}
