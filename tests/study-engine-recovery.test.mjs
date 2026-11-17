import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app = readFileSync(new URL('../pages/app.js', import.meta.url), 'utf8');
const productView = readFileSync(new URL('../pages/product-view.js', import.meta.url), 'utf8');
const start = app.indexOf('function ensureStudyGameEngine(){');
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

test('retry starts a fresh engine request and retains the already loaded renderer', async () => {
  const h = harness(), first = h.context.ensureStudyGameEngine();
  h.loaded('study-games-view.js','ABVMStudyGameView');
  h.expireNetworkDeadline();
  assert.equal((await outcome(first)).state,'error');
  const second = h.context.ensureStudyGameEngine();
  h.loaded('study-games.js','ABVMStudyGames');
  const actual = await outcome(second);
  assert.equal(actual.state,'ready');
  assert.strictEqual(actual.value,h.context.window.ABVMStudyGames);
  assert.equal(h.scripts.filter(script => script.src.includes('study-games-view.js')).length,1);
  assert.equal(h.scripts.filter(script => script.src.includes('study-games.js')).length,2);
  assert.equal(h.timers.size,0);
});

test('ordinary script errors settle promptly and can retry successfully', async () => {
  const h = harness(), first = h.context.ensureStudyGameEngine();
  h.loaded('study-games-view.js','ABVMStudyGameView');
  h.scripts.find(script => script.src.includes('study-games.js')).onerror();
  assert.equal((await outcome(first)).state,'error');
  const second = h.context.ensureStudyGameEngine();
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
  const second = h.context.ensureStudyGameEngine();
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
