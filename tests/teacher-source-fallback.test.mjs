import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context={window:{}};
runInNewContext(readFileSync(new URL("../pages/product-view.js",import.meta.url),"utf8"),context);
const view=context.window.ABVMProductView;

for(const state of ["stale","attention"]){
  test("teacher source link is provided only for online "+state+" verification",()=>{
    const html=view.freshnessControl({state,label:"Teacher pages need refresh",pending:false,online:true});
    assert.match(html,/class="freshness /);
    assert.match(html,/class="teacher-live-source"/);
    assert.match(html,/https:\/\/sites\.google\.com\/view\/abvmgr2\/home/);
    assert.match(html,/target="_blank" rel="noopener noreferrer"/);
    assert.match(html,/app verification stays unchanged/);
  });
}
for(const state of ["current","offline"]){
  test("teacher source link is absent for "+state+" verification",()=>{
    const html=view.freshnessControl({state,label:"Published info",online:true});
    assert.doesNotMatch(html,/teacher-live-source/);
  });
}
test("the official source fallback is unavailable offline regardless of source age",()=>{
  for(const state of ["stale","attention"]){
    const html=view.freshnessControl({state,label:"Old source",online:false});
    assert.doesNotMatch(html,/teacher-live-source/);
  }
});
test("freshness labels and actions escape the pack's supplied text",()=>{
  const html=view.freshnessControl({state:"current",label:'<script>"&',online:true});
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/&lt;script&gt;&quot;&amp;/);
});
test("pending verification keeps a disabled refresh button without changing link status",()=>{
  const html=view.freshnessControl({state:"stale",label:"Checking published school info…",pending:true,online:true});
  assert.match(html,/data-refresh-pack[^>]*disabled/);
  assert.match(html,/teacher-live-source/);
});
