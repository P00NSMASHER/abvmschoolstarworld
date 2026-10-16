import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../pages/product-view.js',import.meta.url),'utf8');
const window={};vm.runInNewContext(source,{window,Intl,Date});
const view=window.ABVMProductView,kind=item=>item.kind;
const row=(day,label,kind='test')=>({date:new Date(2026,9,day,12),item:{label,kind}});
const rows=[row(15,'Math'),row(16,'Spelling'),row(16,'Religion'),row(19,'Reading')];
test('next assessment includes every test on the earliest eligible day',()=>{
 const result=view.nextAssessments(rows,kind,new Date('2026-10-15T15:00:00-04:00'));
 assert.equal(result.d.getDate(),16);
 assert.deepEqual(Array.from(result.items,x=>x.label),['Spelling','Religion']);
 assert.equal(rows[0].item.label,'Math');
});
test('3pm school cutoff is exact and remains Eastern on other device timezones',()=>{
 for(const now of ['2026-10-15T14:59:59-04:00','2026-10-15T18:59:59Z'])assert.equal(view.nextAssessments(rows,kind,new Date(now)).d.getDate(),15);
 for(const now of ['2026-10-15T15:00:00-04:00','2026-10-15T23:59:59-04:00'])assert.equal(view.nextAssessments(rows,kind,new Date(now)).d.getDate(),16);
 assert.equal(view.assessmentWindow(new Date('2026-11-02T19:59:59Z')).afterSchool,false);
 assert.equal(view.assessmentWindow(new Date('2026-11-02T20:00:00Z')).afterSchool,true);
 assert.equal(view.assessmentWindow(new Date('2027-03-15T19:00:00Z')).afterSchool,true);
});
test('Friday advances to the next listed assessment, skipping dates without tests',()=>{
 assert.equal(view.nextAssessments(rows,kind,new Date('2026-10-16T15:00:00-04:00')).d.getDate(),19);
 assert.equal(view.assessmentWindow(new Date('2026-10-17T16:00:00-04:00')).afterSchool,false);
 assert.equal(view.nextAssessments([],kind),null);
 const due=row(19,'Return folder','due');assert.equal(view.nextAssessments([due],kind,new Date('2026-10-16T16:00:00-04:00')).x,due.item);
});
test('school-clock watcher refreshes once per boundary and on resume without a source request',()=>{
 let now=Date.parse('2026-10-15T14:59:59-04:00'),timer,refreshes=0;
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
 const listeners={},win={addEventListener:(name,fn)=>listeners[name]=fn};
 vm.runInNewContext(source,{window:win,Intl,Date:Clock,document:{visibilityState:'visible',addEventListener:(name,fn)=>listeners[name]=fn},setTimeout:fn=>timer=fn});
 win.ABVMProductView.watchSchoolClock(()=>refreshes++);
 timer();assert.equal(refreshes,0);now+=1000;timer();assert.equal(refreshes,1);
 listeners.pageshow();assert.equal(refreshes,1);
 now=Date.parse('2026-10-16T08:00:00-04:00');listeners.visibilitychange();assert.equal(refreshes,2);
});

test('dismissal refresh retries deferred or failed paints and catches up when a guide closes',()=>{
 let now=Date.parse('2026-10-15T14:59:59-04:00'),timer,calls=0,mode='defer';
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
 const listeners={},win={addEventListener:(name,fn)=>listeners[name]=fn};
 vm.runInNewContext(source,{window:win,Intl,Date:Clock,document:{visibilityState:'visible',addEventListener:(name,fn)=>listeners[name]=fn},setTimeout:fn=>timer=fn});
 win.ABVMProductView.watchSchoolClock(()=>{calls++;if(mode==='defer')return false;if(mode==='fail')throw Error('temporary paint failure')});
 now+=1000;timer();assert.equal(calls,1);
 mode='fail';timer();assert.equal(calls,2);assert.equal(typeof timer,'function');
 mode='ready';listeners.close();assert.equal(calls,3);
 listeners.pageshow();assert.equal(calls,3);
});
