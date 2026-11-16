import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function api(storage=new Map()){
 const context={window:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 vm.runInNewContext(fs.readFileSync(new URL('../pages/school-updates.js',import.meta.url),'utf8'),context);
 return context.window.ABVMSchoolUpdates;
}
test('duplicate labels merge but different event details are retained',()=>{
 const u=api();
 const events=u.uniqueEvents([{label:'No School'},{label:'No School — Columbus Day'},{label:'No School'},{label:'Conference portal closes'},{label:'Mass — 9 AM'},{label:'Mass — 6 PM'}]);
 assert.equal(events.length,4);
 assert.equal(events[0].label,'No School — Columbus Day');
 assert.equal(u.uniqueEvents([{label:'Chick-fil-A pickup'},{label:'Chick-Fil-A pick up'}]).length,1);
});
test('same-day Nut Roll pickup variants collapse without removing an order deadline',()=>{
 const u=api();
 const events=u.uniqueEvents([
  {label:'Nut roll delivery'},
  {label:'Nut Roll pick up'},
  {label:'Nut roll delivery — pickup 3–4:30 PM'},
  {label:'Nut Roll orders due'},
 ]);
 assert.equal(events.length,2);
 assert.equal(events[0].label,'Nut roll delivery — pickup 3–4:30 PM');
 assert.equal(events[1].label,'Nut Roll orders due');
});
test('same event on two separate dates remains two events',()=>{
 const u=api(),make=d=>({item:{label:'Mass'},range:[new Date(d),new Date(d)]});
 assert.equal(u.uniqueRows([make('2026-10-07'),make('2026-10-07'),make('2026-10-14')]).length,2);
});
test('school updates never read or write browser acknowledgement state',()=>{
 const context={window:{},localStorage:{getItem(){throw Error('unexpected read')},setItem(){throw Error('unexpected write')}}};
 vm.runInNewContext(fs.readFileSync(new URL('../pages/school-updates.js',import.meta.url),'utf8'),context);
 const u=context.window.ABVMSchoolUpdates;
 assert.equal(u.state,undefined);
 assert.equal(u.markRead,undefined);
 assert.equal(u.banner,undefined);
 assert.equal(u.card,undefined);
 assert.match(u.noticesCard(['Bring the permission form.']),/Bring the permission form/);
});
test('notice disclosure keeps complete exact source and safely escapes literal previews',()=>{
 const u=api();
 const source='Friday, Oct. 9: '+('Bring the permission form and read the school instructions. ').repeat(8)+'<script>alert(1)</script>';
 const html=u.noticesCard([source]);
 assert.match(html,/<details class="family-message"><summary>/);
 assert.ok(html.includes('<div class="family-message-body">'+source.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>'));
 assert.ok(!html.includes('<script>'));
 assert.ok(!html.includes('status ok'));
 const summary=html.match(/<strong>(.*?)<\/strong>/)[1];
 assert.ok(summary.length<=113);
 assert.ok(summary.endsWith('…'));
});
function changes(feed){
 const context={window:{}};
 vm.runInNewContext(fs.readFileSync(new URL('../pages/weekly-learning.js',import.meta.url),'utf8'),context);
 return context.window.ABVMWeeklyLearning.renderChanges(feed);
}
test('change feed dates are source check times, not invented publication dates',()=>{
 const feed={generatedAt:'2026-10-01T14:00:00.000Z',items:[{kind:'new-skill',subject:'Math',text:'New: Math — Subtraction'},{kind:'unchanged',subject:'Religion',text:'No changes to Religion.'}]};
 const html=changes(feed);
 assert.match(html,/Checked <time datetime="2026-10-01T14:00:00.000Z">Oct 1, 2026, 10:00 AM EDT/);
 assert.match(html,/Changes found at this check/);
 assert.match(html,/New: Math — Subtraction/);
 assert.match(html,/Still current/);
 assert.match(html,/No changes to Religion/);
 assert.doesNotMatch(html,/marked as read|unread|Published|Updated at/);
});
test('unchanged check has its own honest dated state and preserves source rows',()=>{
 const html=changes({generatedAt:'2026-10-07T19:32:52.274Z',items:[{kind:'unchanged',subject:'Math',text:'No changes to Math.'}]});
 assert.match(html,/No lesson changes found at this check/);
 assert.match(html,/Oct 7, 2026, 3:32 PM EDT/);
 assert.match(html,/No changes to Math/);
 assert.equal(changes(), '');
});
test('missing or invalid check date stays unavailable and no feed row is discarded',()=>{
 const items=Array.from({length:12},(_,i)=>({kind:'new-skill',subject:'Math',text:'Verified item '+i}));
 const html=changes({generatedAt:'not-a-date',items});
 assert.match(html,/Check date unavailable/);
 assert.doesNotMatch(html,/<time/);
 for(const row of items)assert.ok(html.includes(row.text));
});

test('official calendar source is directly accessible without claiming Facebook or teacher provenance',()=>{
 const html=api().officialCalendarLink();
 assert.match(html,/Official ABVM calendar/);
 assert.match(html,/https:\/\/www\.assumptionbvmschool\.net\/about\/calendar/);
 assert.match(html,/rel="noopener noreferrer"/);
 assert.match(html,/target="_blank"/);
 assert.doesNotMatch(html,/facebook\.com|teacher-verified|published post/i);
});

test('cumulative planner and flyer notices keep precise session times without duplicate school events',()=>{
 const u=api();
 const card=u.uniqueEvents([
  {label:'HSA Christmas card making — details to come'},
  {label:'Christmas card making'},
  {label:'Christmas Card Club — 3:00–3:45 PM; pickup 3:45 PM'},
  {label:'HSA meeting — 7 PM (virtual; link in school Classroom)'},
 ]);
 assert.equal(card.length,2);
 assert.ok(card.some(x=>x.label==='Christmas Card Club — 3:00–3:45 PM; pickup 3:45 PM'));
 assert.ok(card.some(x=>x.label.startsWith('HSA meeting')));
 const carols=u.uniqueEvents([
  {label:'HSA Christmas caroling — details to come'},
  {label:'A Melody & Message of Cheer — nursing-home caroling 5:30–7:00 PM; stops to be announced'},
 ]);
 assert.equal(carols.length,1);
 assert.match(carols[0].label,/5:30–7:00 PM/);
 const nutRoll=u.uniqueEvents([
  {label:'HSA Nut Roll Sale — pickup (time assigned by school)'},
  {label:'Nut roll delivery'},
  {label:'Nut roll delivery — pickup 3–4:30 PM'},
  {label:'Nut Roll orders due'},
 ]);
 assert.equal(nutRoll.length,2);
 assert.equal(nutRoll[0].label,'Nut roll delivery — pickup 3–4:30 PM');
 assert.equal(nutRoll[1].label,'Nut Roll orders due');
 const make=(date,label)=>({range:[new Date(date),new Date(date)],item:{label}});
 assert.equal(u.uniqueRows([
  make('2026-12-03','Christmas card making'),
  make('2026-12-03','Christmas Card Club — 3:00–3:45 PM; pickup 3:45 PM'),
  make('2026-12-09','Christmas Card Club — 3:00–3:45 PM; pickup 3:45 PM'),
 ]).length,2,'dates must never collapse together');
});
