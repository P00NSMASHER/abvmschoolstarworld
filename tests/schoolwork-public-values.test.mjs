import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {validateSchoolwork} from '../scripts/validate-schoolwork.mjs';
import {integrateFile} from '../scripts/integrate-schoolwork.mjs';

// Synthetic fixtures: no real learner information or unreviewed photographs.
const fixture=()=>({
  schemaVersion:1,
  uploadedPhotoCount:1,
  sourceManifest:[{id:'photo-01.jpeg',sha256:'a'.repeat(64),status:'integrated'}],
  lessons:[{
    id:'sentence-practice',
    title:'Sentence practice',
    subject:'Reading / ELA',
    sources:['photo-01.jpeg'],
    skills:['complete-sentences'],
    notes:['A complete sentence has a capital letter and ending punctuation.'],
    studiedOn:null,
    addedOn:'2026-10-08',
    dateStatus:'Undated schoolwork',
    questions:[{
      id:'sentence-1',subject:'Reading / ELA',skill:'complete-sentences',
      prompt:'Which sentence has correct capitalization and punctuation?',
      answer:'We like the park.',
      choices:['We like the park.','we like the park','We like the park','we like the park.'],
      explanation:'Start with a capital letter and finish with a period.',
      sourceFact:'Sentence capitalization',
      provenance:'original-practice-from-uploaded-schoolwork'
    }]
  }]
});

test('direct identifiers inside allowlisted schoolwork values are rejected',()=>{
  const cases=[
    ['email in a lesson note',p=>p.lessons[0].notes.push('Send work to reader@example.org'),/email address/],
    ['email inside a valid answer',p=>{
      const q=p.lessons[0].questions[0];
      q.answer='reader@example.org';q.choices[0]=q.answer;
    },/email address/],
    ['telephone in a question prompt',p=>p.lessons[0].questions[0].prompt='Call (570) 555-0148 for help.',/phone number/],
    ['telephone in a manifest reason',p=>p.sourceManifest[0].reason='Call 570.555.0148 for support.',/phone number/],
    ['government ID in explanation',p=>p.lessons[0].questions[0].explanation='Private number 123-45-6789.',/government ID/],
    ['embedded data image hidden in lesson notes',p=>p.lessons[0].notes.push('Preview: data:image/png;base64,AAAA'),/embedded data URI/],
    ['embedded data URI hidden in answer choice',p=>p.lessons[0].questions[0].choices[1]='payload data:application/pdf;base64,AAAA',/embedded data URI/],
    ['contact hidden in public source note',p=>p.distinctWorksheetNote='Source contact reader@example.org',/email address/]
  ];
  for(const [label,change,expected] of cases) {
    const candidate=fixture();
    change(candidate);
    assert.throws(()=>validateSchoolwork(candidate,{requireManifest:true}),expected,label);
  }
});

test('legitimate punctuation practice and SHA digests are not rejected as personal data',()=>{
  const candidate=fixture();
  // Numeric runs inside an actual SHA-256 are not telephone numbers.
  candidate.sourceManifest[0].sha256='8d435e78e0d8827418083d009d23f9ae77e51f624b0575f920ac48b61ada4f43';
  assert.deepEqual(validateSchoolwork(candidate,{requireManifest:true}),{lessons:1,questions:1,photos:1});
  // Case and punctuation are meaningful distractors, not normalized collisions.
  assert.equal(candidate.lessons[0].questions[0].choices.length,4);
});

test('the existing published photo-reviewed library remains structurally valid',async()=>{
  const full=JSON.parse(await readFile(new URL('../pages/data/schoolwork.json',import.meta.url),'utf8'));
  assert.deepEqual(validateSchoolwork(full,{requireManifest:true}),{lessons:13,questions:67,photos:23});
});

test('a rejected public-value leak cannot change cumulative content on write',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'abvm-private-value-'));
  try {
    const target=join(dir,'schoolwork.json');
    const incoming=join(dir,'reviewed-batch.json');
    const original=JSON.stringify(fixture(),null,2)+'\n';
    await writeFile(target,original);
    const bad=fixture();
    bad.lessons[0].notes.push('Private contact: 570-555-0148.');
    await writeFile(incoming,JSON.stringify(bad));
    await assert.rejects(integrateFile(target,incoming,{write:true}),/phone number/);
    assert.equal(await readFile(target,'utf8'),original);
  } finally {await rm(dir,{recursive:true,force:true});}
});
