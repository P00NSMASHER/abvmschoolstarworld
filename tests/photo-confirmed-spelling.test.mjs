import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateSchoolwork} from '../scripts/validate-schoolwork.mjs';
import {questionsForTest} from '../pages/study-hub-core.mjs';
import {createStudyMaterials} from '../pages/study-materials.mjs';
import {buildStudyUniverse} from '../scripts/build-study-universe.mjs';
import {buildStarBank} from '../pages/star-practice.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL('../pages/data/' + name, import.meta.url)));
const words = ['did','fin','pick','line','tip','pipe','mix','five','side','cape','hike','made','all','any','says'];
const spellingTest = {date:'2026-10-09',label:'Spelling (short i / long i) / Handwriting',kind:'test'};

test('every supplied weekly spelling photo is accounted without publishing handwriting',()=>{
  const schoolwork=read('schoolwork.json');
  const proof=validateSchoolwork(schoolwork,{requireManifest:true});
  const lesson=schoolwork.lessons.find(row=>row.id==='spelling-oct-09-2026');
  assert(lesson);
  assert.equal(lesson.studiedOn,null,'do not invent an exact assignment day');
  assert.equal(lesson.weekOf,'2026-10-05');
  assert.equal(lesson.addedOn,'2026-10-08');
  assert.equal(lesson.questions.length,15);
  assert.equal(proof.photos,23);
  assert.equal(lesson.sources.length,3);
  assert.deepEqual(lesson.questions.map(q=>q.answer),words);
  const sourceHashes=lesson.sources.map(id=>schoolwork.sourceManifest.find(row=>row.id===id)?.sha256);
  assert.deepEqual(sourceHashes,[
    'c669a60b89c6bbcd27a66b8839c20a1a44381bea3d9d6fbb87393d90794f2544',
    '6064ad1b7ccf4ac31d118f5e90767af283c441b441aaeb3d4beea08cf059ce52',
    '6c9bc4c05660a0e5b02a122e7bd10a0c0ea18fce2811001e12290bedccd91f1c',
  ]);
  assert.deepEqual(lesson.questions.filter(q=>q.skill==='short-i-long-i').map(q=>q.answer),
    ['did','fin','pick','line','tip','pipe','mix','five','side','hike']);
  assert.deepEqual(lesson.questions.filter(q=>q.skill==='long-short-a').map(q=>q.answer),['cape','made']);
  assert.deepEqual(lesson.questions.filter(q=>q.skill==='high-frequency-word-use').map(q=>q.answer),['all','any','says']);
  const serialized=JSON.stringify(lesson);
  assert.doesNotMatch(serialized,/studentName|studentId|studentAnswers|handwrittenAnswers|teacherMarks|gradeReceived|data:image|imageBase64/i);
  for(const q of lesson.questions){
    assert.equal(q.choices.filter(choice=>choice===q.answer).length,1);
    assert.equal(q.sourceFact,'Photo-confirmed weekly spelling words for 2026-10-09');
  }
});

test('only a verified Monday week anchor can make week-dated material current',()=>{
  const schoolwork=read('schoolwork.json');
  for(const weekOf of ['2026-10-08','2026-02-31','sometime','2026-10-12']){
    const changed=structuredClone(schoolwork);
    changed.lessons.find(l=>l.id==='spelling-oct-09-2026').weekOf=weekOf;
    if(weekOf!=='2026-10-12')assert.throws(()=>validateSchoolwork(changed,{requireManifest:true}));
    else assert.doesNotThrow(()=>validateSchoolwork(changed,{requireManifest:true}));
  }
});

test('This Week, saved learning, dictation guide and named test use the same photo-confirmed list',()=>{
  const schoolwork=read('schoolwork.json');
  const pack=read('study-pack.json').pack;
  const model=createStudyMaterials({schoolwork,pack,catalog:{sourceKey:'photo-confirmed',questions:[]},events:[spellingTest],
    now:()=>new Date('2026-10-08T16:00:00Z'),storage:{getItem:()=>null,setItem:()=>{}}});
  const rows=model.banks().weekly.filter(q=>q.id.startsWith('work-spelling-oct09-'));
  assert.equal(rows.length,15);
  assert.deepEqual(rows.map(q=>q.answer),words);
  assert(model.notes('weekly').lessons.some(l=>l.id==='spelling-oct-09-2026'));
  const related=model.testGuide(0);
  assert(related.facts.some(f=>f.includes('did, fin, pick, line, tip, pipe, mix, five, side, cape, hike, made, all, any, says')));
  assert(related.sourceLabel.includes('family photo-confirmed'));
  assert.equal(model.testRound({upcoming:true,index:0,seed:'photo-words'}).questions.length,8);

  const nextWeek=createStudyMaterials({schoolwork,pack,catalog:{sourceKey:'photo-confirmed',questions:[]},events:[],
    now:()=>new Date('2026-10-12T16:00:00Z'),storage:{getItem:()=>null,setItem:()=>{}}});
  assert.equal(nextWeek.banks().weekly.filter(q=>q.id.startsWith('work-spelling-oct09-')).length,0);
  assert.equal(nextWeek.banks().saved.filter(q=>q.id.startsWith('work-spelling-oct09-')).length,15);
});

test('October 9 spelling test gets all 15 homework words, without leaking into later test dates',()=>{
  const schoolwork=read('schoolwork.json');
  const rows=schoolwork.lessons.find(l=>l.id==='spelling-oct-09-2026').questions;
  assert.deepEqual(questionsForTest(spellingTest,rows).map(q=>q.answer),words);
  assert.deepEqual(questionsForTest({...spellingTest,date:'2026-10-16'},rows),[]);
  assert.deepEqual(questionsForTest({...spellingTest,date:'Friday, Oct. 9'},rows),[]);
});

test('the deterministic Roblox curriculum export includes each word, current tier and dated test',()=>{
  const input={pack:read('study-pack.json'),archive:read('study-archive.json'),schoolwork:read('schoolwork.json'),fallbackQuestions:buildStarBank()};
  const out=buildStudyUniverse(input);
  const exported=out.questions.filter(q=>q.id.startsWith('work-spelling-oct09-'));
  assert.equal(exported.length,15);
  assert(exported.every(q=>q.tier==='current'));
  assert.deepEqual(exported.map(q=>q.answer),words);
  const testRow=out.selectableTestPrep.find(row=>row.date==='2026-10-09' && row.label===spellingTest.label);
  assert(testRow?.supported);
  assert(exported.every(q=>testRow.questionIds.includes(q.id)));
  const roblox=out.curriculumPackets.find(p=>p.subject==='Spelling / Handwriting');
  assert(roblox);
  assert(exported.every(q=>roblox.questionIds.includes(q.id)));
  assert(!JSON.stringify(out).includes('spelling-2026-10-09-practice-a.jpeg'));
  assert.equal(JSON.stringify(buildStudyUniverse(input)),JSON.stringify(out));
});
