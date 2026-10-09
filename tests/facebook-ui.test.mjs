import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function api(){
  const context={window:{},fetch:()=>Promise.reject(new Error('fixture offline')),Intl,Date,URL};
  vm.runInNewContext(readFileSync(new URL('../pages/facebook-updates.js',import.meta.url),'utf8'),context);
  return context.window.ABVMFacebookUpdates;
}
const entry=(source,link)=>({sourceId:source,postUrl:link,postId:'post1'});
const school=entry('ABVM_SCHOOL_FACEBOOK','https://www.facebook.com/permalink.php?story_fbid=1&id=123');
const hsa=entry('ABVM_HSA_FACEBOOK','https://www.facebook.com/permalink.php?story_fbid=2&id=456');
const today=new Date('2026-10-08T20:00:00.000Z');
const day='2026-10-08T13:00:00.000Z';
test('school and HSA source labels stay separate even on one shared event',()=>{
  const html=api().renderFor({schemaVersion:1,display:[{summary:'An upcoming event',category:'School event',
    sources:[school,hsa],eventDates:['2026-10-08'],postedAt:day,conflict:false}]},'today','',today);
  assert.match(html,/ABVM school Facebook/);
  assert.match(html,/ABVM HSA Facebook/);
  assert.match(html,/ABVM school Facebook post/);
  assert.match(html,/ABVM HSA Facebook post/);
});
test('edited, unapproved, or hostile markup is never executed by the display',()=>{
  const html=api().renderFor({schemaVersion:1,display:[{summary:'<script>steal()</script>',
    sources:[hsa],eventDates:['2026-10-08'],postedAt:day,conflict:false}]},'today','',today);
  assert.ok(!html.includes('<script>'));
  assert.match(html,/&lt;script&gt;/);
  const external=api().renderFor({schemaVersion:1,display:[{summary:'Outside page',
    sources:[{...hsa,postUrl:'https://fake-facebook.example/'}],
    eventDates:['2026-10-08'],postedAt:day}]},'today','',today);
  assert.equal(external,'');
});
test('today/week selection derives from original dates, not retrieval/check time',()=>{
  const item={summary:'Prior month update',sources:[hsa],eventDates:[],
    postedAt:'2026-09-04T13:00:00.000Z',conflict:false};
  const screen=api();
  assert.equal(screen.renderFor({schemaVersion:1,display:[item]},'today','',today),'');
  assert.equal(screen.renderFor({schemaVersion:1,display:[item]},'week','2026-10-05',today),'');
  const upcoming={...item,eventDates:['2026-10-09']};
  assert.match(screen.renderFor({schemaVersion:1,display:[upcoming]},'week','2026-10-05',today),/Prior month update/);
});
test('conflicts stay explicitly unresolved on Today',()=>{
  const html=api().renderFor({schemaVersion:1,display:[{summary:'Different schedule dates',
    sources:[school],eventDates:['2026-10-08'],postedAt:day,conflict:true}]},'today','',today);
  assert.match(html,/Dates or status conflict/);
  assert.doesNotMatch(html,/Confirmed date/i);
});
