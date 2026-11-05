/** 서버의 새 버전을 알려줄지: 버전이 다르고, 이번에 '그대로 사용'을 누른 버전이 아니면 */
export const shouldNotifyUpdate = (server: string | null | undefined, current: string, dismissed: string | null) =>
  !!server && server !== current && server !== dismissed;

/** 새 버전으로 다시 열 주소 (?v= 를 붙여 폰과 서버에 저장된 예전 화면을 건너뛰어요) */
export const reloadUrl = (pathname: string, hash: string, version: string) => pathname + "?v=" + encodeURIComponent(version) + hash;
