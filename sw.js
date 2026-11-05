const CACHE = 'car-viewer-v10';
const SHELL = [
  '.',
  'index.html',
  'style.css',
  'app.js',
  'models.json',
  'manifest.webmanifest',
  'vendor/model-viewer.min.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'hdr/studio_small_09.hdr',
];

// 녹음한 목소리 파일은 있는 것만 미리 받아 둔다 (없는 파일 때문에 설치가 실패하면 안 되므로 하나씩 try)
const SOUND_IDS = ['wrangler4d', 'wrangler23', 'wrangler', 'gladiator', 'gclass25', 'gclass', 'defenderpickup', 'defender', 'bronco', 'hummerh3', 'supersafari'];
const SOUND_EXTS = ['webm', 'm4a', 'mp3'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await c.addAll(SHELL);
      for (const id of SOUND_IDS) for (const ext of SOUND_EXTS) {
        await c.add(`sounds/${id}-intro.${ext}`).catch(() => {});
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 앱 셸은 캐시 우선, 모델(glb)은 한 번 받으면 캐시에 저장해 오프라인에서도 보이게
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
