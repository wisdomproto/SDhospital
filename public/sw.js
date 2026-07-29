// SD동물의료센터 보호자 앱 — 서비스 워커
//
// ⚠️ 진료 기록은 캐시하지 않는다.
// 보호자 폰을 가족이 같이 쓰는 일이 흔하고, 로그아웃한 뒤에도 캐시가 남으면
// 의료정보가 기기에 그대로 남는다. 오래된 리포트를 최신인 것처럼 보여주는 문제도 있다.
// 그래서 여기서는 껍데기(아이콘·오프라인 안내)만 캐시하고,
// 페이지와 데이터는 언제나 네트워크에서 가져온다.

const SHELL = "sd-shell-v2";
const OFFLINE = "/offline.html";
const PRECACHE = [OFFLINE, "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // 화면 이동만 가로챈다. 나머지(데이터·이미지·서명URL)는 손대지 않는다.
  if (req.mode !== "navigate") return;
  e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
});

// ── 푸시 알림 ────────────────────────────────────────────────
// 알림 본문에는 환자 이름과 "리포트가 왔다"까지만 들어온다.
// 잠금화면은 누구나 보기 때문에 진단명·상태는 서버가 애초에 담지 않는다.
self.addEventListener("push", (e) => {
  let d = { title: "SD동물의료센터", body: "새 리포트가 도착했어요", url: "/portal" };
  try {
    if (e.data) d = { ...d, ...e.data.json() };
  } catch {
    if (e.data) d.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: d.url },
      // 같은 환자 알림이 여러 개 쌓이지 않게 — 최신 것만 보이면 된다
      tag: d.url,
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/portal";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // 이미 앱이 열려 있으면 그 창을 쓴다 — 창을 매번 새로 띄우면 금방 지저분해진다
      for (const c of list) {
        if (c.url.includes("/portal") && "focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
