import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMaterialsView} from '../pages/study-games-materials-view.mjs';
const math={date:'2026-11-17',label:'Math lessons 1–5 (two-digit addition with and without regrouping)',subject:'Math'};
const religion={date:'2026-11-17',label:'Religion',subject:'Religion'};
function prepFor(tests){
 const win={location:{hash:'#study?prep=1'},document:{}};
 const view=createMaterialsView({win});
 view.setModel({upcomingTests:()=>({tests,supported:[],missing:[],fallback:[],message:''}),testPreview:()=>({topics:[],total:0,retryCount:0})});
 return view.priorityHtml({loading:false});
}
test('November 17 Math + Religion original papers have a working, discoverable Study link',()=>{
 const html=prepFor([math,religion]);
 assert.match(html,/<a[^>]*data-paper-practice[^>]*href="\.\/november-practice-tests\.html"/);
 assert.match(html,/Original practice, not your teacher/);
 const resource=readFileSync(new URL('../pages/november-practice-tests.html',import.meta.url),'utf8');
 assert.match(resource,/Back to Study/);
 assert.match(resource,/href="\.\/index\.html#study"/);
});
test('one-off paper never appears for missing, unverified, or different-week exam data',()=>{
 for(const tests of [[],[math],[religion],[{...math,date:'2026-11-24'},religion],
 [{...math,date:'2026-11-24'},{...religion,date:'2026-11-24'}],
 [{...math,label:'Spelling'},religion]]){
  assert.doesNotMatch(prepFor(tests),/data-paper-practice/,JSON.stringify(tests));
 }
});
test('installed PWA version links and cache include this one-time practice page',()=>{
 const base=new URL('../pages/',import.meta.url);
 const sw=readFileSync(new URL('sw.js',base),'utf8');
 const app=readFileSync(new URL('app.js',base),'utf8');
 const index=readFileSync(new URL('index.html',base),'utf8');
 assert.match(sw,/november-practice-tests\.html/);
 assert.match(sw,/study-games-materials-view\.mjs\?v=23/);
 assert.match(app,/study-games-materials-view\.mjs\?v=23/);
 assert.match(sw,/app\.js\?v=175/);
 assert.match(index,/app\.js\?v=175/);
});
