import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app = readFileSync(new URL('../pages/app.js', import.meta.url), 'utf8');
const productView = readFileSync(new URL('../pages/product-view.js', import.meta.url), 'utf8');
const engineSource = readFileSync(new URL('../pages/study-games.js', import.meta.url), 'utf8');
const start = app.indexOf('function ensureStudyGameEngine(');
const end = app.indexOf('function studyGameCatalog(){', start);
assert.ok(start >= 0 && end > start);

function harness() {
  const timers = new Map(), scripts = [];
  let timerId = 0;
  const context = {
    window:{},
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id,{callback,delay}); return id; },
    clearTimeout(id) { timers.delete(id); },
    document:{
      createElement() { return {remove() { this.removed = true; }}; },
      head:{append(script) { scripts.push(script); }},
    },
  };
  runInNewContext(productView,context,{filename:'pages/product-view.js'});
  runInNewContext(app.slice(start,end),context,{filename:'pages/app.js'});
  return {
    context, scripts, timers,
    expireNetworkDeadline() {
      for (const [id,timer] of [...timers]) {
        if (timer.delay <= 12_000) { timers.delete(id); timer.callback(); }
      }
    },
    loaded(fragment,key) {
      context.window[key] = {ready:true};
      scripts.filter(script => script.src.includes(fragment) && !script.removed).at(-1).onload();
    },
  };
}

async function outcome(promise) {
  // An actual never-settling request must fail this test rather than leave CI
  // waiting forever. The loader's own timers are advanced independently.
  let watchdog;
  try {
    return await Promise.race([
      promise.then(value => ({state:'ready',value}), error => ({state:'error',message:error.message})),
      new Promise(resolve => { watchdog = setTimeout(() => resolve({state:'hung'}), 30); }),
    ]);
  } finally { clearTimeout(watchdog); }
}

test('Study engine request timeout rejects instead of leaving the app loading forever', async () => {
  const h = harness(), pending = h.context.ensureStudyGameEngine();
  h.loaded('study-games-view.js','ABVMStudyGameView');
  h.expireNetworkDeadline();
  const actual = await outcome(pending);
  assert.equal(actual.state,'error','a stalled engine must reach the retryable error path');
  assert.match(actual.message,/too long/i);
  assert.equal(h.scripts.find(script => script.src.includes('study-games.js')).removed,true);
});

test('idle warm-up cannot silently retry a failed engine before the user retries', async () => {
  const h = harness();
  let warmGames;
  Object.assign(h.context,{
    pack:{},fetchPack:async()=>{},fetchHomeworkFeed:async()=>{},
    requestIdleCallback(callback){warmGames=callback;},
  });
  h.context.window.requestIdleCallback=h.context.requestIdleCallback;
  const loadStart=app.indexOf('async function load(){');
  const loadEnd=app.indexOf('window.addEventListener("hashchange"',loadStart);
  assert.ok(loadStart>=0&&loadEnd>loadStart);
  runInNewContext(app.slice(loadStart,loadEnd),h.context,{filename:'pages/app.js'});

  const first=h.context.ensureStudyGameEngine();
  h.loaded('study-games-view.js','ABVMStudyGameView');
  await h.context.load();
  assert.equal(typeof warmGames,'function');
  h.expireNetworkDeadline();
  assert.equal((await outcome(first)).state,'error');
  const before=h.scripts.length;
  // Run the actual scheduled app callback after failure, matching the CI
  // trace where idle warm-up raced the visible Try again button.
  warmGames();
  await Promise.resolve();
  assert.equal(h.scripts.length,before,'background warm-up must preserve the failed state');
  assert.equal((await outcome(h.context.ensureStudyGameEngine())).state,'error');
  assert.equal(h.scripts.length,before,'passive callers must not start hidden retries');

  const retry=h.context.ensureStudyGameEngine(true);
  assert.equal(h.scripts.length,before+1);
  assert.strictEqual(h.context.ensureStudyGameEngine(),retry,'background callers share an explicit active retry');
  h.loaded('study-games.js','ABVMStudyGames');
  assert.equal((await outcome(retry)).state,'ready');
});

test('retry starts a fresh engine request and retains the already loaded renderer', async () => {
  const h = harness(), first = h.context.ensureStudyGameEngine();
  h.loaded('study-games-view.js','ABVMStudyGameView');
  h.expireNetworkDeadline();
  assert.equal((await outcome(first)).state,'error');
  const second = h.context.ensureStudyGameEngine(true);
  h.loaded('study-games.js','ABVMStudyGames');
  const actual = await outcome(second);
  assert.equal(actual.state,'ready');
  assert.strictEqual(actual.value,h.context.window.ABVMStudyGames);
  assert.equal(h.scripts.filter(script => script.src.includes('study-games-view.js')).length,1);
  assert.equal(h.scripts.filter(script => script.src.includes('study-games.js')).length,2);
  assert.equal(h.timers.size,0);
});

test('retry uses a new request URL while preserving the exact engine version', async () => {
  const h = harness(), first = h.context.ensureStudyGameEngine();
  h.loaded('study-games-view.js','ABVMStudyGameView');
  const firstUrl = new URL(h.scripts[0].src,'https://abvm.example/');
  h.expireNetworkDeadline();
  assert.equal((await outcome(first)).state,'error');
  const second = h.context.ensureStudyGameEngine(true);
  const retryUrl = new URL(h.scripts.at(-1).src,'https://abvm.example/');
  assert.notEqual(retryUrl.href,firstUrl.href,
    'a browser must not coalesce the retry with the still-pending original request');
  assert.equal(retryUrl.pathname,firstUrl.pathname);
  assert.equal(retryUrl.searchParams.get('v'),firstUrl.searchParams.get('v'));
  assert.equal(retryUrl.searchParams.get('abvm-retry'),'1');
  h.loaded('study-games.js','ABVMStudyGames');
  assert.equal((await outcome(second)).state,'ready');
});

test('ordinary script errors settle promptly and can retry successfully', async () => {
  const h = harness(), first = h.context.ensureStudyGameEngine();
  h.loaded('study-games-view.js','ABVMStudyGameView');
  h.scripts.find(script => script.src.includes('study-games.js')).onerror();
  assert.equal((await outcome(first)).state,'error');
  const second = h.context.ensureStudyGameEngine(true);
  h.loaded('study-games.js','ABVMStudyGames');
  assert.equal((await outcome(second)).state,'ready');
  assert.equal(h.timers.size,0);
});

test('one failed script retires its pending sibling before a new attempt', async () => {
  const h = harness(), first = h.context.ensureStudyGameEngine();
  const oldScripts = [...h.scripts], lateLoad = oldScripts[1].onload;
  oldScripts[0].onerror();
  assert.equal((await outcome(first)).state,'error');
  assert.equal(oldScripts.every(script => script.removed),true);
  assert.equal(h.timers.size,0);
  const second = h.context.ensureStudyGameEngine(true);
  const currentPromise = h.context.ensureStudyGameEngine();
  assert.strictEqual(currentPromise,second,'concurrent callers share one attempt');
  // A callback queued before cleanup cannot clear/resolve the newer attempt.
  lateLoad();
  assert.strictEqual(h.context.ensureStudyGameEngine(),currentPromise);
  h.loaded('study-games.js','ABVMStudyGames');
  h.loaded('study-games-view.js','ABVMStudyGameView');
  assert.equal((await outcome(second)).state,'ready');
  assert.equal(h.timers.size,0);
});

test('a late duplicate engine preserves the initialized engine and unsaved learning', () => {
  const context = {
    window:{},
    localStorage:{getItem(){return null;},setItem(){throw new Error('synthetic storage denial');}},
  };
  runInNewContext(engineSource,context,{filename:'pages/study-games.js'});
  const engine = context.window.ABVMStudyGames;
  engine.recordLearning({id:'retry-math-proof',subject:'Math',skill:'math-addition',prompt:'1 + 1',choices:['2','3'],answer:'2'},true);
  assert.equal(engine.learningStorageState(),'not-saved');
  assert.equal(engine.loadLearning()['math-addition'].Seen,1);
  // A removed script can finish after the new request already initialized
  // practice. Execute its real body again, as that late response would.
  runInNewContext(engineSource,context,{filename:'late-study-games.js'});
  assert.strictEqual(context.window.ABVMStudyGames,engine);
  assert.equal(context.window.ABVMStudyGames.loadLearning()['math-addition'].Seen,1);
  assert.equal(context.window.ABVMStudyGames.learningStorageState(),'not-saved');
});
