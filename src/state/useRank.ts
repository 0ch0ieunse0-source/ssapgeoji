import { useCallback, useEffect, useRef, useState } from "react";
import { announcedSeason, rankRows, scoreFor, type RankedRow } from "../lib/rank";
import { rankEnabled } from "../rankConfig";
import { useApp } from "./app";
import { fetchRows, loadRank, saveRank, submitScore, type RankLocal } from "./rank";
import { fetchSpace } from "./space";

/** 랭킹 화면·홈 카드에서 같이 써요. 발표된 시즌 성적을 아직 안 올렸으면 먼저 올려요. */
export function useRank() {
  const { S, today, model } = useApp();
  const [local, setLocal] = useState<RankLocal | null>(loadRank);
  const [rows, setRows] = useState<RankedRow[] | null>(null);
  const [error, setError] = useState(false);
  // 프로필 사진 (스페이스 공개 설정에서 끈 사람은 비어 있어요). 못 불러와도 랭킹은 그대로 보여요
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const season = announcedSeason(today);
  const cfg = model?.cfg;
  // 기록할 때마다 서버를 부르지 않도록, 최신 기록은 ref로 읽고 화면을 열 때만 불러와요
  const latest = useRef({ S, cfg });
  latest.current = { S, cfg };

  const refresh = useCallback(async () => {
    const r = loadRank();
    setLocal(r);
    const { S: book, cfg: c } = latest.current;
    if (!r || !rankEnabled() || !c) return;
    setError(false);
    try {
      if (r.submitted !== season.start) {
        await submitScore(r, season, scoreFor(book, c, season));
        r.submitted = season.start;
        saveRank(r);
      }
      const data = await fetchRows([r.code, ...r.friends]);
      setRows(rankRows(data, season.start));
      fetchSpace([r.code, ...r.friends]).then(
        (sp) => setAvatars(Object.fromEntries(sp.map((x) => [x.code, x.avatar]))),
        () => undefined,
      );
    } catch {
      setError(true);
    }
  }, [season.start]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = (r: RankLocal | null) => {
    saveRank(r);
    setLocal(r);
  };
  return { local, rows, error, season, refresh, update, avatars, score: cfg ? scoreFor(S, cfg, season) : null };
}
