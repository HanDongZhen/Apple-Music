const CACHE = 'mr-han-shell-v1';
const CORE = [
  '/',
  '/index.html',
  '/theme.js',
  '/manifest.webmanifest',
  '/library.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/artwork/placeholder.svg',
  '/artwork/quiet-hours.svg',
  '/artwork/seven.svg',
  '/artwork/earth.svg',
  '/artwork/rain.svg',
  '/artwork/bloom.svg',
  '/artwork/stars.svg',
  '/artwork/tide.svg',
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('mr-han-shell-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    request.headers.has('Range') ||
    url.pathname.startsWith('/media/') ||
    /\.(flac|wav|mp3|m4a|aac|ogg|opus|aiff)$/i.test(url.pathname) ||
    request.destination === 'audio'
  )
    return;
  const navigation = request.mode === 'navigate';
  if (
    !navigation &&
    !/^\/(assets\/|artwork\/|icons\/|lyrics\/|library\.json$|manifest\.webmanifest$|theme\.js$)/.test(
      url.pathname,
    )
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (
          response.ok &&
          !response.redirected &&
          !/no-store/i.test(response.headers.get('Cache-Control') || '')
        )
          await cache.put(navigation ? '/index.html' : request, response.clone());
        return response;
      } catch {
        // Vite/CDNs may emit Vary: Origin. Module requests carry Origin while
        // precache fetches do not; same-origin versioned shell files are identical.
        return (
          (await cache.match(navigation ? '/index.html' : request, { ignoreVary: true })) ||
          new Response('Unavailable offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          })
        );
      }
    })(),
  );
});
