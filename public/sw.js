/* Virtual Piano service worker: replay the app and its piano samples offline. */
const SHELL = "vp-shell-v1";
const MEDIA = "vp-media-v1";
const SAMPLE_HOST = "https://tonejs.github.io/audio/salamander/";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => ![SHELL, MEDIA].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Samples and fonts never change: serve from cache, fetch once. */
async function cacheFirst(request) {
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") cache.put(request, response.clone());
  return response;
}

/** The app itself: prefer the network so updates land, fall back to the last copy offline. */
async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.href.startsWith(SAMPLE_HOST) || url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com") {
    event.respondWith(cacheFirst(request));
  } else if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  }
});
