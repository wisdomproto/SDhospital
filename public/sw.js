// SD동물의료센터 보호자 앱 — 서비스 워커
//
// ⚠️ 진료 기록은 캐시하지 않는다.
// 보호자 폰을 가족이 같이 쓰는 일이 흔하고, 로그아웃한 뒤에도 캐시가 남으면
// 의료정보가 기기에 그대로 남는다. 오래된 리포트를 최신인 것처럼 보여주는 문제도 있다.
// 그래서 여기서는 껍데기(아이콘·오프라인 안내)만 캐시하고,
// 페이지와 데이터는 언제나 네트워크에서 가져온다.

const SHELL = "sd-shell-v1";
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
