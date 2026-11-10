// 거지노트 서비스 워커: 매일 알림(푸시)만 받아요.
// 화면 파일을 저장(캐시)하지 않아서 앱 업데이트·기록 저장에는 영향이 없어요.
// 서버에서 오는 건 알림 글자뿐이고, 기록·금액은 오가지 않아요.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data ? e.data.text() : "" };
  }
  const scope = self.registration.scope;
  e.waitUntil(
    self.registration.showNotification(d.title || "거지노트", {
      body: d.body || "오늘 쓴 돈 정리했나요? 잊기 전에 적어 두세요.",
      icon: scope + "icons/icon-192.png?v=2",
      badge: scope + "icons/icon-192.png?v=2",
      tag: "daily",
      data: { url: scope + "#home" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
