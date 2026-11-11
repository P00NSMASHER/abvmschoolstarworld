import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSchoolwork} from '../scripts/validate-schoolwork.mjs';

const schoolwork=JSON.parse(readFileSync(new URL('../pages/data/schoolwork.json',import.meta.url),'utf8'));
const uploaded=schoolwork.sourceManifest.filter(s=>/^abvm-nov3-photo-45(?:1\d|2[0-6])\.jpeg$/.test(s.id));
const lessons=schoolwork.lessons.filter(l=>l.id.startsWith('nov3-photo-'));

test('November 3 seventeen-photo intake accounts for all originals and protects private pages',()=>{
  const total=validateSchoolwork(schoolwork,{requireManifest:true}).photos;
  assert.equal(total,schoolwork.sourceManifest.length);
  assert.ok(total>=86,'subsequent intakes must preserve all earlier source entries');
  assert.equal(uploaded.length,17);
  assert.deepEqual(uploaded.map(s=>s.id).sort(),
    Array.from({length:17},(_,i)=>'abvm-nov3-photo-'+(4510+i)+'.jpeg').sort());
  const integrated=uploaded.filter(s=>s.status==='integrated');
  const held=uploaded.filter(s=>s.status==='held');
  assert.equal(integrated.length,12);
  assert.equal(held.length,5);
  const expectedHeld=[4516,4517,4518,4521,4522].map(n=>'abvm-nov3-photo-'+n+'.jpeg');
  assert.deepEqual(held.map(s=>s.id).sort(),expectedHeld.sort());
  const referenced=new Set(lessons.flatMap(l=>l.sources));
  for(const source of integrated)assert.ok(referenced.has(source.id),source.id+' missing safe coverage');
  for(const source of held)assert.ok(!referenced.has(source.id),source.id+' must remain private');
});

test('current math Chapter 2 practice enters the verified school week, not invented completion dates',()=>{
  const mathCh2=lessons.filter(l=>l.id==='nov3-photo-math-ch2-written'||l.id==='nov3-photo-math-ch2-four-choice');
  assert.equal(mathCh2.length,2);
  for(const lesson of mathCh2){
    assert.equal(lesson.weekOf,'2026-11-02');
    assert.equal(lesson.studiedOn,null);
    assert.match(lesson.dateStatus,/undated/i);
    assert.ok(lesson.skills.some(s=>/place-value|expanded|counting/i.test(s)));
  }
  for(const lesson of lessons.filter(l=>!mathCh2.includes(l)))assert.equal(lesson.weekOf,undefined);
});

test('only original, anonymous educational questions enter the public app',()=>{
  assert.equal(lessons.length,10);
  assert.equal(lessons.flatMap(l=>l.questions).length,35);
  for(const lesson of lessons){
    assert.equal(lesson.studiedOn,null);
    assert.ok(lesson.sources.length>0);
    for(const q of lesson.questions){
      assert.equal(q.provenance,'original-practice-from-uploaded-schoolwork');
      assert.equal(q.subject,lesson.subject);
      assert.ok(lesson.skills.includes(q.skill));
      assert.equal(q.choices.filter(choice=>choice===q.answer).length,1);
      assert.match(q.sourceFact,/original home practice/i);
    }
  }
  const publicCopy=JSON.stringify(lessons);
  for(const forbidden of [/\bEmma\b/i,/school ID/i,/her grade/i,/teacher X/i,/handwritten response/i,/my worries/i,/personal reflection response/i]){
    assert.doesNotMatch(publicCopy,forbidden,'no student-specific evidence belongs in public lessons');
  }
});

test('all source photos have distinct digests and held images cannot generate practice',()=>{
  const hashes=schoolwork.sourceManifest.map(x=>x.sha256);
  assert.equal(hashes.length,new Set(hashes).size);
  const allReferenced=new Set(schoolwork.lessons.flatMap(l=>l.sources));
  for(const source of uploaded.filter(s=>s.status==='held')){
    assert.ok(!allReferenced.has(source.id));
    assert.match(source.reason,/private|publisher/i);
  }
});
