// 目的：ホーム画面追加のWebアプリ（iOSの standalone 起動）で、
// デプロイ済みの更新が古いキャッシュのせいで反映されない問題を解消する。
// 方針：HTML（ナビゲーション）は「ネットワーク優先」。オンライン時は常に最新を取得し、
// 取得できたらキャッシュも更新。オフライン時のみキャッシュを表示する。
// これにより、起動のたびに最新の index.html が読み込まれる。

const HTML_CACHE = 'html-cache-v1';

self.addEventListener('install', (e) => {
  // 新しいSWを即時有効化（更新をすぐ効かせる）
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // 既存クライアントをすぐ制御下に置く
    await self.clients.claim();
    // 古いバージョンのHTMLキャッシュを掃除
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('html-cache-') && k !== HTML_CACHE).map(k => caches.delete(k)));
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || accept.indexOf('text/html') !== -1;

  // HTML（アプリ本体）だけ SW が介入し、ネットワーク優先にする。
  // CDNスクリプト等はブラウザの通常キャッシュに任せる（URLでバージョン管理済み）。
  if (isHTML) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        try {
          const cache = await caches.open(HTML_CACHE);
          cache.put(req, fresh.clone());
        } catch (_) {}
        return fresh;
      } catch (_) {
        // オフライン等：キャッシュにフォールバック
        const cached = await caches.match(req);
        if (cached) return cached;
        const index = await caches.match('index.html');
        if (index) return index;
        throw _;
      }
    })());
  }
});
