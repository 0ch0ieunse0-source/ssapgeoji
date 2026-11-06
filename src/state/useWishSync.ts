import { useEffect } from "react";
import { buildPublicWish } from "../lib/space";
import { useApp } from "./app";
import { loadRank } from "./rank";
import { cachedShow, lastWishSent, markWishSent, saveWish } from "./space";

/** 갖고 싶은 물건이 바뀌면 친구에게 보여줄 목록(이름·날짜·상태만)을 2초 뒤 올려요. 공개를 꺼 두면 아무것도 안 보내요 */
export function useWishSync() {
  const { S } = useApp();
  const items = S.wish.items;
  useEffect(() => {
    const me = loadRank();
    if (!me) return;
    if (cachedShow()?.wish === false) return;
    const pub = buildPublicWish(items);
    const key = JSON.stringify(pub);
    if (key === lastWishSent()) return;
    const t = window.setTimeout(() => {
      saveWish(me, pub).then(
        (r) => r === "ok" && markWishSent(key),
        () => undefined, // 서버에 아직 기능이 없거나 인터넷이 없으면 다음에 다시
      );
    }, 2000);
    return () => window.clearTimeout(t);
  }, [items]);
}
