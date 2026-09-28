const CACHE = "abvm-grade2-parent-companion-v67-simple-fast";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./study-games.js",
  "./manifest.webmanifest",
  "./data/study-pack.json",
  "./assets/abvm-app-icon-180.png",
  "./assets/abvm-app-icon-192.png",
  "./assets/abvm-app-icon-512.png"
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
