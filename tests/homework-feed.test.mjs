import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const context={window:{},Intl,Date};
vm.runInNewContext(readFileSync(new URL('../pages/homework-feed.js',import.meta.url),'utf8'),context);
const model=context.window.ABVMHomeworkFeed;
const source=JSON.parse(readFileSync(new URL('../pages/data/homework-current.json',import.meta.url),'utf8'));
const sameDay={...source,checkedAt:'2026-10-13T23:00:00.000Z',firstObservedAt:'2026-10-13T23:00:00.000Z'};
test('current verified posting lists only actionable assignments on its school date',()=>{
  const now=new Date('2026-10-13T21:00:00-04:00');
  const view=model.forDate(sameDay,'2026-10-13',now);
  assert.equal(view.state,'assignments');
  assert.deepEqual([...view.assignments].map(item=>item.subject),['Math','Spelling']);
  assert.equal(view.assignments[0].task,'Page 22');
  assert.equal(view.assignments[1].task,'Spelling Choice Board activity');
});
test('undated posting never leaks onto tomorrow or historical days',()=>{
  const recheckedNextDay={...sameDay,checkedAt:'2026-10-14T12:00:00-04:00'};
  const view=model.forDate(recheckedNextDay,'2026-10-14',new Date('2026-10-14T13:00:00-04:00'));
  assert.equal(view.state,'outdated');
  assert.equal(view.firstObservedAt,sameDay.firstObservedAt);
  assert.deepEqual([...view.assignments],[]);
  assert.equal(model.forDate(sameDay,'2026-10-12',new Date('2026-10-13T21:00:00-04:00')).state,'other-day');
});
test('unavailable, invalid, and future-dated homework fail closed',()=>{
  const now=new Date('2026-10-13T21:00:00-04:00');
  assert.equal(model.forDate(null,'2026-10-13',now).state,'unverified');
  assert.equal(model.forDate({...sameDay,checkedAt:'not a date'},'2026-10-13',now).state,'unverified');
  assert.equal(model.forDate({...sameDay,checkedAt:'2026-10-13T22:00:00-04:00'},'2026-10-13',now).state,'outdated');
});
test('standing chores cannot be published as actionable homework',()=>{
  for(const row of [{subject:'Reading',task:'Read'},{subject:'Parent',task:'Cover books'},
    {subject:'Reading',task:'Reading log & Behavior chart'},
    {subject:'Homework Folder',task:'Return everything in the HW folder'}]){
    assert.throws(()=>model.validate({...source,assignments:[row]}),/Invalid/);
  }
});
