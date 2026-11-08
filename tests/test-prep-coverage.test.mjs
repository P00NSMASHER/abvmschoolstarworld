import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudyMaterials} from '../pages/study-materials.mjs';
import {createMaterialsView} from '../pages/study-games-materials-view.mjs';

const now = '2026-11-08T22:00:00Z';
const events = [
  {date:'2026-11-11',label:'Reading',kind:'test'},
  {date:'2026-11-12',label:'Grammar (singular & plural nouns)',kind:'test'},
  {date:'2026-11-13',label:'Spelling (3 letter blends) / Handwriting',kind:'test'},
];
const question = (id,subject,skill,tier='material') => ({
  id,subject,skill,tier,prompt:'Original question '+id+'?',
  choices:['Correct','Wrong','Another'],answer:'Correct',explanation:'Checked lesson fact.',
  hint:'Review the lesson.',sourceFact:'Reviewed current classroom skill',
});
const reading = Array.from({length:9},(_,i)=>question('reading-'+i,'Reading / ELA','reading-long-short-o'));
const nouns = Array.from({length:8},(_,i)=>question('noun-'+i,'Reading / ELA','singular-plural-nouns'));
const blends = Array.from({length:8},(_,i)=>question('blend-'+i,'Spelling / Handwriting','three-letter-blends'));
const old = question('old-reading','Reading / ELA','unverified-older-scope');
const saved = question('saved-reading','Reading / ELA','saved-skill');
const star = question('star-reading','Reading / ELA','general-star','star-fallback');
const review = question('review-reading','Reading / ELA','recent-review','recent-review');
const catalog = {sourceKey:'school-source-revision',questions:[...reading,...nouns,...blends,star,review]};
const schoolwork = {lessons:[
  {id:'dated',subject:'Reading / ELA',weekOf:'2026-11-02',studiedOn:'2026-11-06',questions:[old]},
  {id:'undated',subject:'Reading / ELA',questions:[saved]},
]};
const modelFor = (extra={})=>createStudyMaterials({
  now:()=>now,events,catalog,schoolwork,...extra,
});
const htmlFor = model => {
  const view=createMaterialsView({win:{location:{hash:'#study?prep=1'}}});
  view.setModel(model);
  return view.priorityHtml({loading:false});
};

test('Reading test remains unscoped while noun and blend exams have eight matching questions each',()=>{
  const model=modelFor();
  const state=model.upcomingTests();
  assert.deepEqual(state.tests.map(row=>row.label),events.map(row=>row.label));
  assert.deepEqual(state.missing.map(row=>({label:row.label,count:row.count})),[
    {label:'Reading',count:0}
  ]);
  assert.deepEqual(state.supported.map(row=>row.count),[8,8]);
  assert.deepEqual(model.testRound({index:0,upcoming:true,seed:'isolated'}).questions,[]);
  assert.deepEqual(model.testGuide(0,{upcoming:true}).practice,[]);
  const html=htmlFor(model);
  assert.match(html,/Reading[^<]*<\/strong><small>[^<]*0 matching questions/s);
  assert.match(html,/Grammar[^<]*<\/strong><small>[^<]*8 matching questions/s);
  assert.match(html,/Spelling[^<]*<\/strong><small>[^<]*8 matching questions/s);
  assert.match(html,/data-test-missing/);
  assert.match(html,/data-general-reading/);
  assert.match(html,/not confirmed test questions/i);
  assert.match(html,/data-test-single="0"[^>]*disabled/);
});

test('General Reading option uses only reviewed current or correctly dated weekly source questions',()=>{
  const model=modelFor();
  const preview=model.generalReadingPreview();
  assert.equal(preview.count,10);
  assert.equal(preview.total,8);
  const round=model.generalReadingRound({seed:'source-scoped'});
  assert.equal(round.questions.length,8);
  assert.equal(round.strict,false);
  assert.equal(round.modeId,'reading');
  assert.equal(round.count,10);
  const allowed=new Set([...reading,old].map(row=>row.id));
  assert(round.questions.every(row=>allowed.has(row.id)));
  assert(round.eligibleIds.every(id=>allowed.has(id)));
  assert(round.catalog.questions.every(row=>allowed.has(row.id)));
  assert(round.questions.every(row=>row.subject==='Reading / ELA'));
  assert(!round.questions.some(row=>[star,saved,review].includes(row)));
  assert.deepEqual(model.testRound({index:0,upcoming:true,seed:'unchanged'}).questions,[]);
});

test('No general-reading button or fallback questions appear without reviewed Reading material',()=>{
  const empty=modelFor({catalog:{
    sourceKey:'only-star',
    questions:[star,question('math','Math','addition-within-100')],
  },schoolwork:{lessons:[]}});
  assert.deepEqual(empty.generalReadingPreview(),{count:0,total:0});
  assert.deepEqual(empty.generalReadingRound({seed:'empty'}).questions,[]);
  const html=htmlFor(empty);
  assert.doesNotMatch(html,/data-general-reading/);
  assert.match(html,/0 matching questions/);
});

test('Specific Reading text-set exams never gain unrelated Reading questions',()=>{
  const named=modelFor({events:[{date:'2026-11-11',label:'Reading (Unit 3 Text Set 2)',kind:'test'}]});
  assert.equal(named.upcomingTests().missing[0].count,0);
  assert.deepEqual(named.testRound({index:0,upcoming:true,seed:'scoped'}).questions,[]);
  assert.doesNotMatch(htmlFor(named),/data-general-reading/);
});
