import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {matchCurriculumFamily} from '../scripts/curriculum-family-registry.mjs';
import {buildGrade2ContentPipeline} from '../scripts/grade2-content-pipeline.mjs';
import {questionsForTest} from '../pages/study-hub-core.mjs';
import {printableStudyGuideHtml,printableWorksheetHtml} from '../pages/study-games-materials-view.mjs';

const skills = [
  {subject:'Reading / ELA',topic:'charts',id:'reading-charts'},
  {subject:'Reading / ELA',topic:'diagrams & labels',id:'diagrams-labels'},
  {subject:'Spelling / Handwriting',topic:'long o / Short )',id:'long-o'},
  {subject:'Reading / ELA',topic:'short vowels',id:'short-vowels'},
];
test('original owner-authorized teacher-topic question families have eight valid nonduplicate variants', () => {
  for (const {subject,topic,id} of skills) {
    const family=matchCurriculumFamily(subject,topic);
    assert.equal(family.id,id);
    assert.equal(family.rolloutStatus,'APPROVED');
    assert.equal(family.enabledByDefault,true);
    const questions=[family.baseQuestion,...family.supplementalQuestions];
    assert.equal(questions.length,8);
    assert.deepEqual([...new Set(questions.map(q=>q.questionType))].sort(),['direct','reasoning','transfer']);
    assert.equal(new Set(questions.map(q=>q.prompt)).size,8);
    for (const question of questions) {
      assert.equal(question.choices.length,3);
      assert.equal(new Set(question.choices).size,3);
      assert.equal(question.choices.filter(choice=>choice===question.answer).length,1);
      assert(question.explanation.length>20);
      assert(question.hint.length>15);
      assert(question.prompt.length>20);
    }
  }
});

test('source-covered chart, diagram-label, long-o, and short-vowel practice flows into current Test Prep without fake short-vowel specificity', () => {
  const timestamp='2026-10-14T23:00:00.000Z';
  const readingHash='1'.repeat(64), testsHash='2'.repeat(64);
  const pack = {
    sourceHash:'teacher-pages-'+'f'.repeat(20),
    subjects:[
      {subject:'Reading / ELA',topics:['Reading comprehension: charts; diagrams & labels','Phonics: short vowels (test Friday, Oct. 16)'],studyNotes:[]},
      {subject:'Spelling / Handwriting',topics:['Friday, Oct. 16 test focus: long o / Short )'],studyNotes:[]},
    ],
    vocabulary:[],
  };
  const pages=[
    {title:'Reading Work',url:'https://sites.google.com/view/abvmgr2/reading-work',checkedAt:timestamp,contentHash:readingHash,lines:['Reading Comprehension: charts; diagrams & labels']},
    {title:'Tests',url:'https://sites.google.com/view/abvmgr2/tests',checkedAt:timestamp,contentHash:testsHash,lines:['Friday Oct. 16: Spelling (long o / Short ) / Handwriting','Friday Oct. 16: Phonics (short vowels)']},
  ];
  const out=buildGrade2ContentPipeline(pack,{
    sourceHash:pack.sourceHash,generatedAt:timestamp,sourcePages:pages,requirePageExactLineage:true,
  });
  assert.equal(out.qa.status,'pass');
  assert.equal(out.qa.rejectedCount,0);
  for (const {id} of skills) {
    const qs=out.questions.filter(q=>q.skill===id);
    assert.equal(qs.length,8,id);
    assert(qs.every(q=>q.sourceLineage?.quality==='page-exact'),id);
  }
  const spelling=questionsForTest({label:'Spelling (long o / Short ) / Handwriting',date:'2026-10-16'},out.questions);
  const phonics=questionsForTest({label:'Phonics (short vowels)',date:'2026-10-16'},out.questions);
  assert.equal(spelling.length,8);
  assert(spelling.every(q=>q.skill==='long-o'));
  assert.equal(phonics.length,8);
  assert(phonics.every(q=>q.skill==='short-vowels'));
  assert(!out.questions.some(q=>q.sourceLineage?.quality!=='page-exact'));
});



test('diagram-label practice withdraws without the source topic, requires exact lineage, and renders both papers', () => {
  const timestamp='2026-10-23T20:30:23.509Z';
  const sourceHash='teacher-pages-'+'d'.repeat(20);
  const sourcePack={
    sourceHash,
    subjects:[{subject:'Reading / ELA',topics:['Reading comprehension: Main idea / details; diagrams & labels'],studyNotes:[]}],
    vocabulary:[],
  };
  const sourcePages=[{
    title:'Reading Work',
    url:'https://sites.google.com/view/abvmgr2/reading-work',
    checkedAt:timestamp,
    contentHash:'3'.repeat(64),
    lines:['Reading Comprehension: Main idea / details; diagrams & labels'],
  }];
  const out=buildGrade2ContentPipeline(sourcePack,{
    sourceHash,generatedAt:timestamp,sourcePages,requirePageExactLineage:true,
  });
  const skill=out.skills.find(row=>row.id==='diagrams-labels');
  const practice=out.questions.filter(row=>row.skill==='diagrams-labels');
  assert(skill);
  assert.equal(practice.length,8);
  assert(practice.every(row=>row.sourceLineage?.quality==='page-exact'));
  assert(practice.every(row=>row.sourceMode==='CURATED_CONTEXT'));
  assert.match(skill.studyNotes.join(' '),/Teacher-style supplemental practice/i);
  assert(!out.coverage.some(row=>row.topic==='diagrams & labels'&&row.status==='GENERATOR_UNSUPPORTED'));

  const guide={
    label:'Reading Comprehension: diagrams & labels',
    date:'2026-10-30',
    subject:'Reading / ELA',
    facts:skill.studyNotes,
    teacherFacts:[],
    vocabulary:[],
    practice,
    warnings:[],
    sourceLabel:'Current published ABVM topic with teacher-style supplemental practice',
    sourceCheckedAt:timestamp,
    coverage:{missingGuideSkills:[]},
  };
  const guideHtml=printableStudyGuideHtml(guide);
  const worksheetHtml=printableWorksheetHtml(guide);
  for(const question of practice){
    assert(guideHtml.includes(question.prompt),question.id);
    assert(worksheetHtml.includes(question.prompt),question.id);
  }
  assert.match(guideHtml,/Teacher-style supplemental practice/i);
  assert.match(guideHtml,/@media screen and \(max-width:620px\)/);
  assert.match(worksheetHtml,/Answer Key/i);
  assert.match(worksheetHtml,/@media print/);

  const withdrawn=buildGrade2ContentPipeline({
    ...sourcePack,
    subjects:[{subject:'Reading / ELA',topics:['Reading comprehension: Main idea / details'],studyNotes:[]}],
  },{sourceHash,generatedAt:timestamp,sourcePages,requirePageExactLineage:true});
  assert(!withdrawn.skills.some(row=>row.id==='diagrams-labels'));
  assert(!withdrawn.questions.some(row=>row.skill==='diagrams-labels'));

  assert.throws(()=>buildGrade2ContentPipeline(sourcePack,{
    sourceHash,generatedAt:timestamp,sourcePages:[],requirePageExactLineage:true,
  }),/lineage|page-exact/i);
});


test('Religion Chapter 4 test receives scoped guide, worksheet, and correct answer keys', () => {
  const family=matchCurriculumFamily('Religion','Religion Ch. 4');
  assert.equal(family?.id,'religion-chapter-4');
  assert.equal(family?.rolloutStatus,'APPROVED');
  assert.equal([family.baseQuestion,...family.supplementalQuestions].length,8);
  const timestamp='2026-10-24T05:00:00.000Z';
  const sourceHash='teacher-pages-'+'4'.repeat(20);
  const pack={
    sourceHash,
    subjects:[{
      subject:'Religion',
      topics:['Religion Ch. 4'],
      studyNotes:['The Tests page lists Religion Ch. 4 for Tuesday, Nov. 3.'],
    }],
    vocabulary:[],
  };
  const sourcePages=[{
    title:'Tests',
    url:'https://sites.google.com/view/abvmgr2/tests',
    checkedAt:timestamp,
    contentHash:'4'.repeat(64),
    lines:['Tuesday, Nov. 3: Religion Ch. 4'],
  }];
  const out=buildGrade2ContentPipeline(pack,{
    sourceHash,generatedAt:timestamp,sourcePages,requirePageExactLineage:true,
  });
  assert.equal(out.qa.status,'pass');
  assert.equal(out.qa.rejectedCount,0);
  const skill=out.skills.find(row=>row.id==='religion-chapter-4');
  const practice=questionsForTest({label:'Religion Ch. 4',date:'2026-11-03'},out.questions);
  assert(skill);
  assert.equal(practice.length,8);
  assert(practice.every(row=>row.skill==='religion-chapter-4'));
  assert(practice.every(row=>row.sourceChapters?.includes(4)));
  assert(practice.every(row=>row.sourceLineage?.quality==='page-exact'));
  assert(practice.every(row=>row.sourceLineage?.sourceTitle==='Tests'));
  assert(practice.every(row=>row.sourceMode==='CURATED_CONTEXT'));
  assert.match(skill.studyNotes.join(' '),/Teacher-style supplemental practice/i);
  assert.match(skill.studyNotes.join(' '),/Old Testament.*New Testament.*saint/i);
  for(const question of practice){
    assert.equal(question.choices.filter(choice=>choice===question.answer).length,1,question.id);
    assert(question.explanation.length>20,question.id);
  }

  const guide={
    label:'Religion Ch. 4',
    date:'2026-11-03',
    subject:'Religion',
    facts:skill.studyNotes,
    teacherFacts:[],
    vocabulary:['Old Testament','New Testament','saint'],
    practice,
    warnings:[],
    sourceLabel:'Current published ABVM test with teacher-style supplemental practice',
    sourceCheckedAt:timestamp,
    coverage:{missingGuideSkills:[]},
  };
  const guideHtml=printableStudyGuideHtml(guide);
  const worksheetHtml=printableWorksheetHtml(guide);
  assert.match(guideHtml,/God Speaks to Us/i);
  assert.match(guideHtml,/Teacher-style supplemental practice/i);
  assert.match(guideHtml,/@media screen and \(max-width:620px\)/);
  assert.match(worksheetHtml,/Answer Key/i);
  assert.match(worksheetHtml,/@media print/);
  for(const question of practice){
    assert(guideHtml.includes(question.prompt),question.id);
    assert(worksheetHtml.includes(question.prompt),question.id);
    assert(worksheetHtml.includes(question.answer),question.id);
  }

  const unrelated=out.questions.filter(row=>row.subject==='Religion'&&row.skill!=='religion-chapter-4');
  assert.equal(unrelated.length,0);
});

test('service worker returns current test-routing modules online while preserving offline cache fallback', () => {
  const sw=readFileSync(new URL('../pages/sw.js',import.meta.url),'utf8');
  assert.match(sw,/study-hub-core\|study-materials/);
  const start=sw.indexOf('// Source/current test routing must update immediately online');
  const end=sw.indexOf('// Versioned code must never be satisfied',start);
  assert(start>0&&end>start);
  const branch=sw.slice(start,end);
  assert.match(branch,/networkFirst\(event.request,null,event\)/);
  assert.match(sw,/cachedFallback\(request,fallback\)/);
});


test('soft c and g test receives source-backed guide, worksheet, and correct answer keys', () => {
  const timestamp='2026-10-27T19:07:28.519Z';
  const sourceHash='teacher-pages-'+'6'.repeat(20);
  const pack={
    sourceHash,
    subjects:[{
      subject:'Spelling / Handwriting',
      topics:['Friday, Oct. 30 test focus: soft c and g'],
      studyNotes:[],
    }],
    vocabulary:[],
  };
  const sourcePages=[{
    title:'Tests',
    url:'https://sites.google.com/view/abvmgr2/tests',
    checkedAt:timestamp,
    contentHash:'6'.repeat(64),
    lines:['Friday Oct. 30: Spelling (soft c and g) / Handwriting'],
  }];
  const out=buildGrade2ContentPipeline(pack,{
    sourceHash,generatedAt:timestamp,sourcePages,requirePageExactLineage:true,
  });
  const skill=out.skills.find(row=>row.id==='soft-c-g');
  const practice=questionsForTest({label:'Spelling (soft c and g) / Handwriting',date:'2026-10-30'},out.questions);
  assert(skill);
  assert.equal(practice.length,3);
  assert(practice.every(row=>row.skill==='soft-c-g'));
  assert(practice.every(row=>row.sourceLineage?.quality==='page-exact'));
  assert(practice.every(row=>row.sourceLineage?.sourceTitle==='Tests'));
  assert.match(skill.studyNotes.join(' '),/Teacher-style supplemental practice/i);
  assert(!out.coverage.some(row=>/soft c and g/i.test(row.topic)&&row.status==='GENERATOR_UNSUPPORTED'));
  for(const question of practice){
    assert.equal(question.choices.length,3,question.id);
    assert.equal(new Set(question.choices).size,3,question.id);
    assert.equal(question.choices.filter(choice=>choice===question.answer).length,1,question.id);
    assert(question.explanation.length>20,question.id);
  }

  const guide={
    label:'Spelling (soft c and g) / Handwriting',
    date:'2026-10-30',
    subject:'Spelling / Handwriting',
    facts:skill.studyNotes,
    teacherFacts:[],
    vocabulary:[],
    practice,
    warnings:[],
    sourceLabel:'Current published ABVM test with teacher-style supplemental practice',
    sourceCheckedAt:timestamp,
    coverage:{missingGuideSkills:[]},
  };
  const guideHtml=printableStudyGuideHtml(guide);
  const worksheetHtml=printableWorksheetHtml(guide);
  assert.match(guideHtml,/Teacher-style supplemental practice/i);
  assert.match(guideHtml,/@media screen and \(max-width:620px\)/);
  assert.match(worksheetHtml,/Answer Key/i);
  assert.match(worksheetHtml,/@media print/);
  for(const question of practice){
    assert(guideHtml.includes(question.prompt),question.id);
    assert(worksheetHtml.includes(question.prompt),question.id);
    assert(worksheetHtml.includes(question.answer),question.id);
  }
});
