import { useEffect, useState } from "react";
import { Icon } from "../components/common";
import { ROOM_TIERS, tierOf } from "../lib/space";
import { useApp } from "../state/app";
import { loadRank } from "../state/rank";
import { fetchSpace, type SpaceRow } from "../state/space";
import { Avatar, AvatarPicker } from "./SpaceView";

/** 마이페이지 맨 위: 프로필 사진 · 이름 · 방 단계 · 계정 */
export function MyProfile() {
  const { model, account, go } = useApp();
  const me = loadRank();
  const [row, setRow] = useState<SpaceRow | null>(null);
  useEffect(() => {
    if (me) fetchSpace([me.code]).then((r) => setRow(r[0] || null), () => setRow(null));
  }, [me?.code]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = me?.nickname || model?.cfg.name || "거지";
  return (
    <section className="card my-profile">
      <div className="room-who">
        {me ? <AvatarPicker row={row} onDone={(src) => setRow((r) => (r ? { ...r, avatar: src } : r))} /> : <Avatar name={name} size={64} />}
        <span>
          <b>{name}</b>
          <span className="k">
            {me ? ROOM_TIERS[tierOf(row?.coins || 0)].name + " · 동전 " + (row?.coins ?? 0) + "개" : "스페이스를 만들면 사진을 올릴 수 있어요"}
          </span>
          <span className="k">{account.id ? account.id + "로 로그인됨" : "로그인 안 함"}</span>
        </span>
      </div>
      <div className="row">
        <button className="btn line" style={{ flex: 1 }} onClick={() => go("space")}>
          {Icon.space}내 방
        </button>
        <button className="btn line" style={{ flex: 1 }} onClick={() => go("setup/account")}>
          {Icon.shield}
          {account.id ? "계정" : "로그인"}
        </button>
      </div>
    </section>
  );
}
