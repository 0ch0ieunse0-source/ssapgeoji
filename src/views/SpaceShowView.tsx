import { useEffect, useState } from "react";
import { PageHead } from "../components/PageHead";
import { buildPublicWish, SHOW_ALL, SPACE_SHOW, type SpaceShow, type SpaceShowKey } from "../lib/space";
import { useApp } from "../state/app";
import { loadRank } from "../state/rank";
import { cachedShow, cacheShow, fetchMyShow, markWishSent, saveShow, saveWish } from "../state/space";

/** 마이페이지 → 스페이스 공개 설정: 친구가 내 방에서 볼 수 있는 것을 하나씩 켜고 꺼요 */
export function SpaceShowView() {
  const { S, toast, go } = useApp();
  const me = loadRank();
  const [show, setShow] = useState<SpaceShow | null>(cachedShow);
  const [busy, setBusy] = useState<SpaceShowKey | null>(null);
  useEffect(() => {
    if (!me) return;
    fetchMyShow(me).then(
      (s) => {
        const v = s || SHOW_ALL;
        setShow(v);
        cacheShow(v);
      },
      () => setShow((x) => x || SHOW_ALL),
    );
  }, [me?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me)
    return (
      <div className="view">
        <PageHead title="스페이스 공개 설정" fallback="setup" />
        <section className="card">
          <p className="hint">스페이스를 시작하면 친구에게 보여줄 것을 고를 수 있어요.</p>
          <button className="btn" onClick={() => go("space")}>
            스페이스로 가기
          </button>
        </section>
      </div>
    );

  const toggle = async (key: SpaceShowKey) => {
    if (!show) return;
    const next = { ...show, [key]: !show[key] };
    setBusy(key);
    try {
      const r = await saveShow(me, { [key]: next[key] });
      if (r !== "ok") throw new Error(r);
      setShow(next);
      cacheShow(next);
      if (key === "wish") {
        markWishSent(null);
        // 다시 켜면 지금 목록을 바로 올려요 (이름·날짜·상태만)
        if (next.wish) await saveWish(me, buildPublicWish(S.wish.items)).then((x) => x === "ok" && markWishSent(JSON.stringify(buildPublicWish(S.wish.items))));
      }
      toast(next[key] ? "친구에게 보여요." : "이제 친구에게 안 보여요.");
    } catch {
      toast("바꾸지 못했어요. 잠시 뒤 다시 해 주세요.", true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="view">
      <PageHead title="스페이스 공개 설정" fallback="setup" />
      <section className="card">
        <p className="hint">친구가 내 방에 들어왔을 때 보이는 것이에요. 닉네임, 방 단계, 동전 수는 늘 보여요. 생활비·쓴 돈 같은 금액은 어떤 경우에도 안 보여요.</p>
        <ul className="show-list">
          {SPACE_SHOW.map((o) => (
            <li key={o.key}>
              <span>
                <b>{o.label}</b>
                <span className="k">{o.desc}</span>
              </span>
              <label className="switch">
                <input type="checkbox" role="switch" aria-label={o.label + " 공개"} checked={show ? show[o.key] : true} disabled={!show || busy === o.key} onChange={() => toggle(o.key)} />
                <span aria-hidden="true" />
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
