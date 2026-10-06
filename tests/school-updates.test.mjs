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
test('same event on two separate dates remains two events',()=>{
 const u=api(),make=d=>({item:{label:'Mass'},range:[new Date(d),new Date(d)]});
 assert.equal(u.uniqueRows([make('2026-10-07'),make('2026-10-07'),make('2026-10-14')]).length,2);
});
test('Family unread tracking is communication-only and persists notice acknowledgement',()=>{
 const storage=new Map(),u=api(storage),pack={subjects:[{subject:'Math',topics:['Addition']}],homework:[{subject:'Math',task:'Worksheet'}],parentNotices:[]};
 assert.equal(u.state(pack).unread.length,0);
 pack.subjects[0].topics=['Subtraction'];
 pack.homework[0].task='New worksheet';
 assert.equal(u.state(pack).unread.length,0);
 pack.parentNotices.push('Picture forms are due Friday.');
 assert.equal(u.state(pack).unread.length,1);
 assert.equal(api(storage).state(pack).unread.length,1);
 assert.equal(u.markRead(pack),true);
 assert.equal(u.state(pack).unread.length,0);
 const context={window:{},localStorage:{getItem(){throw Error('denied')},setItem(){throw Error('denied')}}};
 vm.runInNewContext(fs.readFileSync(new URL('../pages/school-updates.js',import.meta.url),'utf8'),context);
 assert.equal(context.window.ABVMSchoolUpdates.state(pack).available,false);
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
test('unread status stays compact while the notice list progressively discloses detail',()=>{
 const u=api(),pack={parentNotices:[]};
 u.state(pack);
 pack.parentNotices=Array.from({length:7},(_,i)=>'School notice '+i);
 const status=u.card(pack),notices=u.noticesCard(pack.parentNotices);
 assert.match(status,/7 new school notices/);
 assert.equal((status.match(/class="family-message"/g)||[]).length,0);
 assert.match(notices,/See 4 more notices/);
 assert.equal((notices.match(/class="family-message"/g)||[]).length,7);
 assert.equal((notices.split('class="family-notices-overflow"')[0].match(/class="family-message"/g)||[]).length,3);
 assert.equal(u.state(pack).unread.length,7);
 u.markRead(pack);
 assert.equal(u.state(pack).unread.length,0);
});
