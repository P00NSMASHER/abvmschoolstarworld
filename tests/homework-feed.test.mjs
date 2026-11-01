import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {HISTORICAL_HOMEWORK_POSTING} from './homework-e2e-fixture.mjs';

const context={window:{},Intl,Date};
vm.runInNewContext(readFileSync(new URL('../pages/homework-feed.js',import.meta.url),'utf8'),context);
const model=context.window.ABVMHomeworkFeed;
const verifiedPosting=HISTORICAL_HOMEWORK_POSTING;
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

test('unchanged Tuesday posting rechecked Wednesday is not newly assigned on Wednesday',()=>{
  const rechecked={...verifiedPosting,checkedAt:'2026-10-14T12:00:00-04:00'};
  const actual=model.forDate(rechecked,'2026-10-14',new Date('2026-10-14T13:00:00-04:00'));
  assert.equal(actual.state,'outdated');
  assert.equal(actual.reason,'undated-carryover');
  assert.equal(actual.firstObservedAt,verifiedPosting.firstObservedAt);
  assert.deepEqual([...actual.assignments],[]);
});
test('newly observed Wednesday assignments remain available with Math and Spelling intact',()=>{
  const fresh={...verifiedPosting,checkedAt:'2026-10-14T12:00:00-04:00',
    firstObservedAt:'2026-10-14T09:00:00-04:00',contentHash:'b'.repeat(64)};
  const actual=model.forDate(fresh,'2026-10-14',new Date('2026-10-14T13:00:00-04:00'));
  assert.equal(actual.state,'assignments');
  assert.deepEqual([...actual.assignments].map(item=>item.subject),['Math','Spelling']);
  assert.deepEqual([...actual.assignments].map(item=>item.task),['Page 22','Spelling Choice Board activity']);
});
test('Eastern school date, not UTC calendar date, determines whether homework is current',()=>{
  const evening={...verifiedPosting,checkedAt:'2026-10-14T00:05:00.000Z',
    firstObservedAt:'2026-10-14T00:05:00.000Z',
    contentChangedAt:'2026-10-14T00:05:00.000Z'};
  assert.equal(model.forDate(evening,'2026-10-13',new Date('2026-10-14T00:30:00.000Z')).state,'assignments');
  const nextMorning={...evening,checkedAt:'2026-10-14T13:30:00.000Z'};
  const view=model.forDate(nextMorning,'2026-10-14',new Date('2026-10-14T14:00:00.000Z'));
  assert.equal(view.state,'outdated');
  assert.deepEqual([...view.assignments],[]);
});

test('a fresh Spelling-only posting does not invent yesterday’s Math assignment',()=>{
  const posting={...verifiedPosting,
    checkedAt:'2026-10-14T20:14:38.266Z',firstObservedAt:'2026-10-14T20:14:38.266Z',
    contentHash:'e700a368c203e18400393285b677038ea55cd9f4daf668565491f7264f97f6fe',
    assignments:[{subject:'Spelling',task:'Spelling Choice Board activity'}]};
  const view=model.forDate(posting,'2026-10-14',new Date('2026-10-14T17:00:00-04:00'));
  assert.equal(view.state,'assignments');
  assert.deepEqual([...view.assignments].map(row=>row.subject),['Spelling']);
  assert.deepEqual([...view.assignments].map(row=>row.task),['Spelling Choice Board activity']);
});
test('published teacher feed stays schema-validated without requiring a fixed Math task',()=>{
  const current=JSON.parse(readFileSync(new URL('../pages/data/homework-current.json',import.meta.url),'utf8'));
  assert.doesNotThrow(()=>model.validate(current));
});
test('observations or content changes occurring after their source checks fail closed',()=>{
  assert.throws(()=>model.validate({...verifiedPosting,
    firstObservedAt:'2026-10-14T01:00:00.000Z',
    checkedAt:'2026-10-14T00:32:53.326Z'}),/Invalid/);
  assert.throws(()=>model.validate({...verifiedPosting,
    contentChangedAt:'2026-10-14T01:00:00.000Z',
    checkedAt:'2026-10-14T00:32:53.326Z'}),/Invalid/);
});

test('an unchanged recheck updates provenance without altering the displayed homework state',()=>{
 const original={...verifiedPosting,checkedAt:'2026-10-14T00:32:53.326Z'};
 const recheck={...original,checkedAt:'2026-10-14T00:45:00.000Z'};
 const now=new Date('2026-10-14T01:00:00Z'),day='2026-10-13';
 assert.equal(model.viewSignature(original,day,now),model.viewSignature(recheck,day,now));
 const updated={...recheck,contentHash:'a'.repeat(64),assignments:[...recheck.assignments,{subject:'Math',task:'Page 23'}]};
 assert.notEqual(model.viewSignature(updated,day,now),model.viewSignature(recheck,day,now));
});

test('freshly checked no-specific posting is current even when unchanged since yesterday',()=>{
  const page={...verifiedPosting,status:'no-specific-posting',assignments:[],
    firstObservedAt:'2026-10-16T14:55:31.600Z',contentChangedAt:'2026-10-16T14:55:31.600Z',
    checkedAt:'2026-10-17T08:23:00.000Z',contentHash:'c'.repeat(64)};
  const actual=model.forDate(page,'2026-10-17',new Date('2026-10-17T08:30:00.000Z'));
  assert.equal(actual.state,'no-specific-posting');
  assert.deepEqual([...actual.assignments],[]);
  assert.equal(actual.checkedAt,page.checkedAt);
  assert.equal(actual.firstObservedAt,page.firstObservedAt,'rechecking must preserve first observation provenance');
  assert.notEqual(model.forDate(page,'2026-10-16',new Date('2026-10-17T08:30:00.000Z')).state,'no-specific-posting');
});
test('freshly checked explicit no-homework status reports page state without inventing tasks',()=>{
  const page={...verifiedPosting,status:'no-homework',assignments:[],
    firstObservedAt:'2026-10-16T14:55:31.600Z',contentChangedAt:'2026-10-16T14:55:31.600Z',
    checkedAt:'2026-10-17T08:23:00.000Z',contentHash:'d'.repeat(64)};
  const actual=model.forDate(page,'2026-10-17',new Date('2026-10-17T08:30:00.000Z'));
  assert.equal(actual.state,'no-homework');
  assert.deepEqual([...actual.assignments],[]);
});
test('empty homework status still fails closed on stale and future checks',()=>{
  const page={...verifiedPosting,status:'no-specific-posting',assignments:[],
    firstObservedAt:'2026-10-16T14:55:31.600Z',contentChangedAt:'2026-10-16T14:55:31.600Z',
    checkedAt:'2026-10-17T08:23:00.000Z',contentHash:'c'.repeat(64)};
  const now=new Date('2026-10-17T12:00:00.000Z');
  assert.equal(model.forDate({...page,checkedAt:'2026-10-16T20:23:00.000Z'},'2026-10-17',now).state,'outdated');
  assert.equal(model.forDate({...page,checkedAt:'2026-10-17T12:10:00.000Z'},'2026-10-17',now).state,'outdated');
  assert.equal(model.forDate({...page,checkedAt:'2026-10-17T11:50:00.000Z'},'2026-10-17',now).state,'no-specific-posting');
});

test('outdated Homework distinguishes a stale check from a checked undated carryover',()=>{
  const now=new Date('2026-10-14T13:00:00-04:00');
  const stale=model.forDate({...verifiedPosting,checkedAt:'2026-10-13T12:00:00-04:00',
    firstObservedAt:'2026-10-13T10:00:00-04:00',contentChangedAt:'2026-10-13T10:00:00-04:00'},'2026-10-14',now);
  const checked=model.forDate({...verifiedPosting,checkedAt:'2026-10-14T12:00:00-04:00'},'2026-10-14',now);
  assert.equal(stale.reason,'verification-stale');
  assert.equal(checked.reason,'undated-carryover');
});


test('homework timestamps require explicit offsets and real civil days',()=>{
  const base={...verifiedPosting,status:'no-homework',assignments:[],
    firstObservedAt:'2026-02-27T11:00:00.000Z',
    contentChangedAt:'2026-02-27T11:00:00.000Z',
    checkedAt:'2026-02-28T12:00:00.000Z'};
  assert.doesNotThrow(()=>model.validate(base));
  const malformed=[
    '2026-02-30T12:00:00Z', // Date.parse normalizes nonexistent February 30.
    '2026-02-28T12:00:00',  // Missing offset depends on the viewer's timezone.
    '2026-02-28',
    '2026-02-28T24:00:00Z',
    '2026-02-28T12:00:60Z',
    '2026-02-28T12:00:00+15:00',
    '2026-02-28T12:00:00+14:30',
  ];
  for(const field of ['checkedAt','firstObservedAt','contentChangedAt']){
    for(const timestamp of malformed)
      assert.throws(()=>model.validate({...base,[field]:timestamp}),/Invalid verified Homework feed/,
        field+' accepted '+timestamp);
  }
  assert.equal(model.forDate({...base,checkedAt:'2026-02-28T12:00:00'},
    '2026-02-28',new Date('2026-02-28T13:00:00Z')).state,'unverified');
  assert.doesNotThrow(()=>model.validate({...base,checkedAt:'2026-02-28T12:00:00+05:30'}));
  assert.doesNotThrow(()=>model.validate({...base,
    firstObservedAt:'2028-02-28T11:00:00Z',contentChangedAt:'2028-02-28T11:00:00Z',
    checkedAt:'2028-02-29T12:00:00Z'}),'real leap day must remain accepted');
  assert.throws(()=>model.validate({...base,
    firstObservedAt:'2027-02-27T11:00:00Z',contentChangedAt:'2027-02-27T11:00:00Z',
    checkedAt:'2027-02-29T12:00:00Z'}),/Invalid verified Homework feed/,
    'non-leap February 29 must fail closed');
});
