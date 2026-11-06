import { rankEnabled } from "../rankConfig";
import { useApp } from "../state/app";
import { useRank } from "../state/useRank";
import { BrokeBadge } from "../views/RankView";
import { Icon, pressable } from "./common";
import { RankEvents } from "./RankEvents";
import { Avatar } from "./Avatar";

/** 홈 가운데의 친구 랭킹 요약 카드 */
export function RankCard() {
  if (!rankEnabled()) return null;
  return <RankCardInner />;
}

function RankCardInner() {
  const { go } = useApp();
  const { local, rows, error, season, avatars } = useRank();
  const top = (rows || []).filter((r) => r.state === "ranked").slice(0, 3);
  const me = rows?.find((r) => r.code === local?.code);
  const ranked = rows?.filter((r) => r.state === "ranked").length || 0;
  let line = "친구와 누가 더 잘 지키나 겨뤄보세요";
  if (local) {
    if (error) line = "랭킹을 불러오지 못했어요";
    else if (!rows) line = "불러오는 중…";
    else if (me?.state === "ranked") line = me.grade + " · " + me.pct + "% · " + ranked + "명 중 " + me.rank + "등";
    else line = "지난 2주 기록이 없어요";
  }
  return (
    <>
    {local && <RankEvents local={local} rows={rows} season={season} failed={error} />}
    <section className="card rank-card" aria-label="친구 랭킹" {...pressable(() => go("rank"))}>
      <div className="card-head">
        <h2>친구 랭킹</h2>
        <span className="chev" aria-hidden="true">
          {Icon.next}
        </span>
      </div>
      <div className="rank-line">
        {local && <Avatar src={avatars[local.code]} name={local.nickname} size={32} />}
        <span>{line}</span>
        {me?.state === "ranked" && me.broke && <BrokeBadge />}
      </div>
      {top.length > 1 && (
        <ol className="rank-top" aria-label="이번 시즌 상위">
          {top.map((r) => (
            <li key={r.code} className={r.code === local?.code ? "me" : undefined}>
              <span className="rt-rank">{r.rank}</span>
              <Avatar src={avatars[r.code]} name={r.nickname} size={40} />
              <b>{r.nickname}</b>
              <span className="k">{r.pct + "%"}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
    </>
  );
}
