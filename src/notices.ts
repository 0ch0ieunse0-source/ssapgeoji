/**
 * 공지사항 — 기능을 추가하거나 바꿀 때마다 맨 위에 하나씩 추가해요.
 * id는 겹치지 않게 날짜-순번으로 적어요. 새 공지가 올라가면 상단 종 버튼에 빨간 점이 떠요.
 */
export interface Notice {
  id: string;
  date: string; // "YYYY-MM-DD"
  title: string;
  body: string[];
}

export const NOTICES: Notice[] = [
  // 새 공지는 여기 맨 위에 추가해요. 예:
  // { id: "2026-11-06-1", date: "2026-11-06", title: "제목", body: ["내용 한 줄", "내용 두 줄"] },
];

/** 아직 안 읽은 공지 수. seenId는 마지막으로 읽은 공지 id (없으면 전부 새 소식) */
export function unreadCount(list: Notice[], seenId: string | null): number {
  if (!seenId) return list.length;
  const i = list.findIndex((n) => n.id === seenId);
  return i === -1 ? list.length : i;
}

export const NOTICE_KEY = "ssapgeoji-notice-seen";
export const readNoticeSeen = () => {
  try {
    return localStorage.getItem(NOTICE_KEY);
  } catch {
    return null;
  }
};
/** 공지를 다 읽은 걸로 저장 (처음 쓰는 사람은 예전 공지를 새 소식으로 안 보여주려고 써요) */
export const markNoticesSeen = () => {
  try {
    localStorage.setItem(NOTICE_KEY, NOTICES[0]?.id || "");
  } catch {
    /* 저장이 막혀 있으면 다음에 다시 보여줘요 */
  }
};
