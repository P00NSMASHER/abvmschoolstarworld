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

function retryCacheProbe({online=false,version='107'}={}){
  const cachedUrl='https://abvm.example/study-games.js?v='+version;
  const entries=new Map(online?[]:[[cachedUrl,new Response('saved engine '+version)]]);
  const fetched=[],matched=[],written=[],pending=[];
  const key=request=>typeof request==='string'?request:request.url;
  const context={URL,Request,Response,Headers,
    caches:{async open(){return {
      async match(request,options){
        matched.push({url:key(request),ignoreSearch:!!options?.ignoreSearch});
        return entries.get(key(request))?.clone();
      },
      async put(request,response){written.push(key(request));entries.set(key(request),response);},
    };}},
    async fetch(request){
      fetched.push(key(request));
      if(!online)throw new Error('synthetic offline connection');
      return new Response('fresh engine 107');
    },
    self:{addEventListener(){}},
  };
  runInNewContext(workerSource,context,{filename:'sw.js'});
  return {context,fetched,matched,written,entries,pending,
    request:new Request('https://abvm.example/study-games.js?v=107&abvm-retry=1'),
    event:{waitUntil(promise){pending.push(promise);}},
  };
}

test('online engine retry fetches its isolated URL but caches under the exact version URL',async()=>{
  const h=retryCacheProbe({online:true});
  const response=await h.context.networkFirst(h.request,null,h.event);
  assert.equal(await response.text(),'fresh engine 107');
  await Promise.all(h.pending);
  assert.deepEqual(h.fetched,[h.request.url]);
  assert.deepEqual(h.written,['https://abvm.example/study-games.js?v=107']);
  assert.equal(h.entries.size,1,'retry tokens must not create growing duplicate script caches');
});

test('offline engine retry uses the already cached exact version',async()=>{
  const h=retryCacheProbe();
  const response=await h.context.networkFirst(h.request,null,h.event);
  assert.equal(await response.text(),'saved engine 107');
  assert.equal(response.headers.get('X-ABVM-Cache-Fallback'),'1');
  assert.deepEqual(h.matched,[{url:'https://abvm.example/study-games.js?v=107',ignoreSearch:false}]);
});

test('offline engine retry cannot use another cached code version',async()=>{
  const h=retryCacheProbe({version:'106'});
  const response=await h.context.networkFirst(h.request,null,h.event);
  assert.equal(response.type,'error');
  assert.equal(h.matched.some(row=>row.ignoreSearch),false);
});

test('retry normalization is limited to the two versioned Study scripts',async()=>{
  const h=retryCacheProbe();
  for(const suffix of ['app.js?v=175&abvm-retry=1','study-games.js?abvm-retry=1',
    'study-games.js?v=107&abvm-retry=unexpected','study-games-view.js?v=16&abvm-retry=1&abvm-retry=2']){
    const request=new Request('https://abvm.example/'+suffix);
    assert.strictEqual(h.context.studyScriptCacheRequest(request),request,suffix);
  }
  const view=new Request('https://abvm.example/study-games-view.js?v=16&abvm-retry=2');
  assert.equal(h.context.studyScriptCacheRequest(view).url,'https://abvm.example/study-games-view.js?v=16');
});
