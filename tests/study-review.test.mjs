import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const DAY=86400000,T=Date.parse('2026-10-04T12:00:00-04:00');
function api(storage=new Map()){
 const ctx={window:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 for(const file of ['study-review','study-games'])vm.runInNewContext(fs.readFileSync(new URL('../pages/'+file+'.js',import.meta.url),'utf8'),ctx);
 return {review:ctx.window.ABVMStudyReview,engine:ctx.window.ABVMStudyGames,storage};
}
test('SkillCoco SM-2 golden intervals and failure reset',()=>{
 const {review:r}=api();let a=r.sm2(4);assert.equal(a.intervalDays,1);
 a=r.sm2(4,a.repetitions,a.ease,a.intervalDays);assert.equal(a.intervalDays,6);
 a=r.sm2(4,a.repetitions,a.ease,a.intervalDays);assert.equal(a.intervalDays,15);
 a=r.sm2(2,a.repetitions,a.ease,a.intervalDays);assert.equal(a.intervalDays,1);assert.equal(a.repetitions,0);
 assert.equal(r.sm2(3,2,1.3,6).ease,1.3);
});
test('only independent due reviews extend intervals; early repeats do not',()=>{
 const {review:r}=api();let row={Review:r.schedule({}, {correct:true,independent:true,now:T})};
 const first=JSON.stringify(row.Review);
 assert.equal(JSON.stringify(r.schedule(row,{correct:true,independent:true,now:T+1000})),first);
 row.Review=r.schedule(row,{correct:true,independent:true,now:T+DAY});assert.equal(row.Review.intervalDays,6);
 const later=JSON.stringify(row.Review);
 assert.equal(JSON.stringify(r.schedule(row,{correct:true,independent:true,now:T+2*DAY})),later);
 row.Review=r.schedule(row,{correct:true,independent:false,now:T+2*DAY});assert.equal(row.Review.intervalDays,1);assert.equal(row.Review.repetitions,0);
});
test('incorrect and hinted resolutions reset, repeated success cannot undo same-day reset',()=>{
 const {review:r}=api();let row={Review:r.schedule({}, {correct:false,now:T})};
 const a=JSON.stringify(row.Review);assert.equal(JSON.stringify(r.schedule(row,{correct:true,independent:true,now:T+1000})),a);
 for(const independent of [false])assert.equal(r.schedule(row,{correct:true,independent,now:T+DAY}).repetitions,0);
});
test('long-running practice intervals are capped at 30 days',()=>{
 const {review:r}=api();let row={},now=T;
 for(let i=0;i<30;i++){row.Review=r.schedule(row,{correct:true,independent:true,now});now=row.Review.dueAt;assert.ok(row.Review.intervalDays<=30);}
 assert.equal(row.Review.intervalDays,30);
});
test('corrupt or future schedules recover safely; legacy evidence becomes reviewable',()=>{
 const {review:r}=api();for(const Review of [null,[],{version:1,dueAt:Infinity},{version:1,reviewedAt:T+10*DAY,dueAt:T+11*DAY}])assert.equal(r.schedule({Review},{correct:true,independent:true,now:T}).intervalDays,1);
 assert.equal(r.isDue({LastSeenAt:T-DAY},T),true);assert.equal(r.isDue({LastSeenAt:T+DAY},T),false);assert.equal(r.isDue({},T),false);
 assert.throws(()=>r.schedule({},{now:NaN}));
});
test('review boundaries use the school date across UTC midnight and DST',()=>{
 const {review:r}=api();const now=Date.parse('2026-10-04T23:30:00-04:00');const row={Review:r.schedule({}, {now,correct:true,independent:true})};
 assert.equal(r.isDue(row,Date.parse('2026-10-05T03:59:00Z')),false);
 assert.equal(r.isDue(row,Date.parse('2026-10-05T04:00:00Z')),true);
 const dst=Date.parse('2026-11-01T00:30:00-04:00'),d={Review:r.schedule({}, {now:dst,correct:true,independent:true})};
 assert.equal(r.isDue(d,Date.parse('2026-11-01T23:00:00-05:00')),false);
 assert.equal(r.isDue(d,Date.parse('2026-11-02T00:00:00-05:00')),true);
});
test('daily selection reviews playable due skills and preserves original/current provenance',()=>{
 const {review:r,engine:e}=api(),pack=JSON.parse(fs.readFileSync(new URL('../pages/data/study-pack.json',import.meta.url))).pack;
 const c=e.buildCatalog(pack,{sourceKey:'daily-test'}),learning={'place-value':{LastSeenAt:T-2*DAY},inference:{LastSeenAt:T-3*DAY},'retired-unknown':{LastSeenAt:T-10*DAY}};
 const due=r.dueSkills(pack,learning,T);assert.equal(due.some(s=>s.id==='retired-unknown'),false);
 const selected=e.selectDailyQuestions(c,{pack,skillStats:learning,now:T});assert.equal(selected.length,8);assert.equal(new Set(selected.map(q=>q.id)).size,8);
 for(const skill of ['place-value','inference'])assert.ok(selected.slice(0,3).some(q=>q.skill===skill));
 assert.ok(selected.some(q=>q.tier==='material'));
 assert.ok(selected.every(q=>c.questions.some(p=>p.id===q.id)));
});
test('learning records schedule normal resolutions without changing support evidence',()=>{
 const {review:r,engine:e}=api();const q={skill:'place-value',id:'test',subject:'Math'};
 const row=e.recordLearning(q,true,{hintCount:1});assert.equal(row.Review.intervalDays,1);assert.equal(row.Review.repetitions,0);
 const scheduled=JSON.stringify(row.Review);assert.equal(JSON.stringify(e.recordSupport(q,true).Review),scheduled);
 assert.equal(JSON.stringify(e.recordComeback(q,true).Review),scheduled);
});
test('daily completion is local, school-day scoped, and tolerates storage denial',()=>{
 const {review:r,storage}=api();assert.equal(r.complete(T),true);assert.ok(r.completion(T+1000));assert.equal(r.completion(T+DAY),null);
 storage.set('abvm-daily-practice:v1','broken');assert.equal(r.completion(T),null);
 const bad={get(){throw Error('blocked')},set(){throw Error('blocked')}};const denied=api(bad).review;assert.equal(denied.complete(T),false);assert.equal(denied.completion(T),null);
});
