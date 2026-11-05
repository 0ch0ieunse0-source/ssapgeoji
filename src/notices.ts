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
  {
    id: "2026-11-05-3",
    date: "2026-11-05",
    title: "공지사항이 생겼어요",
    body: ["새 기능이 생기거나 바뀌면 여기서 알려드릴게요.", "새 소식이 있으면 위쪽 종 버튼에 빨간 점이 떠요."],
  },
  {
    id: "2026-11-05-2",
    date: "2026-11-05",
    title: "자정이 지나도 날짜가 안 바뀌던 문제를 고쳤어요",
    body: [
      "앱을 켜 둔 채 다음 날이 되면, 쓴 돈이 전날로 기록되던 문제가 있었어요.",
      "이제 앱을 다시 열 때마다 오늘 날짜를 새로 확인해요.",
      "전날로 잘못 들어간 기록은 가계부 달력에서 그날을 눌러 지우고 다시 적어 주세요.",
    ],
  },
  {
    id: "2026-11-05-1",
    date: "2026-11-05",
    title: "아낌노트가 거지노트로 바뀌었어요",
    body: [
      "새 주소: 0ch0ieunse0-source.github.io/ssapgeoji",
      "앱 아이콘이 노트 그림으로 바뀌었어요. 예전 새싹 아이콘은 지우고 홈 화면에 다시 추가해 주세요.",
      "처음 열 때 사용법과 Safari·홈 화면 추가 안내가 나와요. 설정 맨 아래 '사용법 다시 보기'로 다시 볼 수 있어요.",
    ],
  },
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
