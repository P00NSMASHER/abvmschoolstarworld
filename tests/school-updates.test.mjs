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
test('baseline, persistent unread teacher updates, acknowledgement and storage denial',()=>{
 const storage=new Map(),u=api(storage),pack={subjects:[{subject:'Math',topics:['Addition']}]};
 assert.equal(u.state(pack).unread.length,0);
 pack.subjects[0].topics=['Subtraction'];
 assert.equal(u.state(pack).unread.length,1);
 assert.equal(api(storage).state(pack).unread.length,1);
 assert.equal(u.markRead(pack),true);
 assert.equal(u.state(pack).unread.length,0);
 const context={window:{},localStorage:{getItem(){throw Error('denied')},setItem(){throw Error('denied')}}};
 vm.runInNewContext(fs.readFileSync(new URL('../pages/school-updates.js',import.meta.url),'utf8'),context);
 assert.equal(context.window.ABVMSchoolUpdates.state(pack).available,false);
});
