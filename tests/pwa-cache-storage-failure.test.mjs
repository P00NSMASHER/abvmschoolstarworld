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
    },
  };
  const context = {
    URL,
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
