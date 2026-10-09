import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const product=read("../pages/product-view.js");
const app=read("../pages/app.js");
const index=read("../pages/index.html");
const sw=read("../pages/sw.js");

test("anonymous public app copy must not hardcode a child identity",()=>{
  for(const source of [product,app]){
    assert.doesNotMatch(source,/\b(?:Hi,\s*Emma!|Emma!|Emma['’]s rank journey)\b/i);
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
  for(const path of ["./app.js?v=138","./product-view.js?v=8"]){
    assert.ok(index.includes(path),path+" missing in HTML");
    assert.ok(sw.includes(path),path+" missing in SW shell");
  }
  assert.match(index,/abvm-sw-reloaded-v150/);
  assert.match(sw,/abvm-grade2-parent-companion-v150-public-privacy/);
  const shell=sw.match(/const STATIC_SHELL = \[([\s\S]*?)\];/)?.[1]||"";
  assert.equal((shell.match(/"\.\//g)||[]).length,14,"existing offline shell footprint changed");
});
