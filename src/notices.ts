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
    id: "2026-11-05-6",
    date: "2026-11-05",
    title: "결과 발표와 응원·콕 찌르기가 생겼어요",
    body: [
      "2주마다 랭킹 결과가 나오면, 그 뒤 처음 앱을 열 때 결과 발표 화면이 떠요. 1등과 꼴찌가 누군지 확인해 보세요.",
      "친구 랭킹에서 친구에게 👏 응원이나 👉 콕 찌르기를 보낼 수 있어요. 친구마다 하루에 한 번씩 보낼 수 있어요.",
      "받은 응원과 콕은 앱을 열 때 알려드려요. 금액은 여전히 밖으로 나가지 않아요.",
    ],
  },
  {
    id: "2026-11-05-5",
    date: "2026-11-05",
    title: "친구 랭킹이 생겼어요 (베타)",
    body: [
      "홈 가운데 '친구 랭킹'에서 친구와 누가 더 한도를 잘 지키는지 겨룰 수 있어요.",
      "2주마다 한도를 지킨 날의 비율로 순위를 발표해요. 등급은 꽃거지, 알뜰거지, 보통거지, 흔들거지, 핵거지이고, 2주 한도보다 30% 넘게 쓰면 💀 파산 배지가 붙어요.",
      "내 친구 코드를 친구에게 보내고, 친구 코드를 받아서 넣으면 서로 랭킹에 보여요.",
      "친구에게 보이는 건 닉네임, 지킴률, 등급, 파산 배지뿐이에요. 금액과 가계부 기록은 절대 밖으로 나가지 않아요.",
    ],
  },
  {
    id: "2026-11-05-4",
    date: "2026-11-05",
    title: "위쪽 화면을 정리했어요",
    body: ["위쪽에 있던 '이 기기에 저장돼요' 표시를 없앴어요. 기록은 여전히 이 폰에만 저장돼요."],
  },
  {
    id: "2026-11-05-3",
    date: "2026-11-05",
    title: "새 버전이 나오면 알려드려요",
    body: [
      "앱을 열 때 새 버전이 있으면 아래에 '새 버전이 있어요'가 작게 떠요.",
      "'새로고침'을 누르면 바로 새 버전으로 바뀌고, '그대로 사용'을 누르면 다음에 다시 알려드려요. 기록은 그대로예요.",
    ],
  },
  {
    id: "2026-11-05-2",
    date: "2026-11-05",
    title: "공지사항을 목록으로 볼 수 있어요",
    body: [
      "공지사항을 목록으로 보고, 눌러서 자세한 내용을 볼 수 있어요. 아직 안 읽은 공지에는 '새 소식'이 붙어요.",
      "'기록은 이 기기에만 저장돼요' 안내는 이제 처음 설정 화면과 설정 → 기록 보관에서만 보여요.",
      "배경색을 연한 회색으로 바꿔서 어떤 메인 컬러를 골라도 잘 어울려요.",
    ],
  },
  {
    id: "2026-11-05-1",
    date: "2026-11-05",
    title: "메인 컬러를 고를 수 있어요",
    body: [
      "설정 → 화면에서 초록, 파랑, 보라, 분홍, 주황, 회색, 검정 중에 고를 수 있어요.",
      "설정이 '생활비와 한도', '통장과 수입·지출', '저축 목표', '화면', '기록 보관' 메뉴로 묶였어요.",
      "사고 싶은 것 대기 기간이 가격에 맞춰 정해져요. 5만원 미만은 하루, 30만원 미만은 3일, 100만원 미만은 1주, 100만원 이상은 1달이에요. 1주·2주·1달로 직접 바꿀 수도 있어요.",
      "목록 사이에 구분선을 넣고 회색 글씨를 조금 더 진하게 해서 읽기 편해졌어요.",
    ],
  },
  // 새 공지는 여기 맨 위에 추가해요. 예:
  // { id: "2026-11-06-1", date: "2026-11-06", title: "제목", body: ["내용 한 줄", "내용 두 줄"] },
];

/**
 * 안 읽은 공지 id 목록.
 * readIds: 하나씩 열어 본 공지, legacySeen: 예전 방식(목록을 열면 전부 읽음)으로 마지막에 본 공지 id
 */
export function unreadIds(list: Notice[], readIds: string[], legacySeen: string | null): string[] {
  const legacyAt = legacySeen ? list.findIndex((n) => n.id === legacySeen) : -1;
  return list.filter((n, i) => !readIds.includes(n.id) && !(legacyAt !== -1 && i >= legacyAt)).map((n) => n.id);
}

export const NOTICE_KEY = "ssapgeoji-notice-seen"; // 예전 방식 (읽기만 해요)
export const NOTICE_READ_KEY = "ssapgeoji-notice-read";

function readList(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(NOTICE_READ_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writeList(ids: string[]) {
  try {
    localStorage.setItem(NOTICE_READ_KEY, JSON.stringify(ids));
  } catch {
    /* 저장이 막혀 있으면 다음에 다시 보여줘요 */
  }
}
const legacy = () => {
  try {
    return localStorage.getItem(NOTICE_KEY);
  } catch {
    return null;
  }
};

/** 지금 안 읽은 공지 id */
export const currentUnread = () => unreadIds(NOTICES, readList(), legacy());
/** 공지 하나를 열어 봤어요 */
export const markNoticeRead = (id: string) => {
  const ids = readList();
  if (!ids.includes(id)) writeList([...ids, id]);
};
/** 처음 쓰는 사람: 예전 공지는 새 소식으로 안 보여줘요 */
export const markAllNoticesRead = () => writeList(NOTICES.map((n) => n.id));
/** 공지 기록이 아예 없는 사람인지 (처음 쓰는 사람 판별용) */
export const hasNoticeRecord = () => {
  try {
    return localStorage.getItem(NOTICE_READ_KEY) != null || localStorage.getItem(NOTICE_KEY) != null;
  } catch {
    return true;
  }
};
