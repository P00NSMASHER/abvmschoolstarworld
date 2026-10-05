import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateSchoolwork} from '../scripts/validate-schoolwork.mjs';
import {mergeSchoolwork,integrateFile} from '../scripts/integrate-schoolwork.mjs';
const pack=()=>({schemaVersion:1,uploadedPhotoCount:1,sourceManifest:[{id:'photo-1.jpeg',sha256:'a'.repeat(64),status:'integrated'}],lessons:[{id:'fact-families',title:'Fact families',subject:'Math',sources:['photo-1.jpeg'],skills:['fact-families'],notes:['Addition and subtraction facts share numbers.'],studiedOn:null,addedOn:'2026-10-04',dateStatus:'Undated schoolwork',questions:[{id:'q-1',subject:'Math',skill:'fact-families',prompt:'What is 2 + 5?',answer:'7',choices:['7','8'],explanation:'Two plus five equals seven.',sourceFact:'Addition',provenance:'original-practice-from-uploaded-schoolwork'}]}]});
test('valid pack accounts for every photo and rejects answer/date/privacy corruption',()=>{
 assert.deepEqual(validateSchoolwork(pack(),{requireManifest:true}),{lessons:1,questions:1,photos:1});
 for(const mutate of [p=>p.lessons[0].questions[0].answer='9',p=>p.lessons[0].studiedOn='2026-02-30',p=>p.uploadedPhotoCount=2,p=>p.lessons[0].studentName='Private',p=>p.lessons[0].questions.push({...p.lessons[0].questions[0],id:'q-2'})]){const p=pack();mutate(p);assert.throws(()=>validateSchoolwork(p));}
});
test('public schoolwork schema rejects unknown keys at every object level',()=>{
 const cases=[
  ['root student metadata',p=>p.childName='Private'],
  ['root nested metadata',p=>p.metadata={studentFullName:'Private'}],
  ['lesson private variant',p=>p.lessons[0].studentFullName='Private'],
  ['lesson OCR variant',p=>p.lessons[0].rawOcrTranscript='Private worksheet text'],
  ['question teacher mark',p=>p.lessons[0].questions[0].teacherMark='A+'],
  ['question answer-sheet variant',p=>p.lessons[0].questions[0].answerSheetText='Private response'],
  ['manifest private URL',p=>p.sourceManifest[0].originalPrivateUrl='https://private.example/item'],
  ['manifest nested metadata',p=>p.sourceManifest[0].metadata={owner:'Private'}],
 ];
 for(const [label,mutate] of cases){
  const p=pack();mutate(p);
  assert.throws(()=>validateSchoolwork(p,{requireManifest:true}),/unknown field/,label);
 }
});
test('semantic rephotographs are accounted without duplicating lesson content',()=>{
 const p=pack();p.sourceManifest.push({id:'photo-2.jpeg',sha256:'b'.repeat(64),status:'duplicate',duplicateOf:'photo-1.jpeg',reason:'Same worksheet rephotographed'});p.uploadedPhotoCount=2;p.lessons[0].sources.push('photo-2.jpeg');assert.equal(validateSchoolwork(p).photos,2);
 delete p.sourceManifest[1].reason;assert.throws(()=>validateSchoolwork(p));
});
test('replay is idempotent and lesson collisions fail closed',()=>{
 assert.deepEqual(mergeSchoolwork(pack(),pack()),pack());
 const b=pack();b.lessons[0].notes=['Changed content'];assert.throws(()=>mergeSchoolwork(pack(),b),/collision/);
 const sourceCollision=pack();sourceCollision.sourceManifest[0].sha256='b'.repeat(64);assert.throws(()=>mergeSchoolwork(pack(),sourceCollision),/collision/);
});
test('new duplicate hash merges provenance and preserves original addedOn',()=>{
 const b=pack();b.sourceManifest[0].id='photo-2.jpeg';b.lessons[0].sources=['photo-2.jpeg'];b.lessons[0].addedOn='2026-10-05';
 const result=mergeSchoolwork(pack(),b);assert.equal(result.lessons.length,1);assert.equal(result.lessons[0].addedOn,'2026-10-04');assert.equal(result.sourceManifest[1].duplicateOf,'photo-1.jpeg');assert.deepEqual(mergeSchoolwork(result,b),result);
});
test('transaction dry-run and invalid write never mutate source',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'schoolwork-intake-'));
 try{const target=join(dir,'schoolwork.json'),batch=join(dir,'batch.json'),before=JSON.stringify(pack());await writeFile(target,before);await writeFile(batch,before);
 assert.equal((await integrateFile(target,batch)).changed,false);assert.equal(await readFile(target,'utf8'),before);
 const invalid=pack();invalid.lessons[0].questions[0].answer='bad';await writeFile(batch,JSON.stringify(invalid));await assert.rejects(integrateFile(target,batch,{write:true}));assert.equal(await readFile(target,'utf8'),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
