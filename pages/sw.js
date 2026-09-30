const CACHE = "abvm-grade2-parent-companion-v88-final-css-runtime";
const STATIC_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./study-games.js",
  "./manifest.webmanifest",
  "./assets/abvm-app-icon-180.png",
  "./assets/abvm-app-icon-192.png",
  "./assets/abvm-app-icon-512.png"
];
const OPTIONAL_DATA = ["./data/study-pack.json"];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(STATIC_SHELL);
    await Promise.allSettled(OPTIONAL_DATA.map(url=>cache.add(url)));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

async function cachedFallback(request,fallback=null){
  return (await caches.match(request))||
    (await caches.match(request,{ignoreSearch:true}))||
    (fallback?await caches.match(fallback,{ignoreSearch:true}):null);
}
async function networkFirst(request,fallback="./index.html"){
  const cached=await cachedFallback(request,fallback);
  try{
    const response=await fetch(request,{cache:"no-store"});
    if(response&&response.ok){
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(request,copy));
      return response;
    }
    return cached||response||Response.error();
  }catch{
    return cached||Response.error();
  }
}
async function staleWhileRevalidate(request){
  const cache=await caches.open(CACHE);
  const cached=(await cache.match(request))||(await cache.match(request,{ignoreSearch:true}));
  const update=fetch(request).then(response=>{
    if(response&&response.ok)cache.put(request,response.clone());
    return response;
  }).catch(()=>null);
  if(cached){update.catch(()=>{});return cached}
  return (await update)||Response.error();
}

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  if(url.pathname.endsWith("/data/study-pack.json")){
    event.respondWith(networkFirst(event.request,null));
    return;
  }
  if(event.request.mode==="navigate"){
    event.respondWith(networkFirst(event.request,"./index.html"));
    return;
  }

  // Versioned code must never be satisfied by an older cached version while online.
  if(/\.(?:css|js)$/.test(url.pathname)&&url.searchParams.has("v")){
    event.respondWith(networkFirst(event.request,null));
    return;
  }
  if(/\.(?:css|js|webp|png|svg|webmanifest)$/.test(url.pathname)){
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  if(url.pathname.endsWith(".json")){
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
