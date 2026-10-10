import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const product=read("../pages/product-view.js");
const app=read("../pages/app.js");
const studyGameView=read("../pages/study-games-view.js");
const index=read("../pages/index.html");
const sw=read("../pages/sw.js");

test("anonymous public app copy must not hardcode a child identity",()=>{
  // The public app is anonymous on first load AND after finishing a round.
  for(const source of [product,app,studyGameView]){
    assert.doesNotMatch(source,/\bEmma\b/i);
  }
  assert.match(product,/<h2>Ready for today\?<\/h2>/);
  assert.match(app,/Let’s learn, <span>eagle!<\/span>/);
});

test("gamified ranks are clearly study ranks and never presented as school grades",()=>{
  assert.match(product,/STUDY RANK ·/);
  assert.match(product,/STUDY RANK JOURNEY/);
  assert.match(product,/Saved on this device\. Ranks celebrate practice, not school grades\./);
  assert.doesNotMatch(product,/YOUR RANK ·/);
  assert.doesNotMatch(product,/EMMA’S RANK JOURNEY/);
});

test("privacy copy deployment keeps service-worker shell and reload versions aligned",()=>{
  for(const file of ["app.js","product-view.js"]){
    const url=index.match(new RegExp("\\\\./"+file.replace(".","\\\\.")+"\\\\?v=\\\\d+"))?.[0];
    assert.ok(url,file+" needs a versioned HTML reference");
    assert.ok(sw.includes('"'+url+'"'),url+" missing in SW shell");
  }
  assert.ok(app.includes("./study-games-view.js?v=15"));
  assert.ok(sw.includes("./study-games-view.js?v=15"));
  const reload=index.match(/abvm-sw-reloaded-v(\\d+)/)?.[1];
  const cache=sw.match(/abvm-grade2-parent-companion-v(\\d+)-/)?.[1];
  assert.ok(reload,"SW reload revision missing from HTML");
  assert.equal(cache,reload,"SW cache and HTML reload revisions must match");
  const shell=sw.match(/const STATIC_SHELL = \[([\s\S]*?)\];/)?.[1]||"";
  assert.equal((shell.match(/"\.\//g)||[]).length,14,"existing offline shell footprint changed");
});

test("completed practice still uses an anonymous, encouraging heading",()=>{
  const context={window:{}};
  vm.runInNewContext(studyGameView,context);
  const result=context.window.ABVMStudyGameView.finish({
    mode:{id:"words",title:"Reading practice"},
    state:{questions:[{id:"sample"}],results:[{
      counted:true,firstCorrect:true,resolvedCorrect:true,
      hintUsed:false,subject:"Reading"
    }]},
    record:{plays:0},
    summary:{strong:1,remembered:0,practice:0},
    reward:{status:"done",awardedAmount:10,balance:10}
  });
  assert.match(result,/Nice work, eagle!/);
  assert.doesNotMatch(result,/\bEmma\b/i);
  assert.match(result,/First-try accuracy/);
  assert.match(result,/Practice again/);
  assert.match(result,/Study Stars/);
});
