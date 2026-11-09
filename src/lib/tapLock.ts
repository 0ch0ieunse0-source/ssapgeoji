/**
 * 저장 버튼을 빠르게 두 번 누르면, 첫 번째에 시트가 닫히면서 두 번째 탭이
 * 그 자리에 있던 아래 탭바(통장 등)를 눌러 엉뚱한 화면으로 가요.
 * 시트가 닫히거나 저장하고 화면이 바뀐 직후 잠깐 아래 탭바를 눌리지 않게 막아요.
 */
let timer: number | undefined;
export function lockTaps(ms = 450) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.add("tap-lock");
  window.clearTimeout(timer);
  timer = window.setTimeout(() => el.classList.remove("tap-lock"), ms);
}
