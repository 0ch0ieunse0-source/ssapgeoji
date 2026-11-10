// 거지노트 매일 알림 보내기 (Supabase Edge Function: daily-push)
// 15분마다 cron이 불러요(supabase/push.sql). 보낼 차례인 폰에 "오늘 쓴 돈 정리했나요?" 알림을 보내요.
// 비밀값(Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_CRON_SECRET
// 'Verify JWT'는 끄고, 대신 x-cron-secret으로 cron만 부를 수 있게 막아요.
import webpush from "npm:web-push@3.6.7";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://0ch0ieunse0-source.github.io/ssapgeoji/";

const LINES = [
  "오늘 쓴 돈 정리했나요? 잊기 전에 적어 두세요.",
  "오늘 하루 얼마 썼는지 적어 볼까요?",
  "자기 전에 오늘 쓴 돈 정리! 1분이면 돼요.",
  "오늘 안 썼으면 '오늘은 안 썼어요'만 눌러도 돼요.",
];

async function rpc<T>(fn: string, body: unknown): Promise<T> {
  const r = await fetch(SB_URL + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(fn + " " + r.status + " " + (await r.text()));
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("PUSH_CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("no", { status: 401 });

  webpush.setVapidDetails(APP_URL, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
  const due = await rpc<{ endpoint: string; p256dh: string; auth: string }[]>("geoji_push_due", {});
  const body = JSON.stringify({ title: "거지노트", body: LINES[new Date().getUTCDate() % LINES.length] });

  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    due.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 3, urgency: "normal" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.endpoint); // 앱을 지웠거나 알림을 끈 폰
      }
    }),
  );
  if (gone.length) await rpc("geoji_push_gone", { p_endpoints: gone });
  return new Response(JSON.stringify({ due: due.length, sent, gone: gone.length }), { headers: { "Content-Type": "application/json" } });
});
