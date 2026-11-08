import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudyMaterials} from '../pages/study-materials.mjs';

const today='2026-11-08T22:29:00Z';
const checkedAt='2026-11-08T22:12:56Z';
const sourceHash='teacher-pages-november-reading-fixture';
const readingUrl='https://sites.google.com/view/abvmgr2/reading-work';

function question(id,skill,sourceTitle='Reading Work',extra={}) {
  return {
    id,subject:'Reading / ELA',skill,tier:'material',
    prompt:'Choose the correct answer for '+id+'.',
    choices:['Incorrect','Correct','Other'],answer:'Correct',
    explanation:'Original checked explanation.',hint:'Use the relevant skill.',
    sourceFact:'Original source-aligned skill practice.',
    sourceLineage:{
      quality:'page-exact',sourceTitle,
      sourceUrl:sourceTitle==='Reading Work'?readingUrl:'https://sites.google.com/view/abvmgr2/tests',
      sourceCaptureHash:'a'.repeat(64),sourceCheckedAt:checkedAt,
      matchedEvidence:['Reading Comprehension: main idea/details; diagrams & labels; text features'],
    },
    ...extra,
  };
}
const topics=[
  question('source-main-idea','main-idea-details'),
  question('source-diagrams','diagrams-labels'),
  question('source-vocab','vocabulary-in-context'),
];
const separateGrammar=question('grammar-nouns','singular-plural-nouns','Tests');
const events=[
  {date:'2026-11-11',label:'Reading',kind:'test'},
  {date:'2026-11-12',label:'Grammar (singular & plural nouns)',kind:'test'},
];
function create(overrides={}) {
  const {rows=topics,packChanges={},events:otherEvents=events,clock=today}=overrides;
  const pack={
    sourceHash,sourceCheckedAt:checkedAt,
    teacherPostingWeekLabel:'Week of November 2, 2026',
    subjects:[{subject:'Reading / ELA',topics:['Reading Comprehension: main idea/details; diagrams & labels; text features']}],
    contentPipeline:{
      sourceHash,questions:[...rows,separateGrammar],
      skills:[...new Set(rows.map(row=>row.skill))].map(id=>({id,subject:'Reading / ELA',label:id})),
    },
    ...packChanges,
  };
  const catalog={sourceKey:'nov11-deterministic-test',questions:[...rows,separateGrammar]};
  return createStudyMaterials({
    pack,catalog,events:otherEvents,now:()=>clock,
    storage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
    schoolwork:{lessons:[]},archive:{questions:[],notes:[],vocabulary:[]},
  });
}

test('Nov 11 generic Reading offers original current Reading Work practice, not next-day grammar',()=>{
  const model=create();
  const list=model.upcomingTests();
  assert.equal(list.tests[0].date,'2026-11-11');
  assert.deepEqual(list.supported.map(row=>row.label),
    ['Reading','Grammar (singular & plural nouns)']);
  const preview=model.testPreview(0);
  assert.equal(preview.teacherTopicOnly,true);
  assert.equal(preview.total,3);
  assert.deepEqual(preview.topics,['main-idea-details','diagrams-labels','vocabulary-in-context']);
  const round=model.testRound({index:0,upcoming:true,seed:'nov11-reading-regression'});
  assert.equal(round.strict,true);
  assert.deepEqual(new Set(round.eligibleIds),new Set(topics.map(q=>q.id)));
  assert.ok(round.questions.length>=2);
  assert.ok(round.questions.every(q=>q.sourceLineage?.sourceTitle==='Reading Work'));
  assert.ok(!round.eligibleIds.includes('grammar-nouns'));
  const guide=model.testGuide(0,{upcoming:true});
  assert.equal(guide.scopePending,false);
  assert.equal(guide.teacherTopicOnly,true);
  assert.deepEqual(new Set(guide.practice.map(row=>row.skill)),new Set(topics.map(row=>row.skill)));
  assert.match(guide.scopeNotice,/not confirmed/i);
  assert.match(guide.sourceLabel,/original supplemental practice/i);
  assert.equal(model.testPreview(1).teacherTopicOnly,false);
  assert.deepEqual(model.testRound({index:1,upcoming:true}).eligibleIds,['grammar-nouns']);
});

test('a date and subject without exact Reading Work lineage remain unavailable',()=>{
  const noLineage=topics.map(row=>({...row,sourceLineage:undefined}));
  const model=create({rows:noLineage});
  assert.equal(model.testPreview(0).total,0);
  assert.equal(model.testPreview(0).teacherTopicOnly,false);
  assert.equal(model.testGuide(0,{upcoming:true}).scopePending,true);
  assert.ok(model.upcomingTests().missing.some(row=>row.label==='Reading'));
});

test('Reading Work fallback rejects unrelated Tests page even with similar skills',()=>{
  const rows=topics.map(row=>question(row.id,row.skill,'Tests'));
  const model=create({rows});
  assert.equal(model.testPreview(0).total,0);
  assert.deepEqual(model.testRound({index:0,upcoming:true}).eligibleIds,[]);
});

test('Reading Work fallback withdraws when pack lineage is stale or source hashes disagree',()=>{
  const old=create({clock:'2026-11-16T22:29:00Z',
    otherEvents:[{date:'2026-11-20',label:'Reading'}]});
  assert.equal(old.testPreview(0).total,0);
  const mismatch=create({packChanges:{sourceHash:'another-verified-source-version'}});
  assert.equal(mismatch.testPreview(0).total,0);
  const future=create({otherEvents:[{date:'2026-11-25',label:'Reading'}]});
  assert.equal(future.testPreview(0).total,0);
});

test('a named text-set test never inherits general Reading Work topics',()=>{
  const model=create({otherEvents:[{date:'2026-11-11',label:'Reading (Unit 1 Text Set 3)'}]});
  assert.equal(model.testPreview(0).total,0);
  assert.equal(model.testGuide(0,{upcoming:true}).scopePending,false,
    'named assessments retain their existing missing-scope rules');
});

test('explicit assessment-linked questions take precedence over generic teacher-topic practice',()=>{
  const tagged=question('exact-nov11','main-idea-details','Reading Work',{
    sourceTestScopes:['Reading'],sourceTestDate:'2026-11-11',
  });
  const model=create({rows:[...topics,tagged]});
  assert.equal(model.testPreview(0).teacherTopicOnly,false);
  assert.deepEqual(model.testRound({index:0,upcoming:true}).eligibleIds,['exact-nov11']);
  assert.doesNotMatch(model.testGuide(0,{upcoming:true}).scopeNotice,/not confirmed/i);
});
