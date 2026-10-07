const CACHE_PREFIX = "abvm-grade2-parent-companion-";
const CACHE = "abvm-grade2-parent-companion-v135-consumer-app";
const STATIC_SHELL = [
  "./index.html",
  "./styles.css?v=108",
  "./study-support.js?v=3",
  "./app.js?v=128",
  "./product-view.js?v=1",
  "./study-teaching.css?v=1",
  "./school-updates.js?v=2",
  "./weekly-learning.js?v=5",
  "./study-games.js?v=100",
  "./study-games-view.js?v=11",
  "./manifest.webmanifest",
  "./assets/abvm-app-icon-180.png",
  "./assets/abvm-app-icon-192.png",
  "./assets/abvm-app-icon-512.png"
];
const OPTIONAL_DATA = ["./data/study-pack-runtime.json", "./data/study-archive.json", "./data/schoolwork.json", "./data/religion-sources.json", "./study-materials.mjs", "./study-games-materials-view.mjs?v=1", "./study-games-materials.css?v=10", "./study-hub-core.mjs", "./study-room-view.mjs", "./study-experience.mjs","./study-resources.mjs", "./study-model.mjs", "./star-practice.mjs", "./lunch-art.js?v=1", "./assets/school/abvm-school-sign.webp", "./assets/school/abvm-school-hero.webp", "./assets/school/abvm-school-aerial.webp", "./assets/school/abvm-school-facade.webp"];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(STATIC_SHELL);
    await Promise.allSettled(OPTIONAL_DATA.map(url=>cache.add(url)));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(
      keys
        .filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE)
        .map(key=>caches.delete(key))
    );
    await self.clients.claim();
  })());
});

async function cachedFallback(request,fallback=null){
  const cache=await caches.open(CACHE);
  return (await cache.match(request))||
    (await cache.match(request,{ignoreSearch:true}))||
    (fallback?await cache.match(fallback,{ignoreSearch:true}):null);
}
function networkFirst(request,fallback="./index.html",event=null){
  const network=fetch(request,{cache:"no-store"}).catch(()=>null);
  const persist=network.then(async response=>{
    if(!response?.ok)return;
    const cache=await caches.open(CACHE);
    await cache.put(request,response.clone());
  });
  if(event)event.waitUntil(persist.catch(()=>{}));
  return network.then(async response=>{
    if(response?.ok)return response;
    const cached=await cachedFallback(request,fallback);
    if(!cached)return response||Response.error();
    const headers=new Headers(cached.headers);
    headers.set("X-ABVM-Cache-Fallback","1");
    return new Response(await cached.blob(),{status:cached.status,statusText:cached.statusText,headers});
  });
}
function staleWhileRevalidate(request,event){
  const update=(async()=>{
    try{
      const response=await fetch(request);
      if(response?.ok){
        const cache=await caches.open(CACHE);
        await cache.put(request,response.clone());
      }
      return response;
    }catch{
      return null;
    }
  })();
  event.waitUntil(update.then(()=>{}));
  return (async()=>{
    const cache=await caches.open(CACHE);
    const cached=(await cache.match(request))||(await cache.match(request,{ignoreSearch:true}));
    if(cached)return cached;
    return (await update)||Response.error();
  })();
}

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  if(url.pathname.endsWith("/data/study-pack-runtime.json")){
    event.respondWith(networkFirst(event.request,"./data/study-pack.json",event));
    return;
  }
  if(url.pathname.endsWith("/data/study-pack.json")){
    event.respondWith(networkFirst(event.request,null,event));
    return;
  }
  if(/\/data\/(?:study-archive|schoolwork|religion-sources)\.json$/.test(url.pathname)){
    event.respondWith(networkFirst(event.request,null,event));return;
  }
  if(event.request.mode==="navigate"){
    event.respondWith(networkFirst(event.request,"./index.html",event));
    return;
  }

  if(url.pathname.endsWith(".webmanifest")){
    event.respondWith(networkFirst(event.request,null,event));
    return;
  }

  // Versioned code must never be satisfied by an older cached version while online.
  if(/\.(?:css|mjs|js)$/.test(url.pathname)&&url.searchParams.has("v")){
    event.respondWith(networkFirst(event.request,null,event));
    return;
  }
  if(/\.(?:css|mjs|js|webp|png|svg)$/.test(url.pathname)){
    event.respondWith(staleWhileRevalidate(event.request,event));
    return;
  }
  if(url.pathname.endsWith(".json")){
    event.respondWith(staleWhileRevalidate(event.request,event));
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(cached=>cached||fetch(event.request)));
});
