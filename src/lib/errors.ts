/** 오류를 화면에 알려줘요 (토스트). 기록은 건드리지 않아요. 오류 내용을 캡처해서 알려주면 고치기 쉬워요. */
type Listener = (msg: string) => void;
let listener: Listener | null = null;
let last = "";
export const onAppError = (fn: Listener | null) => {
  listener = fn;
};
export function errorText(e: unknown): string {
  if (e instanceof Error) return (e.name && e.name !== "Error" ? e.name + ": " : "") + e.message;
  return String(e);
}
export function reportError(e: unknown, where = "") {
  const msg = errorText(e).slice(0, 160);
  // eslint-disable-next-line no-console
  console.error("[거지노트]", where, e);
  if (msg === last) return;
  last = msg;
  window.setTimeout(() => (last = ""), 4000);
  listener?.((where === "save" ? "저장하지 못했어요. 기록은 그대로예요. " : "문제가 생겼어요. 기록은 그대로예요. ") + "(" + msg + ")");
}
