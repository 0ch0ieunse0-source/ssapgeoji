/** 정산 메시지에 넣는 내 계좌 — 이 폰에만 저장해요 (서버·백업 파일에 넣지 않아요) */
import type { SettleAccount } from "../lib/settle";

const KEY = "ssapgeoji-account";
export const emptyAccount = (): SettleAccount => ({ bank: "", number: "", holder: "", link: "" });
export function loadAccount(): SettleAccount {
  try {
    return { ...emptyAccount(), ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return emptyAccount();
  }
}
export function saveAccount(a: SettleAccount) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* 저장이 막혀 있으면 다음에 다시 입력해요 */
  }
}
