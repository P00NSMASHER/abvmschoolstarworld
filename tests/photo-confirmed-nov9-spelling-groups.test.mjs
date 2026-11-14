import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {createStudyMaterials,photoConfirmedSpellingGroupFacts,photoSpellingEvidence} from '../pages/study-materials.mjs';

const read=name=>JSON.parse(fs.readFileSync(new URL('../pages/data/'+name,import.meta.url)));
const teacherWords=['scratch','catch','scrape','sting','spring','throne','stripe','strange',
  'far','shred','flower','shrub','until','splash','split'];
const event={date:'2026-11-13',label:'Spelling (3 letter blends) / Handwriting',kind:'test'};
const teacherPack=()=>{
  const pack=structuredClone(read('study-pack.json').pack);
  pack.spellingListProvenance={
    weekLabel:'Week of November 9, 2026',
    sourceUrl:'https://sites.google.com/view/abvmgr2/weekly-spelling-list',
    wordsHash:createHash('sha256').update(JSON.stringify(teacherWords)).digest('hex'),
  };
  // Pin this test to the verified November source so later live teacher
  // refreshes do not rewrite historical regression fixtures.
  pack.subjects=[{subject:'Spelling / Handwriting',topics:[
    'Friday, Nov. 13 test focus: 3 letter blends',
  ],studyNotes:[
    'Skill: 3 letter blends',
    'Teacher-posted spelling words (page undated): '+teacherWords.join(', '),
  ]}];
  return pack;
};
const facts=(pack=teacherPack(),words=teacherWords,testRow=event)=>
  photoConfirmedSpellingGroupFacts({test:testRow,pack,spellingWords:words});

test('the photographed word groups partition the 15 verified teacher words without duplication',()=>{
  const proof=photoSpellingEvidence;
  assert.equal(proof.testDate,'2026-11-13');
  assert.equal(proof.weekLabel,'Week of November 9, 2026');
  assert.match(proof.sourceSha256,/^[a-f0-9]{64}$/);
  assert.equal(proof.teacherWordsHash,
    createHash('sha256').update(JSON.stringify(teacherWords)).digest('hex'));
  const categories=proof.groups;
  assert.deepEqual(categories.map(group=>group.words.length),[10,2,3]);
  const all=categories.flatMap(group=>group.words);
  assert.equal(new Set(all).size,15);
  assert.deepEqual(new Set(all),new Set(teacherWords));
  assert.deepEqual(facts(),[
    'Photo-confirmed basic words (10): scratch, scrape, spring, throne, stripe, strange, shred, shrub, splash, split',
    'Photo-confirmed review words (2): catch, sting',
    'Photo-confirmed sight words (3): far, flower, until',
  ]);
});

test('November 13 printable guide includes the groups and retains the complete teacher dictation list',()=>{
  const pack=teacherPack();
  const model=createStudyMaterials({
    schoolwork:read('schoolwork.json'),pack,catalog:{sourceKey:'nov9-photo-proof',questions:[]},
    events:[event],now:()=>new Date('2026-11-10T18:00:00Z'),
    storage:{getItem:()=>null,setItem:()=>{}},
  });
  const guide=model.testGuide(0);
  assert(guide,'verified November 13 test must have a study guide');
  assert.deepEqual(guide.spellingWords,teacherWords);
  for(const line of facts(pack))assert(guide.facts.includes(line));
  assert.equal(guide.facts.filter(line=>line.startsWith('Photo-confirmed ')).length,3);
});

test('stale week, changed words, wrong topic, corrupt digest and later test fail closed',()=>{
  const wrongWeek=teacherPack();
  wrongWeek.spellingListProvenance.weekLabel='Week of November 2, 2026';
  assert.deepEqual(facts(wrongWeek),[]);
  const changedDigest=teacherPack();
  changedDigest.spellingListProvenance.wordsHash='0000000000000000000000000000000000000000000000000000000000000000';
  assert.deepEqual(facts(changedDigest),[]);
  assert.deepEqual(facts(teacherPack(),teacherWords.map(word=>word==='split'?'splint':word)),[]);
  assert.deepEqual(facts(teacherPack(),[...teacherWords.slice(0,14),'scratch']),[]);
  assert.deepEqual(facts(teacherPack(),teacherWords,{...event,date:'2026-11-20'}),[]);
  assert.deepEqual(facts(teacherPack(),teacherWords,{...event,label:'Spelling (long a) / Handwriting'}),[]);
});
