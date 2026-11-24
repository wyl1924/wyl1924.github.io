/* 墨盒词盒离线缓存：应用壳优先走网络，词条插画与音频优先读本地缓存 */
const VERSION = "mohe-wordbox-v2";
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith("mohe-wordbox-") && k !== SHELL && k !== MEDIA)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // The account homepage shares this origin with other GitHub Pages projects.
  const scopePath = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scopePath)) return;
  const path = url.pathname.slice(scopePath.length);
  if (path && !/^(?:(?:assets|atlas|brand|sfx|preview)\/|(?:index\.html|favicon\.svg|manifest\.webmanifest)$)/.test(path)) return;
  const isShell = req.mode === "navigate" || url.pathname.endsWith("/index.json");
  if (isShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(new URL("./", self.registration.scope).href))),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            const name = /\/atlas\/(img|thumb|audio)\//.test(url.pathname) ? MEDIA : SHELL;
            caches.open(name).then((c) => c.put(req, copy)).then(() => name === MEDIA && trim(MEDIA, 1500));
          }
          return res;
        }),
    ),
  );
});
