import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Execute the real service worker in a bounded, network-free Cache Storage
// harness. These failures are independent of whether a request is online.
const workerSource = readFileSync(new URL("../pages/sw.js", import.meta.url), "utf8");

function workerHarness({
  networkError = false,
  storageOpenError = false,
  storageReadError = false,
  storageWriteError = false,
  storageWriteGate = null,
  cached = false,
} = {}) {
  const networkResponse = { ok: true, clone() { return this; } };
  const cachedResponse = { cached: true };
  const offlineResponse = { offline: true };
  const calls = { fetch: 0, match: 0, put: 0 };
  const pending = [];
  const listeners = new Map();
  const cache = {
    async match() {
      calls.match += 1;
      if (storageReadError) throw new Error("synthetic cache read failure");
      return cached ? cachedResponse : undefined;
    },
    async put() {
      calls.put += 1;
      if (storageWriteError) throw new Error("synthetic quota exceeded");
      if (storageWriteGate) await storageWriteGate;
    },
  };
  const context = {
    URL, setTimeout,
    caches: {
      async open() {
        if (storageOpenError) throw new Error("synthetic Cache Storage unavailable");
        return cache;
      },
    },
    async fetch() {
      calls.fetch += 1;
      if (networkError) throw new Error("synthetic network failure");
      return networkResponse;
    },
    Response: { error() { return offlineResponse; } },
    self: {
      location: { origin: "https://school.example" },
      addEventListener(type, handler) { listeners.set(type, handler); },
    },
  };
  runInNewContext(workerSource, context, { filename: "pages/sw.js" });
  assert.equal(typeof context.staleWhileRevalidate, "function");
  return {
    context, calls, pending, listeners, networkResponse, cachedResponse, offlineResponse,
    request: { url: "https://school.example/assets/illustrations/reading.webp" },
    event: { waitUntil(promise) { pending.push(promise); } },
  };
}

async function run(harness) {
  const actual = await harness.context.staleWhileRevalidate(
    harness.request, harness.event
  );
  await Promise.all(harness.pending);
  assert.equal(harness.calls.fetch, 1, "one network revalidation per request");
  return actual;
}

test("online asset survives Cache Storage open rejection", async () => {
  const h = workerHarness({ storageOpenError: true });
  assert.strictEqual(await run(h), h.networkResponse);
});

test("online asset survives cache quota/write rejection", async () => {
  const h = workerHarness({ storageWriteError: true });
  assert.strictEqual(await run(h), h.networkResponse);
  assert.equal(h.calls.put, 1);
});

test("online asset survives cache read rejection", async () => {
  const h = workerHarness({ storageReadError: true });
  assert.strictEqual(await run(h), h.networkResponse);
  assert.equal(h.calls.match, 1);
});

test("cached asset remains usable when network is offline", async () => {
  const h = workerHarness({ networkError: true, cached: true });
  assert.strictEqual(await run(h), h.cachedResponse);
});

test("offline with unavailable Cache Storage fails closed", async () => {
  const h = workerHarness({ networkError: true, storageOpenError: true });
  assert.strictEqual(await run(h), h.offlineResponse);
});

test("ordinary stale-while-revalidate still serves cache and updates it", async () => {
  const h = workerHarness({ cached: true });
  assert.strictEqual(await run(h), h.cachedResponse);
  assert.equal(h.calls.put, 1);
});

test("cache miss still returns the successful network response", async () => {
  const h = workerHarness();
  assert.strictEqual(await run(h), h.networkResponse);
  assert.equal(h.calls.put, 1);
});

test("online cold-cache response does not wait for slow Cache Storage persistence", async () => {
  let finishWrite;
  const writeGate = new Promise(resolve => { finishWrite = resolve; });
  const h = workerHarness({ storageWriteGate: writeGate });
  const responsePromise = h.context.staleWhileRevalidate(h.request, h.event);
  let delivered = false;
  responsePromise.then(() => { delivered = true; });

  // Give the resolved synthetic fetch and cache lookup a complete event-loop
  // turn. The best-effort cache put remains deliberately unresolved.
  await new Promise(resolve => setImmediate(resolve));
  const deliveredBeforeWrite = delivered;
  finishWrite();

  assert.strictEqual(await responsePromise, h.networkResponse);
  await Promise.all(h.pending);
  assert.equal(deliveredBeforeWrite, true,
    "successful network response must not wait on best-effort Cache Storage writes");
  assert.equal(h.calls.put, 1, "background persistence must still be attempted");
});

test("network response body is cloned before asynchronous Cache Storage opens", async () => {
  let finishOpen;
  const openGate = new Promise(resolve => { finishOpen = resolve; });
  const pending = [];
  let opens = 0;
  let writes = 0;
  let clones = 0;
  let bodyConsumed = false;
  const networkResponse = {
    ok: true,
    clone() {
      clones += 1;
      if (bodyConsumed) throw new Error("network body already consumed");
      return { copied: true };
    },
  };
  const cache = {
    async match() { return undefined; },
    async put(_request, copy) {
      assert.equal(copy.copied, true);
      writes += 1;
    },
  };
  const context = {
    URL,
    caches: {
      async open() {
        opens += 1;
        if (opens === 2) await openGate;
        return cache;
      },
    },
    async fetch() { return networkResponse; },
    Response: { error() { return { offline: true }; } },
    self: {
      location: { origin: "https://school.example" },
      addEventListener() {},
    },
  };
  runInNewContext(workerSource, context, { filename: "pages/sw.js" });
  const received = context.staleWhileRevalidate(
    { url: "https://school.example/assets/illustrations/reading.webp" },
    { waitUntil(promise) { pending.push(promise); } }
  );
  let delivered = false;
  received.then(() => {
    delivered = true;
    bodyConsumed = true;
  });
  await new Promise(resolve => setImmediate(resolve));
  const deliveredBeforeCacheOpen = delivered;
  finishOpen();

  assert.strictEqual(await received, networkResponse);
  await Promise.all(pending);
  assert.equal(deliveredBeforeCacheOpen, true,
    "cache open must not delay a successful online response");
  assert.equal(clones, 1,
    "network response must be cloned exactly once before the body is consumed");
  assert.equal(writes, 1,
    "deferred persistence must still store the independently cloned response");
});

// networkFirst responds immediately online while Cache Storage work runs in
// waitUntil. Delayed storage opening must not leave an already-consumed body
// uncacheable, even though the browser received a successful response.
test("network-first clones response before delayed Cache Storage opening", async () => {
  let releaseOpen;
  const openGate = new Promise(resolve => { releaseOpen = resolve; });
  const pending = [];
  let clones = 0;
  let writes = 0;
  let bodyConsumed = false;
  const networkResponse = {
    ok: true,
    clone() {
      clones++;
      if (bodyConsumed) throw new Error("response body already consumed");
      return { independentCacheCopy: true };
    },
  };
  const context = {
    URL, Headers,
    Response: { error() { throw new Error("unexpected offline error"); } },
    caches: {
      async open() {
        await openGate;
        return {
          async put(_request, copy) {
            assert.equal(copy.independentCacheCopy, true);
            writes++;
          },
        };
      },
    },
    async fetch() { return networkResponse; },
    self: {
      location: { origin: "https://school.example" },
      addEventListener() {},
    },
  };
  runInNewContext(workerSource, context, { filename: "pages/sw.js" });
  const received = await context.networkFirst(
    { url: "https://school.example/data/schoolwork.json" }, null,
    { waitUntil(promise) { pending.push(promise); } }
  );
  assert.strictEqual(received, networkResponse,
    "successful online response must not wait for Cache Storage");
  bodyConsumed = true;
  releaseOpen();
  await Promise.all(pending);
  assert.equal(clones, 1, "response should be cloned exactly once");
  assert.equal(writes, 1,
    "a slow cache.open must not prevent offline persistence after the response is served");
});

test("network-first online assets survive unavailable Cache Storage", async () => {
  const h = workerHarness({ storageOpenError: true });
  assert.strictEqual(await h.context.networkFirst(h.request, null, h.event), h.networkResponse);
  await Promise.all(h.pending);
  assert.equal(h.calls.fetch, 1);
});

test("network-first offline asset returns an explicit error when storage is denied", async () => {
  const h = workerHarness({ networkError: true, storageOpenError: true });
  assert.strictEqual(await h.context.networkFirst(h.request, null, h.event), h.offlineResponse);
  await Promise.all(h.pending);
});

test("network-first offline asset returns an explicit error when cache read fails", async () => {
  const h = workerHarness({ networkError: true, storageReadError: true });
  assert.strictEqual(await h.context.networkFirst(h.request, null, h.event), h.offlineResponse);
  await Promise.all(h.pending);
});

async function dispatchUncategorizedGet(h) {
  let responsePromise;
  h.listeners.get("fetch")({
    request: {
      url: "https://school.example/robots.txt",
      method: "GET",
      mode: "same-origin",
    },
    respondWith(promise) { responsePromise = promise; },
  });
  assert.ok(responsePromise, "real service worker must handle an uncategorized same-origin GET");
  return responsePromise;
}

test("uncategorized online GET survives Cache Storage open rejection", async () => {
  const h = workerHarness({ storageOpenError: true });
  assert.strictEqual(await dispatchUncategorizedGet(h), h.networkResponse);
  assert.equal(h.calls.fetch, 1);
});

test("uncategorized online GET survives Cache Storage match rejection", async () => {
  const h = workerHarness({ storageReadError: true });
  assert.strictEqual(await dispatchUncategorizedGet(h), h.networkResponse);
  assert.equal(h.calls.fetch, 1);
});

test("uncategorized cached GET still avoids an unnecessary fetch", async () => {
  const h = workerHarness({ cached: true });
  assert.strictEqual(await dispatchUncategorizedGet(h), h.cachedResponse);
  assert.equal(h.calls.fetch, 0);
});

test("uncategorized offline GET returns an explicit network error when Cache Storage cannot open", async () => {
  const h = workerHarness({ networkError: true, storageOpenError: true });
  assert.strictEqual(await dispatchUncategorizedGet(h), h.offlineResponse);
  assert.equal(h.calls.fetch, 1);
  assert.equal(h.calls.match, 0);
});

test("uncategorized offline GET returns an explicit network error when cache reads reject", async () => {
  const h = workerHarness({ networkError: true, storageReadError: true });
  assert.strictEqual(await dispatchUncategorizedGet(h), h.offlineResponse);
  assert.equal(h.calls.fetch, 1);
  assert.equal(h.calls.match, 1);
});

test("uncategorized offline GET returns an explicit error on a normal cache miss", async () => {
  const h = workerHarness({ networkError: true });
  assert.strictEqual(await dispatchUncategorizedGet(h), h.offlineResponse);
  assert.equal(h.calls.fetch, 1);
  assert.equal(h.calls.match, 1);
});


// Activation must be usable online even when background Cache Storage cleanup
// fails. Execute the actual worker's activate event with deliberate faults.
async function runActivation({keysError = false, deletionError = false} = {}) {
  const listeners = new Map();
  const pending = [];
  const calls = {claims: 0, deleted: []};
  const cacheKeys = [
    "abvm-grade2-parent-companion-v198",
    "abvm-grade2-parent-companion-v199-version-integrity",
    "unrelated-application-cache",
  ];
  runInNewContext(workerSource, {
    caches: {
      async keys() {
        if (keysError) throw new Error("synthetic Cache Storage keys rejection");
        return cacheKeys;
      },
      async delete(key) {
        calls.deleted.push(key);
        if (deletionError) throw new Error("synthetic cleanup rejection");
        return true;
      },
    },
    self: {
      addEventListener(type, handler) { listeners.set(type, handler); },
      clients: { async claim() { calls.claims += 1; } },
    },
  }, {filename: "pages/sw.js"});
  const activate = listeners.get("activate");
  assert.equal(typeof activate, "function");
  activate({waitUntil(promise) { pending.push(promise); }});
  assert.equal(pending.length, 1);
  await Promise.all(pending);
  return calls;
}

test("activation still claims online clients when Cache Storage enumeration rejects", async () => {
  const calls = await runActivation({keysError: true});
  assert.equal(calls.claims, 1);
  assert.deepEqual(calls.deleted, []);
});

test("activation still claims clients if deleting an obsolete cache rejects", async () => {
  const calls = await runActivation({deletionError: true});
  assert.equal(calls.claims, 1);
  assert.deepEqual(calls.deleted, ["abvm-grade2-parent-companion-v198"]);
});

test("healthy activation cleans only obsolete ABVM cache and still claims clients", async () => {
  const calls = await runActivation();
  assert.equal(calls.claims, 1);
  assert.deepEqual(calls.deleted, ["abvm-grade2-parent-companion-v198"]);
});


// A successful 204/205 may be stored by networkFirst. Offline fallback must
// not reconstruct that cached response with an empty Blob: Fetch forbids even
// an empty body for null-body status codes.
async function cachedNetworkFirstFallback(status) {
  const cached=new Response(status===200?"cached-good":null,{status});
  const pending=[];
  const context={
    URL,Headers,Response,
    caches:{async open(){return {async match(){return cached;},async put(){}};}},
    async fetch(){throw new Error("synthetic offline network");},
    self:{location:{origin:"https://school.example"},addEventListener(){}},
  };
  runInNewContext(workerSource,context,{filename:"pages/sw.js"});
  const actual=await context.networkFirst(
    {url:"https://school.example/data/schoolwork.json"},null,
    {waitUntil(promise){pending.push(promise);}}
  );
  await Promise.all(pending);
  assert.equal(actual.status,status);
  assert.equal(actual.headers.get("X-ABVM-Cache-Fallback"),"1");
  return actual;
}

test("network-first cached HTTP 204 remains a valid offline response",async()=>{
  assert.equal(await (await cachedNetworkFirstFallback(204)).text(),"");
});

test("network-first cached HTTP 205 remains a valid offline response",async()=>{
  assert.equal(await (await cachedNetworkFirstFallback(205)).text(),"");
});

test("network-first cached HTTP 200 preserves offline body and fallback marker",async()=>{
  assert.equal(await (await cachedNetworkFirstFallback(200)).text(),"cached-good");
});


// A cached Response may become unreadable after a successful CacheStorage.match.
// Network-first must fail explicitly offline and preserve a real HTTP 503 online.
async function cachedResponseBodyReadFailure(upstreamStatus=null) {
  const corruptCachedResponse = {
    status: 200,
    statusText: "OK",
    headers: new Headers({"Content-Type": "text/plain"}),
    async blob() { throw new Error("synthetic cached response body is unreadable"); },
  };
  const upstream = upstreamStatus === null
    ? null : new Response("service unavailable", {status: upstreamStatus});
  const pending=[];
  const context={
    URL,Headers,Response,
    caches:{async open(){return {
      async match(){return corruptCachedResponse;},
      async put(){},
    };}},
    async fetch(){
      if(upstream)return upstream;
      throw new Error("synthetic offline network");
    },
    self:{location:{origin:"https://school.example"},addEventListener(){}},
  };
  runInNewContext(workerSource,context,{filename:"pages/sw.js"});
  const actual=await context.networkFirst(
    {url:"https://school.example/data/schoolwork.json"},null,
    {waitUntil(promise){pending.push(promise);}}
  );
  await Promise.all(pending);
  return {actual,upstream};
}

test("network-first returns an explicit offline error if cached response body is unreadable",async()=>{
  const {actual}=await cachedResponseBodyReadFailure();
  assert.equal(actual.type,"error");
  assert.equal(actual.status,0);
});

test("network-first preserves upstream HTTP 503 if cached response body is unreadable",async()=>{
  const {actual,upstream}=await cachedResponseBodyReadFailure(503);
  assert.strictEqual(actual,upstream);
  assert.equal(actual.status,503);
});

// A Cache Storage API can stall, rather than reject. The worker must still
// deliver an already successful online response while cache reads/writes wait.
test("stale-while-revalidate online response does not wait for blocked cache lookup",async()=>{
  let releaseStorage;
  const storageGate=new Promise(resolve=>{releaseStorage=resolve;});
  const pending=[];
  let clones=0;
  let writes=0;
  const onlineResponse={
    ok:true,
    clone(){clones++;return {independentCopy:true};},
  };
  const context={
    URL,setTimeout,
    caches:{async open(){
      await storageGate;
      return {
        async match(){return undefined;},
        async put(_request,copy){
          assert.equal(copy.independentCopy,true);
          writes++;
        },
      };
    }},
    async fetch(){return onlineResponse;},
    Response:{error(){return {offline:true};}},
    self:{location:{origin:"https://school.example"},addEventListener(){}},
  };
  runInNewContext(workerSource,context,{filename:"pages/sw.js"});
  const responsePromise=context.staleWhileRevalidate(
    {url:"https://school.example/assets/illustrations/reading.webp"},
    {waitUntil(promise){pending.push(promise);}}
  );
  let delivered=false;
  responsePromise.then(()=>{delivered=true;});
  await new Promise(resolve=>setImmediate(resolve));
  const onlineDeliveredBeforeCacheOpens=delivered;
  releaseStorage();
  assert.strictEqual(await responsePromise,onlineResponse);
  await Promise.all(pending);
  assert.equal(onlineDeliveredBeforeCacheOpens,true,
    "successful online requests must not hang behind a stalled cache read");
  assert.equal(clones,1,"persistence should clone the response once");
  assert.equal(writes,1,"background cache persistence must still complete");
});
