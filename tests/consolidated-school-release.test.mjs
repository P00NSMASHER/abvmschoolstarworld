import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {validateUploadedNoticePolicy} from '../scripts/uploaded-notice-policy.mjs';
import {validateUploadedNoticeIntegration} from '../scripts/validate-uploaded-notices.mjs';
import {integrateUploadedNotices,noticeHash,dateKey} from '../scripts/integrate-uploaded-notices.mjs';
const load=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const notice=load('../pages/data/uploaded-notices.json');
const data=load('../pages/data/study-pack.json');
const schoolwork=load('../pages/data/schoolwork.json');
const ids=['hsa-newsletter-2026-11-parent-pdf','hsa-melody-message-cheer-dec-2026','weekly-planner-2026-11-16-parent-photo'];
const scope={window:{}};
runInNewContext(readFileSync(new URL('../pages/school-updates.js',import.meta.url),'utf8'),scope);
const {uniqueEvents,uniqueRows}=scope.window.ABVMSchoolUpdates;

function calendar(day,pattern){return data.pack.importantDates.filter(item=>dateKey(item.date)===day&&(!pattern||pattern.test(item.label)));}

test('all three reviewed sources, 34 notices and anonymous schoolwork survive integration',()=>{
 assert.equal(notice.documents.length,34);
 assert.equal(new Set(notice.documents.map(item=>item.id)).size,34);
 for(const id of ids){
  const source=notice.documents.find(item=>item.id===id);
  assert.ok(source,id);assert.equal(source.review.piiReviewed,true);
  assert.match(source.provenance.sourceContentHash,/^[a-f0-9]{64}$/);
  assert.equal(source.provenance.factsHash,createHash('sha256').update(JSON.stringify(source.facts)).digest('hex'));
 }
 assert.equal(validateUploadedNoticePolicy(notice).documents,34);
 assert.equal(validateUploadedNoticeIntegration(data,notice).documents,34);
 assert.equal(data.pack.uploadedNoticeHash,noticeHash(notice));
 assert.equal(schoolwork.lessons.length,48);
 assert.ok(schoolwork.lessons.filter(lesson=>lesson.id.startsWith('abvm-20261112-')).every(lesson=>lesson.studiedOn==null));
});

test('source ledger preserves original calendar history and newest precise school times',()=>{
 const nov=notice.documents.find(doc=>doc.id==='nov-2026-school-calendar-parent-photo');
 assert.ok(nov?.review?.piiReviewed);
 assert.equal(notice.importantDates.filter(item=>item.sourceDocument===nov.id).length,27);
 assert.equal(calendar('nov-17',/Nut roll delivery — pickup 3–4:30 PM/).length,1);
 assert.equal(calendar('nov-13',/HSA play showtime.*7 PM/).length,1);
 assert.equal(calendar('nov-14',/HSA play showtime.*5 PM/).length,1);
 for(const day of ['dec-3','dec-9'])assert.equal(calendar(day,/Christmas Card Club.*3:00.*3:45 PM/).length,1);
 assert.equal(calendar('dec-18',/Melody & Message of Cheer.*5:30.*7:00 PM/).length,1);
 assert.ok(calendar('dec-3',/HSA meeting.*7 PM/).length===1,'the evening meeting is separate');
});

test('mobile calendar resolves generic school reminders into one specific session',()=>{
 for(const [day,target] of [
  ['nov-17',/Nut roll delivery — pickup 3–4:30 PM/],
  ['dec-3',/Christmas Card Club — 3:00–3:45 PM/],
  ['dec-9',/Christmas Card Club — 3:00–3:45 PM/],
  ['dec-18',/Melody & Message of Cheer — nursing-home caroling 5:30–7:00 PM/],
 ]){
  const items=calendar(day,/nut roll|card|caroling|melody|HSA meeting/i);
  const visible=uniqueEvents(items);
  assert.equal(visible.filter(item=>target.test(item.label)).length,1,day);
  assert.equal(visible.filter(item=>/details to come|^Christmas card making$|Nut roll delivery$/.test(item.label)).length,0,day);
  assert.equal(visible.length,day==='dec-3'?2:1,day+' should retain distinct HSA meeting');
 }
 const date=day=>new Date(2026,10,day,12);
 const raw=data.pack.importantDates.filter(item=>/^(?:Drama Club Play|The Little Mermaid Jr\. drama club play)|^HSA play showtime/.test(item.label));
 const rows=raw.map(item=>{const days=item.date.includes('Nov. 13–14')?[13,14]:[item.date.includes('Nov. 13')?13:14,item.date.includes('Nov. 13')?13:14];return{item,range:[date(days[0]),date(days[1])]};});
 const shown=uniqueRows(rows).map(row=>row.item.label);
 assert.deepEqual(Array.from(shown),['HSA play showtime — The Little Mermaid Jr. at ABVM, 7 PM','HSA play showtime — The Little Mermaid Jr. at ABVM, 5 PM']);
});

test('a source-verified flyer resolves obsolete TBD wording without changing governed originals',()=>{
 assert.ok(!data.pack.parentNotices.some(value=>/Christmas Caroling date is TBD|HSA plans Christmas card making Dec\. 3 and 9;.*Details and participation information are still to come/i.test(value)));
 assert.ok(!data.pack.reminders.some(value=>/Christmas Caroling date is still TBD/i.test(value)));
 const copy=structuredClone(data);
 const again=integrateUploadedNotices(copy,structuredClone(notice),{now:new Date('2026-11-15T23:09:03.109Z')});
 assert.equal(again.changed,false);
 // A newly checked teacher Home page may add the older generic pickup label.
  // The verified parent planner overrides only that specific obsolete duplicate.
  const expected=structuredClone(data);
  expected.pack.importantDates=expected.pack.importantDates.filter(item=>!(
    item.source==='teacher-home'&&item.date==='Tuesday, Nov. 17'&&
    /^Nut Roll pick up$/i.test(item.label)
  ));
  assert.deepEqual(again.data,expected);
  const repeat=integrateUploadedNotices(structuredClone(expected),structuredClone(notice),{now:new Date('2026-11-15T23:09:03.109Z')});
  assert.equal(repeat.changed,false);
  assert.deepEqual(repeat.data,expected);
});

test('a fresh teacher Home recheck cannot restore superseded unspecified Nut Roll pickup',()=>{
 const refreshed=structuredClone(data);
 refreshed.pack.importantDates.push({
  date:'Tuesday, Nov. 17',label:'Nut Roll pick up',kind:'school event',source:'teacher-home'
 });
 const corrected=integrateUploadedNotices(refreshed,structuredClone(notice),{now:new Date('2026-11-15T23:09:03.109Z')});
 assert.equal(corrected.changed,false,'no forged new notice source timestamp');
 const expected=structuredClone(data);
 expected.pack.importantDates=expected.pack.importantDates.filter(item=>!(
   item.source==='teacher-home'&&item.date==='Tuesday, Nov. 17'&&/^Nut Roll pick up$/i.test(item.label)
 ));
 assert.deepEqual(corrected.data,expected,'only the superseded teacher label may be removed');
 assert.equal(corrected.data.pack.importantDates.filter(item=>dateKey(item.date)==='nov-17'&&/nut roll delivery.*3–4:30 PM/i.test(item.label)).length,1);
});
