/* eslint-disable no-restricted-globals */
const cacheName = "odoo-sw-cache";
const cachedRequests = ["/web/offline", "/web_enterprise/static/img/odoo-icon-192x192.png"];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(cachedRequests)));
});

const processFetchRequest = async (request) => {
    try {
        return await fetch(request);
    } catch (requestError) {
        if (
            request.method === "GET" &&
            ["Failed to fetch", "Load failed"].includes(requestError.message)
        ) {
            let path = new URL(request.url).pathname;
            if (
                (request.mode === "navigate" && request.destination === "document") ||
                // request.mode = navigate isn't supported in all browsers => check for http header accept:text/html
                request.headers.get("accept").includes("text/html")
            ) {
                path = "/web/offline";
            }
            if (cachedRequests.includes(path)) {
                const cache = await caches.open(cacheName);
                const cachedResponse = await cache.match(path);
                if (cachedResponse) {
                    return cachedResponse;
                }
            }
        }
        throw requestError;
    }
};

self.addEventListener("fetch", (event) => {
    event.respondWith(processFetchRequest(event.request));
});
