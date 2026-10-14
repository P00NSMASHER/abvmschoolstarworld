import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const context={window:{},Intl,Date};
vm.runInNewContext(readFileSync(new URL('../pages/homework-feed.js',import.meta.url),'utf8'),context);
const model=context.window.ABVMHomeworkFeed;
const currentSource=JSON.parse(readFileSync(new URL('../pages/data/homework-current.json',import.meta.url),'utf8'));
const verifiedPosting={
  ...currentSource,
  checkedAt:'2026-10-14T00:32:53.326Z',
  firstObservedAt:'2026-10-14T00:32:53.326Z'
};
test('current verified posting lists only actionable assignments on its school date',()=>{
  const now=new Date('2026-10-14T01:00:00Z');
  const view=model.forDate(verifiedPosting,'2026-10-13',now);
  assert.equal(view.state,'assignments');
  assert.deepEqual([...view.assignments].map(item=>item.subject),['Math','Spelling']);
  assert.equal(view.assignments[0].task,'Page 22');
  assert.equal(view.assignments[1].task,'Spelling Choice Board activity');
});
test('undated posting never leaks onto tomorrow or historical days',()=>{
  assert.equal(model.forDate(verifiedPosting,'2026-10-14',new Date('2026-10-14T12:00:00Z')).state,'outdated');
  assert.equal(model.forDate(verifiedPosting,'2026-10-12',new Date('2026-10-14T01:00:00Z')).state,'other-day');
});
test('unavailable, invalid, and future-dated homework fail closed',()=>{
  assert.equal(model.forDate(null,'2026-10-13',new Date('2026-10-14T01:00:00Z')).state,'unverified');
  assert.equal(model.forDate({...verifiedPosting,checkedAt:'not a date'},'2026-10-13',new Date('2026-10-14T01:00:00Z')).state,'unverified');
  assert.equal(model.forDate({...verifiedPosting,checkedAt:'2026-10-14T04:00:00Z'},'2026-10-13',new Date('2026-10-14T01:00:00Z')).state,'outdated');
});
test('standing chores cannot be published as actionable homework',()=>{
  for(const row of [{subject:'Reading',task:'Read'},{subject:'Parent',task:'Cover books'},
    {subject:'Reading',task:'Reading log & Behavior chart'},
    {subject:'Homework Folder',task:'Return everything in the HW folder'}]){
    assert.throws(()=>model.validate({...verifiedPosting,assignments:[row]}),/Invalid/);
  }
});
