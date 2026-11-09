import {assertFocusedWorksheet} from './helpers/focused-worksheet.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStudyMaterials} from '../pages/study-materials.mjs';
import {questionsForTest,isReligionUnitOneReviewTest,religionChapterScopes} from '../pages/study-hub-core.mjs';
import {printableStudyGuideHtml,printableWorksheetHtml} from '../pages/study-games-materials-view.mjs';

const published=JSON.parse(readFileSync(
  new URL('./fixtures/abvm-source-snapshot-2026-11-09.json',import.meta.url),'utf8')).pack;
const questions=published.contentPipeline.questions.map(q=>({...q,tier:'material'}));
const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
function model(label='Religion Ch. 4') {
  return createStudyMaterials({
    pack:published,
    catalog:{sourceKey:published.sourceHash,questions},
    events:[{date:'2026-11-03',label,kind:'test'}],
    now:()=> '2026-11-03T14:00:00Z',
    storage,
  });
}

test('publisher Grade 2 Chapter 4 is treated as a Unit 1 cumulative review boundary',()=>{
  assert.equal(isReligionUnitOneReviewTest({label:'Religion Ch. 4'}),true);
  assert.equal(isReligionUnitOneReviewTest({label:'Religion Chapter 4'}),true);
  assert.equal(isReligionUnitOneReviewTest({label:'Religion Unit 1 Test'}),true);
  for(const label of ['Religion Ch. 3','Religion Ch. 5','Reading Unit 1 Text Set 4'])
    assert.equal(isReligionUnitOneReviewTest({label}),false);
});

test('actual teacher shorthand no longer generates a Chapter 4-only practice sheet',()=>{
  const guide=model().testGuide(0);
  assert.ok(guide,'November 3 religion assessment must be printable');
  assert.match(guide.scopeNotice,/Unit 1 cumulative review: Chapters 1–4/);
  assert.match(guide.sourceLabel,/original practice/);
  const skills=new Set(guide.practice.map(q=>q.skill));
  for(const skill of [
    'religion-chapter-4','religion-trinity','religion-image-likeness',
    'religion-jesus-savior','religion-original-sin','religion-faith-gift',
    'religion-baptism-grace','religion-vine-branches',
    'religion-unit1-church-leaders','religion-unit1-apostles',
    'religion-unit1-original-sin','religion-unit1-saints',
  ])assert.ok(skills.has(skill),skill+' must be covered');

  assert.equal(guide.practice.filter(q=>q.skill==='religion-chapter-4').length,10,
    'preserve every existing Chapter 4 question, not a thin subset');
  assert.ok(guide.practice.some(q=>q.answer==='The pope and bishops'));
  assert.ok(guide.practice.some(q=>q.answer==='The Apostles'));
  assert.ok(guide.practice.some(q=>q.answer==='original sin'));
  assert.ok(guide.teacherFacts.some(f=>/pope and bishops.*Apostles/i.test(f)));
  assert.ok(guide.teacherFacts.some(f=>/Holy Spirit guides the Church/i.test(f)));
  assert.equal(guide.coverage.missingGuideSkills.length,0);
  assert.equal(guide.coverage.missingSkills.length,0);
  assert.ok(guide.practice.length>=25,'retain multiple earlier-chapter skills without losing Ch4');

  const study=printableStudyGuideHtml(guide),worksheet=printableWorksheetHtml(guide);
  for (const html of [study,worksheet]) {
    assert.match(html,/Unit 1 cumulative review: Chapters 1–4/);
    assert.match(html,/original practice|Original study practice/);
    assert.doesNotMatch(html,/private learner|actual marked test|handwritten score/i);
  }
  const selected=assertFocusedWorksheet(worksheet,guide.practice);
  assert.deepEqual(new Set(selected.flatMap(q=>q.sourceChapters)),new Set([1,2,3,4]));
  assert.match(study,/Holy Spirit guides the Church/);
});

test('Chapter 3-only assessments stay chapter-scoped and do not acquire Unit 1 supplements',()=>{
  const earlier=model('Religion Ch. 3').testGuide(0);
  assert.ok(earlier);
  assert.equal(earlier.scopeNotice,'');
  assert.ok(earlier.practice.some(q=>q.skill==='religion-original-sin'));
  assert.ok(earlier.practice.every(q=>!q.skill.startsWith('religion-unit1-')));
  assert.ok(earlier.practice.every(q=>q.skill!=='religion-chapter-4'));
  assert.ok(earlier.practice.every(q=>q.skill!=='religion-vine-branches'));
});

test('Unit 1 review rejects religion questions without a confirmed chapter',()=>{
  const all=[
    {id:'unit1-ch1',subject:'Religion',skill:'religion-image-likeness',sourceChapters:[1]},
    {id:'unit1-ch4',subject:'Religion',skill:'religion-chapter-4',sourceChapters:[4]},
    {id:'unscoped',subject:'Religion',skill:'religion-mystery'},
    {id:'chapter5',subject:'Religion',skill:'religion-future',sourceChapters:[5]},
    {id:'reading',subject:'Reading / ELA',skill:'religion-chapter-3',sourceChapters:[3]},
  ];
  assert.deepEqual(questionsForTest({label:'Religion Ch. 4'},all).map(q=>q.id),[
    'unit1-ch4','unit1-ch1',
  ]);
  assert.deepEqual(questionsForTest({label:'Religion Ch. 3'},all).map(q=>q.id),[]);
  assert.equal(religionChapterScopes({subject:'Religion',sourceChapters:[5]})[0],5);
});

test('original Unit 1 supplement covers the full curriculum instead of only a few weak topics',async()=>{
  const {religionUnitOneQuestions,religionUnitOneFacts}=await import('../pages/religion-unit1-review.mjs');
  assert.equal(religionUnitOneQuestions.length,15);
  assert.equal(new Set(religionUnitOneQuestions.map(q=>q.id)).size,15);
  const required=[
    'religion-unit1-church-leaders','religion-unit1-apostles','religion-unit1-sign-cross',
    'religion-unit1-grace','religion-unit1-holy-spirit','religion-unit1-saints',
    'religion-unit1-original-sin','religion-unit1-creator','religion-unit1-trinity',
    'religion-unit1-church-family','religion-unit1-baptism-members',
    'religion-unit1-baptism-water','religion-unit1-jesus-sent',
    'religion-unit1-jesus-all','religion-unit1-christian-example',
  ];
  const skills=new Set(religionUnitOneQuestions.map(q=>q.skill));
  for(const skill of required) assert.ok(skills.has(skill),'missing Unit 1 skill: '+skill);
  for(const q of religionUnitOneQuestions) {
    assert.ok(q.prompt&&q.explanation&&q.hint);
    assert.equal(new Set(q.choices).size,q.choices.length);
    assert.equal(q.choices.filter(choice=>choice===q.answer).length,1);
    assert.ok(q.sourceChapters.length>0&&q.sourceChapters.every(ch=>ch>=1&&ch<=4));
    assert.match(q.sourceFact,/Original cumulative practice/);
  }
  assert.ok(religionUnitOneFacts.length>=12,'unit guide should contain full cumulative facts');
});

test('new Unit 1 module is cached for offline installed ABVM apps',()=>{
  const sw=readFileSync(new URL('../pages/sw.js',import.meta.url),'utf8');
  assert.match(sw,/"\.\/religion-unit1-review\.mjs"/);
  assert.match(sw,/const CACHE = "abvm-grade2-parent-companion-v\d+/);
});
