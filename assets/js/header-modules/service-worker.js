// service-worker.js
// Simple SW: cache-first for static assets, stale-while-revalidate for con-data JSON
const CACHE_STATIC = 'hf-static-v1';
const CACHE_JSON = 'hf-json-v1';
const STATIC_FILES = [
    '/', '/assets/js/header.min.js', '/assets/css/header.min.css', '/assets/css/styles.min.css'
    // add other static assets you want to pre-cache
];
self.addEventListener('install', (e) => {
    // @ts-expect-error TS(2339): Property 'waitUntil' does not exist on type 'Event... Remove this comment to see the full error message
    e.waitUntil(caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_FILES)).catch(() => { }));
    // @ts-expect-error TS(2339): Property 'skipWaiting' does not exist on type 'Win... Remove this comment to see the full error message
    self.skipWaiting();
});
self.addEventListener('activate', (e) => {
    // @ts-expect-error TS(2339): Property 'waitUntil' does not exist on type 'Event... Remove this comment to see the full error message
    e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (e) => {
    // @ts-expect-error TS(2339): Property 'request' does not exist on type 'Event'.
    const url = new URL(e.request.url);
    // handle con-data JSON: stale-while-revalidate
    if (url.pathname.startsWith('/assets/db/con-data/')) {
        // @ts-expect-error TS(2339): Property 'respondWith' does not exist on type 'Eve... Remove this comment to see the full error message
        e.respondWith(caches.open(CACHE_JSON).then(async (cache) => {
            // @ts-expect-error TS(2339): Property 'request' does not exist on type 'Event'.
            const cached = await cache.match(e.request);
            // @ts-expect-error TS(2339): Property 'request' does not exist on type 'Event'.
            const network = fetch(e.request).then(resp => {
                // @ts-expect-error TS(2339): Property 'request' does not exist on type 'Event'.
                if (resp && resp.ok)
                    cache.put(e.request, resp.clone());
                return resp;
            }).catch(() => null);
            return cached || network;
        }));
        return;
    }
    // static: cache-first
    // @ts-expect-error TS(2339): Property 'respondWith' does not exist on type 'Eve... Remove this comment to see the full error message
    e.respondWith(
    // @ts-expect-error TS(2339): Property 'request' does not exist on type 'Event'.
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
        // optionally cache new static
        return resp;
    }).catch(() => r)));
});
