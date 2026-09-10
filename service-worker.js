const CACHE_NAME = 'alliance-chretienne-v1';

const FILES_TO_CACHE = [
    '/',
    '/search.html',
    '/index.html'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(FILES_TO_CACHE))
    );

    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );

    self.clients.claim();
});

self.addEventListener('fetch', event => {

    event.respondWith(

        fetch(event.request)
            .then(response => {

                return response;

            })
            .catch(() => {

                return caches.match(event.request)
                    .then(cachedResponse => {

                        if (cachedResponse) {
                            return cachedResponse;
                        }

                        return new Response('', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });

                    });

            })

    );

});