const CACHE_NAME = "khetsuno-v6";
const APP_ASSETS = [
  "/",
  "/app.js",
  "/dashboard.js",
  "/languages.js",
  "/local-guidance.js",
  "/states.js",
  "/soil-assessment.js",
  "/onnx-model.js",
  "/styles.css",
  "/manifest.webmanifest",
  "/icons/khetsuno.svg",
  "/icons/khetsuno-192.png",
  "/icons/khetsuno-512.png",
];
const OPTIONAL_ASSETS = [
  "/vendor/ort.wasm.min.js",
  "/vendor/ort-wasm-simd-threaded.wasm",
  "/vendor/ort-wasm-simd-threaded.mjs",
  "/models/plantvillage-yolov8n-cls.onnx",
  "/models/plantvillage-yolov8n-cls-labels.json",
  "/models/cerealpestaid-mobilenetv3.onnx",
  "/models/cerealpestaid-labels.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_ASSETS);
    await Promise.allSettled(OPTIONAL_ASSETS.map((asset) => cache.add(asset)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
