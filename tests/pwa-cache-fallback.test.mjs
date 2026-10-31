import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

// Exercise the actual service worker's cache fallback with an adversarial
// cache containing a plausible but wrong prior revision. No browser, network,
// account data or third-party worker runtime required.
const workerSource=readFileSync(new URL("../pages/sw.js",import.meta.url),"utf8");

function cacheProbe({exactHit=false}={}){
  const calls=[];
  const exact={revision:"requested"};
  const stale={revision:"prior"};
  const cache={
    async match(request,options){
      calls.push({url:typeof request==="string"?request:request.url,ignoreSearch:!!options?.ignoreSearch});
      return options?.ignoreSearch?stale:(exactHit?exact:undefined);
    }
  };
  const context={URL,caches:{async open(){return cache}},self:{addEventListener(){}}};
  runInNewContext(workerSource,context,{filename:"sw.js"});
  assert.equal(typeof context.cachedFallback,"function");
  return {context,calls,exact,stale};
}

test("offline versioned code never falls back to bytes from another revision",async()=>{
  const p=cacheProbe();
  for(const file of ["app.js?v=999","styles.css?v=999","study-materials.mjs?v=999"]){
    const result=await p.context.cachedFallback({url:"https://abvm.example/"+file});
    assert.equal(result,null,"a different revision must not be silently accepted: "+file);
  }
  assert.equal(p.calls.length,3);
  assert.equal(p.calls.filter(call=>call.ignoreSearch).length,0);
});

test("offline exact current version remains usable without ignoring its query",async()=>{
  const p=cacheProbe({exactHit:true});
  const result=await p.context.cachedFallback({url:"https://abvm.example/app.js?v=166"});
  assert.equal(result,p.exact);
  assert.deepEqual(p.calls.map(call=>call.ignoreSearch),[false]);
});

test("nonversioned data keeps the proven query-insensitive offline fallback",async()=>{
  const p=cacheProbe();
  const result=await p.context.cachedFallback({url:"https://abvm.example/data/lunch-art-current.json?refresh=1"});
  assert.equal(result,p.stale);
  assert.deepEqual(p.calls.map(call=>call.ignoreSearch),[false,true]);
});
