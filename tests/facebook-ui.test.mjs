import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function api(){
  const context={window:{},fetch:()=>Promise.reject(new Error('fixture offline')),Intl,Date,URL};
  vm.runInNewContext(readFileSync(new URL('../pages/facebook-updates.js',import.meta.url),'utf8'),context);
  return context.window.ABVMFacebookUpdates;
}
const schoolId='100057127132786';
const hsaId='61552549763989';
const school={sourceId:'ABVM_SCHOOL_FACEBOOK',organization:'Assumption BVM School',
  postId:schoolId+'_101',
  postUrl:'https://www.facebook.com/permalink.php?story_fbid=101&id='+schoolId};
const hsa={sourceId:'ABVM_HSA_FACEBOOK',
  organization:'Assumption BVM Home & School Association',postId:hsaId+'_102',
  postUrl:'https://www.facebook.com/permalink.php?story_fbid=102&id='+hsaId};
const today=new Date('2026-10-08T20:00:00.000Z');
const day='2026-10-08T13:00:00.000Z';
const event=options=>({
  summary:'Approved school community announcement.',category:'School event',
  verificationStatus:'verified-and-reviewed',sources:[school,hsa],
  eventDates:['2026-10-08'],deadlineDates:[],postedAt:day,
  noticeStatus:'active',conflict:false,...options
});
const render=item=>api().renderFor({schemaVersion:1,display:[item]},'today','',today);

test('pinned Page identities match the reviewed source registry',()=>{
  const config=JSON.parse(readFileSync(new URL('../pages/data/facebook-sources.json',import.meta.url),'utf8'));
  assert.equal(config.sources.find(x=>x.id===school.sourceId).pageId,schoolId);
  assert.equal(config.sources.find(x=>x.id===hsa.sourceId).pageId,hsaId);
  assert.equal(config.sources.find(x=>x.id===school.sourceId).organization,school.organization);
  assert.equal(config.sources.find(x=>x.id===hsa.sourceId).organization,hsa.organization);
});
test('verified school and HSA links stay separately and correctly labeled',()=>{
  const html=render(event());
  assert.match(html,/ABVM school Facebook/);
  assert.match(html,/ABVM HSA Facebook/);
  assert.match(html,/ABVM school Facebook post/);
  assert.match(html,/ABVM HSA Facebook post/);
});
test('a wrong Page permalink or swapped post ID cannot borrow another Page label',()=>{
  assert.equal(render(event({sources:[{...school,postUrl:hsa.postUrl}]})),'');
  assert.equal(render(event({sources:[{...hsa,postUrl:school.postUrl}]})),'');
  assert.equal(render(event({sources:[{...hsa,postId:school.postId}]})),'');
  assert.equal(render(event({sources:[{...school,organization:hsa.organization}]})),'');
  assert.equal(render(event({sources:[school,school]})),'');
  assert.equal(render(event({sources:[{...hsa,postUrl:'https://www.facebook.com/permalink.php?story_fbid=999&id='+hsaId}]})),'');
});
test('a legitimate owner-bound post path remains supported but fabricated paths fail closed',()=>{
  assert.match(render(event({sources:[{...school,postUrl:'https://www.facebook.com/ABVM11/posts/101'}]})),/ABVM school Facebook/);
  assert.match(render(event({sources:[{...hsa,postUrl:'https://www.facebook.com/p/Assumption-BVM-Home-School-Association-61552549763989/posts/102'}]})),/ABVM HSA Facebook/);
  assert.equal(render(event({sources:[{...school,postUrl:'https://www.facebook.com/other/'+schoolId+'/posts/101'}]})),'');
  assert.equal(render(event({sources:[{...hsa,postUrl:'https://fake-facebook.example/post/102'}]})),'');
  assert.equal(render(event({sources:[{...school,postUrl:'https://www.facebook.com/ABVM11/posts/999'}]})),'');
});
test('unreviewed, undated, invalid dates, and hostile markup do not bypass display safeguards',()=>{
  const text=render(event({summary:'<script>steal()</script>',sources:[hsa]}));
  assert.ok(!text.includes('<script>'));
  assert.match(text,/&lt;script&gt;/);
  assert.equal(render(event({verificationStatus:'pending'})),'');
  assert.equal(render(event({postedAt:'2026-10-08'})),'');
  assert.equal(render(event({eventDates:['2026-02-30']})),'');
  assert.equal(render(event({deadlineDates:['2026-10-99']})),'');
});
test('today and week selections use original event/publication dates',()=>{
  const old=event({summary:'Prior month update',sources:[hsa],eventDates:[],
    postedAt:'2026-09-04T13:00:00.000Z'});
  const screen=api();
  const data={schemaVersion:1,display:[old]};
  assert.equal(screen.renderFor(data,'today','',today),'');
  assert.equal(screen.renderFor(data,'week','2026-10-05',today),'');
  const upcoming=event({...old,eventDates:['2026-10-09']});
  assert.match(screen.renderFor({schemaVersion:1,display:[upcoming]},'week','2026-10-05',today),/Prior month update/);
});
test('conflicting dates remain explicitly unresolved',()=>{
  assert.match(render(event({summary:'Different schedule dates',sources:[school],conflict:true})),
    /Announcement details conflict/);
});
