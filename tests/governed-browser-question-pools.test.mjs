import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as browserPools from './helpers/governed-browser-questions.mjs';
const mergeGovernedQuestionPools=(...args)=>{
  assert.equal(typeof browserPools.mergeGovernedQuestionPools,'function','browser helper must merge each governed source');
  return browserPools.mergeGovernedQuestionPools(...args);
};

const schoolwork=JSON.parse(readFileSync(new URL('../pages/data/schoolwork.json',import.meta.url)));
const historicPrompt='Which word correctly completes the sentence? “The ___ carried a blue backpack.”';
const historic={
  id:'auto-high-frequency-word-use-boy-41041e',subject:'Reading / ELA',
  skill:'high-frequency-word-use',prompt:historicPrompt,choices:['boy','what','were'],answer:'boy',
  firstSeenAt:'2026-09-29T19:20:03.923Z',
  provenance:[{sourceRef:'verified-2026-classroom-source',capturedAt:'2026-10-05'}],
};
const archive={questions:[historic],sources:{'verified-2026-classroom-source':{sourceHash:'teacher-pages-approved'}}};
const observedAt='2026-10-07T16:00:00Z';

function matchingAnswers(pool,q){
  return [...new Set(pool.filter(row=>row.prompt===q.prompt&&row.choices.length===q.choices.length&&
    row.choices.every(value=>q.choices.includes(value))&&q.choices.includes(row.answer)).map(row=>row.answer))];
}

test('browser QA resolves a truly published historical question when the current teacher bank withdraws it',()=>{
  const partialPool={catalog:{questions:[]},schoolwork,star:[],archive,observedAt};
  const withoutArchive=[...schoolwork.lessons.flatMap(lesson=>lesson.questions)];
  assert.deepEqual(matchingAnswers(withoutArchive,historic),[],'new teacher bank omits the former sight word');
  const merged=mergeGovernedQuestionPools(partialPool);
  assert.deepEqual(matchingAnswers(merged,historic),['boy']);
  assert.ok(merged.some(row=>row.id===historic.id),'original archived identity must be retained');
});

test('merging official pools retains the current catalog, reviewed schoolwork, original star and archived provenance',()=>{
  const current={id:'current-a',prompt:'Current question?',answer:'Yes',choices:['Yes','No']};
  const star={id:'star-a',prompt:'Original STAR question?',answer:'5',choices:['4','5']};
  const merged=mergeGovernedQuestionPools({catalog:{questions:[current]},schoolwork,star:[star],archive,observedAt});
  assert.equal(merged[0],current);
  assert.ok(merged.includes(star));
  assert.ok(merged.some(row=>row.id===historic.id&&row.provenance===historic.provenance));
  assert.ok(merged.some(row=>schoolwork.lessons.some(lesson=>lesson.questions.includes(row))));
});

test('invalid or unsupported archived answers are never promoted as verified answers',()=>{
  const bad=[{...historic,id:'bad-option',answer:'NOT A CHOICE'},
    {...historic,id:'missing-source-provenance',provenance:[]},
    {...historic,id:'missing-id',id:''}];
  const merged=mergeGovernedQuestionPools({catalog:{questions:[]},schoolwork:{lessons:[]},archive:{...archive,questions:bad},star:[],observedAt});
  assert.deepEqual(merged,[]);
});


test('reviewed sources observed after the simulated school day cannot justify an earlier game answer',()=>{
  const futureQuestion={...historic,firstSeenAt:'2026-11-05T12:00:00.000Z'};
  const futureCapture={...historic,provenance:[{sourceRef:'verified-2026-classroom-source',capturedAt:'2026-10-09'}]};
  for(const row of [futureQuestion,futureCapture]){
    const merged=mergeGovernedQuestionPools({catalog:{questions:[]},schoolwork:{lessons:[]},star:[],
      archive:{...archive,questions:[row]},observedAt});
    assert.equal(merged.length,0,'historical item must be observed before the active Eastern school day');
  }
});

test('unmatched archive source references cannot be used as an answer authority',()=>{
  const result=mergeGovernedQuestionPools({catalog:{questions:[]},schoolwork:{lessons:[]},star:[],
    archive:{...archive,sources:{}},observedAt});
  assert.deepEqual(result,[]);
});

test('invalid browser observation date fails closed before archived answers enter the pool',()=>{
  assert.throws(()=>mergeGovernedQuestionPools({catalog:{questions:[]},schoolwork:{lessons:[]},star:[],
    archive,observedAt:'not-a-date'}),/Invalid|date|time/i);
});
