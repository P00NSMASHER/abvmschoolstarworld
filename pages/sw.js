const CACHE = "abvm-grade2-parent-companion-v15";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/abvm-app-icon-180.png",
  "./assets/abvm-app-icon-192.png",
  "./assets/abvm-app-icon-512.png",
  "./assets/hero-today.webp",
  "./assets/hero-week.webp",
  "./assets/hero-calendar.webp",
  "./assets/hero-study.webp",
  "./assets/hero-family.webp",
  "./assets/lunch-monday.webp",
  "./assets/lunch-tuesday.webp",
  "./assets/lunch-wednesday.webp",
  "./assets/lunch-thursday.webp",
  "./assets/lunch-friday.webp",
  "./assets/calendar/picture-day.svg",
  "./assets/calendar/picture-day-2.svg",
  "./assets/calendar/mass-1.svg",
  "./assets/calendar/mass-2.svg",
  "./assets/calendar/gym-1.svg",
  "./assets/calendar/gym-2.svg",
  "./assets/calendar/art-1.svg",
  "./assets/calendar/art-2.svg",
  "./assets/calendar/dress-down-1.svg",
  "./assets/calendar/dress-down-2.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.endsWith("/data/study-pack.json")) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }))
  );
});
