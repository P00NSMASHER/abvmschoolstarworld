const CACHE = "abvm-grade2-parent-companion-v61-small-polish";
const SHELL = [
  "./",
  "./index.html",
  "./design-tokens.css",
  "./styles.css",
  "./responsive.css",
  "./calendar-clean.css",
  "./today-clean.css",
  "./week-clean.css",
  "./study-clean.css",
  "./family-clean.css",
  "./colorful-polish.css",
  "./app.js",
  "./js/date-utils.js",
  "./js/storage.js",
  "./js/install.js",
  "./js/events.js",
  "./js/calendar-visuals.js",
  "./js/school-model.js",
  "./manifest.webmanifest",
  "./data/school-year-calendar.json",
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
  "./assets/calendar/dress-down-2.svg",
  "./assets/calendar/closed-1.svg",
  "./assets/calendar/closed-2.svg",
  "./assets/calendar/half-day-1.svg",
  "./assets/calendar/half-day-2.svg",
  "./assets/calendar/conference-1.svg",
  "./assets/calendar/conference-2.svg",
  "./assets/calendar/progress-1.svg",
  "./assets/calendar/progress-2.svg",
  "./assets/calendar/testing-1.svg",
  "./assets/calendar/testing-2.svg",
  "./assets/calendar/celebration-1.svg",
  "./assets/calendar/celebration-2.svg",
  "./assets/calendar/meeting-1.svg",
  "./assets/calendar/meeting-2.svg",
  "./assets/calendar/club-1.svg",
  "./assets/calendar/club-2.svg",
  "./assets/calendar/halloween.svg",
  "./assets/calendar/thanksgiving.svg",
  "./assets/calendar/christmas.svg",
  "./assets/calendar/new-year.svg",
  "./assets/calendar/mlk-day.svg",
  "./assets/calendar/presidents-day.svg",
  "./assets/calendar/easter.svg",
  "./assets/calendar/memorial-day.svg",
  "./assets/calendar/catholic-schools-week.svg",
  "./assets/calendar/santa-workshop.svg",
  "./assets/calendar/last-day.svg",
  "./assets/calendar/weather-makeup.svg",
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

async function networkFirst(request,fallback="./index.html"){
  try{
    const response=await fetch(request,{cache:"no-store"});
    if(response&&response.ok){
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(request,copy));
    }
    return response;
  }catch(error){
    return (await caches.match(request,{ignoreSearch:true}))||(fallback?await caches.match(fallback,{ignoreSearch:true}):undefined)||Response.error();
  }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if (url.pathname.endsWith("/data/study-pack.json")) {
    event.respondWith(networkFirst(event.request,null));
    return;
  }
  if(event.request.mode==="navigate"){
    event.respondWith(networkFirst(event.request,"./index.html"));
    return;
  }
  if(/\.(?:css|js|json|webp|png|svg|webmanifest)$/.test(url.pathname)){
    event.respondWith(networkFirst(event.request,null));
    return;
  }
  event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||fetch(event.request)));
});
