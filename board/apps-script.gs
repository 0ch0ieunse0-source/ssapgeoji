/**
 * 거지노트 기능 제안 게시판 — 구글 시트에 붙여 넣는 코드
 * 시트: 확장 프로그램 → Apps Script → 이 코드 전체를 붙여 넣고 저장 → 배포 → 새 배포 → 웹 앱
 *   - 다음 사용자 인증 정보로 실행: 나
 *   - 액세스 권한이 있는 사용자: 모든 사용자
 * 글을 지우고 싶으면 시트에서 그 줄을 삭제하면 돼요.
 */
const SHEET_NAME = "제안";
const MAX_TEXT = 300;
const MAX_NAME = 12;
const MAX_ROWS = 100; // 앱에 보여줄 최근 글 수
const MAX_PER_MINUTE = 20; // 1분에 이보다 많이 들어오면 잠시 막아요 (장난 방지)

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["시간", "닉네임", "내용"]);
  }
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// 시트에서 수식으로 바뀌지 않게 (=, +, -, @ 로 시작하면 글자로 저장)
function safe_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function doGet() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return json_({ posts: [] });
  const start = Math.max(2, last - MAX_ROWS + 1);
  const rows = sh.getRange(start, 1, last - start + 1, 3).getValues();
  const posts = rows
    .filter((r) => String(r[2]).trim() !== "")
    .map((r) => ({ t: new Date(r[0]).getTime() || 0, name: String(r[1]), text: String(r[2]) }))
    .reverse();
  return json_({ posts: posts });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const text = String(d.text || "").trim().slice(0, MAX_TEXT);
    const name = String(d.name || "").trim().slice(0, MAX_NAME) || "익명";
    if (!text) return json_({ ok: false, error: "empty" });
    const cache = CacheService.getScriptCache();
    const count = Number(cache.get("count") || 0);
    if (count >= MAX_PER_MINUTE) return json_({ ok: false, error: "busy" });
    cache.put("count", String(count + 1), 60);
    sheet_().appendRow([new Date(), safe_(name), safe_(text)]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: "bad" });
  } finally {
    lock.releaseLock();
  }
}
