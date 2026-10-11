import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
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
  ['allowed standards cannot hide metadata',p=>p.lessons[0].questions[0].standards=[{studentFullName:'Private'}]],
  ['allowed optional hint must stay text',p=>p.lessons[0].questions[0].hint={rawOcrTranscript:'Private'}],
  ['allowed root note must stay text',p=>p.distinctWorksheetNote={childName:'Private'}],
  ['allowed manifest reason must stay text',p=>p.sourceManifest[0].reason={originalPrivateUrl:'https://private.example/item'}],
 ];
 for(const [label,mutate] of cases){
  const p=pack();mutate(p);
  assert.throws(()=>validateSchoolwork(p,{requireManifest:true}),/(unknown field|invalid standards|invalid hint|Invalid distinctWorksheetNote|invalid reason)/,label);
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
test('reviewed replays with different JSON property order do not create false source or lesson collisions',async()=>{
 const current=pack();
 // Reviewed JSON may be reserialized with the exact same facts in a new key order.
 const reordered=value=>Array.isArray(value)?value.map(reordered):
   value&&typeof value==='object'
     ?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reordered(item)]))
     :value;
 const replay=reordered(current);
 assert.deepEqual(replay,current);
 assert.notEqual(JSON.stringify(replay.sourceManifest[0]),JSON.stringify(current.sourceManifest[0]));
 assert.notEqual(JSON.stringify(replay.lessons[0]),JSON.stringify(current.lessons[0]));
 assert.deepEqual(mergeSchoolwork(current,replay),current);

 const dir=await mkdtemp(join(tmpdir(),'schoolwork-replay-order-'));
 try{
  const target=join(dir,'schoolwork.json'),batch=join(dir,'reviewed-batch.json');
  const before=JSON.stringify(current,null,2)+'\n';
  await writeFile(target,before);
  await writeFile(batch,JSON.stringify(replay));
  assert.deepEqual(await integrateFile(target,batch),{mode:'dry-run',changed:false,lessons:1,questions:1,photos:1});
  assert.deepEqual(await integrateFile(target,batch,{write:true}),{mode:'write',changed:false,lessons:1,questions:1,photos:1});
  assert.equal(await readFile(target,'utf8'),before);
 }finally{await rm(dir,{recursive:true,force:true});}

 const changedAnswer=structuredClone(replay);
 changedAnswer.lessons[0].questions[0].answer='8';
 assert.throws(()=>mergeSchoolwork(current,changedAnswer),/Lesson ID collision/);
 const changedDigest=structuredClone(replay);
 changedDigest.sourceManifest[0].sha256='b'.repeat(64);
 assert.throws(()=>mergeSchoolwork(current,changedDigest),/Source ID collision/);
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


test('held source can resolve under the same ID and SHA only with reviewed provenance',()=>{
 const held=pack();
 held.lessons=[];
 held.sourceManifest=[{id:'held-photo.jpeg',sha256:'c'.repeat(64),status:'held',reason:'Image was not readable enough to integrate safely.'}];
 held.uploadedPhotoCount=1;
 const resolved=pack();
 resolved.sourceManifest=[{id:'held-photo.jpeg',sha256:'c'.repeat(64),status:'integrated'}];
 resolved.lessons[0].sources=['held-photo.jpeg'];
 const result=mergeSchoolwork(held,resolved);
 assert.equal(result.sourceManifest[0].status,'integrated');
 assert.equal(result.lessons.length,1);
 assert.deepEqual(result.lessons[0].sources,['held-photo.jpeg']);
 assert.deepEqual(mergeSchoolwork(result,resolved),result);

 const changedDigest=structuredClone(resolved);
 changedDigest.sourceManifest[0].sha256='d'.repeat(64);
 assert.throws(()=>mergeSchoolwork(held,changedDigest),/collision/);

 const downgrade=structuredClone(held);
 assert.throws(()=>mergeSchoolwork(result,downgrade),/collision/);
});

test('held source may become a duplicate only of an integrated canonical',()=>{
 const current=pack();
 current.sourceManifest.push({id:'held-photo.jpeg',sha256:'c'.repeat(64),status:'held',reason:'Initially unreadable.'});
 current.uploadedPhotoCount=2;

 const batch=pack();
 batch.sourceManifest.push({id:'held-photo.jpeg',sha256:'c'.repeat(64),status:'duplicate',duplicateOf:'photo-1.jpeg',reason:'Later review confirmed this is the same worksheet.'});
 batch.uploadedPhotoCount=2;
 batch.lessons[0].sources.push('held-photo.jpeg');

 const result=mergeSchoolwork(current,batch);
 const resolved=result.sourceManifest.find(source=>source.id==='held-photo.jpeg');
 assert.equal(resolved.status,'duplicate');
 assert.equal(resolved.duplicateOf,'photo-1.jpeg');
 assert(result.lessons[0].sources.includes('held-photo.jpeg'));

 const chain=structuredClone(result);
 chain.sourceManifest.push({id:'third.jpeg',sha256:'e'.repeat(64),status:'duplicate',duplicateOf:'held-photo.jpeg',reason:'Invalid duplicate chain.'});
 chain.uploadedPhotoCount++;
 chain.lessons[0].sources.push('third.jpeg');
 assert.throws(()=>validateSchoolwork(chain,{requireManifest:true}),/invalid duplicateOf/);
});

test('a new source ID never auto-canonicalizes to an unresolved held source',()=>{
 const held=pack();
 held.lessons=[];
 held.sourceManifest=[{id:'held-photo.jpeg',sha256:'c'.repeat(64),status:'held',reason:'Unreadable.'}];
 held.uploadedPhotoCount=1;

 const renamed=pack();
 renamed.sourceManifest=[{id:'renamed-photo.jpeg',sha256:'c'.repeat(64),status:'integrated'}];
 renamed.lessons[0].sources=['renamed-photo.jpeg'];
 assert.throws(()=>mergeSchoolwork(held,renamed),/repeated hash/);
});

test('held evidence cannot authorize public lesson notes or practice',()=>{
 const rejected=pack();
 rejected.sourceManifest[0].status='held';
 rejected.sourceManifest[0].reason='The photo is unreadable and has not been approved.';
 assert.throws(()=>validateSchoolwork(rejected,{requireManifest:true}),/held source cannot support published lessons/);
 const accounted=structuredClone(rejected);
 accounted.lessons=[];
 assert.deepEqual(validateSchoolwork(accounted,{requireManifest:true}),{lessons:0,questions:0,photos:1});
 // The same source may later be resolved without changing its ID or digest.
 const resolved=mergeSchoolwork(accounted,pack());
 assert.equal(resolved.sourceManifest[0].status,'integrated');
 assert.equal(resolved.lessons.length,1);
});

test('semantic rephotographs cannot be used to publish unrelated independent lessons',()=>{
 const p=pack();
 p.sourceManifest.push({id:'photo-2.jpeg',sha256:'b'.repeat(64),status:'duplicate',
   duplicateOf:'photo-1.jpeg',reason:'Reviewed as another picture of the same worksheet.'});
 p.uploadedPhotoCount=2;
 p.lessons.push({...structuredClone(p.lessons[0]),id:'independent-review',
   title:'New lesson from a duplicate photo',sources:['photo-2.jpeg'],
   questions:[{...p.lessons[0].questions[0],id:'q-2',prompt:'What is 1 + 6?'}]});
 assert.throws(()=>validateSchoolwork(p,{requireManifest:true}),
   /duplicate photo-2.jpeg must share its lesson with photo-1.jpeg/);
 // A duplicate may be attached to the exact already-reviewed canonical lesson.
 p.lessons.pop();
 p.lessons[0].sources.push('photo-2.jpeg');
 assert.equal(validateSchoolwork(p,{requireManifest:true}).photos,2);
});

test('one SHA-256 can have only one integrated canonical regardless of manifest order',()=>{
 const p=pack(),canonical=p.sourceManifest[0];
 const second={id:'photo-2.jpeg',sha256:canonical.sha256,status:'integrated'};
 const duplicate={id:'photo-3.jpeg',sha256:canonical.sha256,status:'duplicate',
   duplicateOf:canonical.id,reason:'Exact duplicate'};
 // This ordering bypassed the old first-seen hash test.
 p.sourceManifest=[duplicate,second,canonical];
 p.uploadedPhotoCount=3;
 p.lessons[0].sources=[canonical.id,second.id,duplicate.id];
 assert.throws(()=>validateSchoolwork(p,{requireManifest:true}),
   /SHA-256 already integrated as/);
 p.sourceManifest=[canonical,duplicate];
 p.uploadedPhotoCount=2;
 p.lessons[0].sources=[canonical.id,duplicate.id];
 assert.equal(validateSchoolwork(p,{requireManifest:true}).photos,2);
});

test('identical SHA-256 cannot be attributed to the wrong integrated worksheet',async()=>{
 const p=pack(),original=p.sourceManifest[0];
 const second={id:'photo-2.jpeg',sha256:'b'.repeat(64),status:'integrated'};
 const impersonator={id:'photo-3.jpeg',sha256:original.sha256,status:'duplicate',
   duplicateOf:second.id,reason:'Claimed to be another picture of the second worksheet.'};
 p.sourceManifest.push(second,impersonator);
 p.lessons.push({...structuredClone(p.lessons[0]),id:'triangle-review',
   title:'Triangle review',sources:[second.id,impersonator.id],
   skills:['triangles'],notes:['A triangle has three sides.'],
   questions:[{...p.lessons[0].questions[0],id:'q-2',
     prompt:'How many sides does a triangle have?',answer:'3',choices:['3','4'],
     explanation:'A triangle has three sides.',sourceFact:'Triangle sides',skill:'triangles'}]});
 p.uploadedPhotoCount=3;
 // Former behavior accepted the fabricated semantic-duplicate explanation.
 // Canonical attribution must be independent of manifest ordering.
 for(const manifest of [
   [original,second,impersonator],
   [impersonator,second,original],
   [second,original,impersonator]
 ]){
   const invalid={...p,sourceManifest:manifest};
   assert.throws(()=>validateSchoolwork(invalid,{requireManifest:true}),
     /exact SHA-256 duplicate must reference photo-1.jpeg/);
   assert.throws(()=>mergeSchoolwork(pack(),invalid),
     /exact SHA-256 duplicate must reference photo-1.jpeg/);
 }
 const semantic=structuredClone(p);
 semantic.sourceManifest[2].sha256='c'.repeat(64);
 assert.deepEqual(validateSchoolwork(semantic,{requireManifest:true}),
   {lessons:2,questions:2,photos:3});
 const exactCorrect=structuredClone(p);
 exactCorrect.sourceManifest[2].sha256=second.sha256;
 assert.deepEqual(validateSchoolwork(exactCorrect,{requireManifest:true}),
   {lessons:2,questions:2,photos:3});

 const dir=await mkdtemp(join(tmpdir(),'schoolwork-wrong-digest-owner-'));
 try{
   const target=join(dir,'schoolwork.json'),reviewedBatch=join(dir,'batch.json');
   const before=JSON.stringify(pack(),null,2)+'\n';
   await writeFile(target,before);
   await writeFile(reviewedBatch,JSON.stringify(p));
   await assert.rejects(integrateFile(target,reviewedBatch,{write:true}),
     /exact SHA-256 duplicate must reference photo-1.jpeg/);
   assert.equal(await readFile(target,'utf8'),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('held photo bytes cannot escape quarantine under a second source ID',()=>{
 const p=pack(),canonical=p.sourceManifest[0];
 const held={id:'unreadable.jpeg',sha256:'c'.repeat(64),status:'held',
   reason:'Cannot confirm the printed question.'};
 const alias={id:'renamed.jpeg',sha256:held.sha256,status:'duplicate',
   duplicateOf:canonical.id,reason:'Claimed semantic match while original is held.'};
 p.sourceManifest.push(held,alias);
 p.lessons[0].sources.push(alias.id);
 p.uploadedPhotoCount=3;
 for(const manifest of [
   [canonical,held,alias],
   [canonical,alias,held],
   [alias,held,canonical]
 ]){
   assert.throws(()=>validateSchoolwork({...p,sourceManifest:manifest},{requireManifest:true}),
     /SHA-256 belongs to unresolved held source unreadable.jpeg/);
 }
 const differentBytes=structuredClone(p);
 differentBytes.sourceManifest[2].sha256='d'.repeat(64);
 assert.deepEqual(validateSchoolwork(differentBytes,{requireManifest:true}),
   {lessons:1,questions:1,photos:3});
 const heldOnly=structuredClone(p);
 heldOnly.sourceManifest.pop();
 heldOnly.lessons[0].sources.pop();
 heldOnly.uploadedPhotoCount=2;
 assert.deepEqual(validateSchoolwork(heldOnly,{requireManifest:true}),
   {lessons:1,questions:1,photos:2});
});

test('integrated and held sources cannot pretend to be duplicate records',()=>{
 const p=pack();
 p.sourceManifest[0].duplicateOf='another-photo.jpeg';
 assert.throws(()=>validateSchoolwork(p,{requireManifest:true}),
   /duplicateOf is only valid for duplicate sources/);
 const held=pack();
 held.lessons=[];
 held.sourceManifest[0].status='held';
 held.sourceManifest[0].reason='Not yet reviewed.';
 held.sourceManifest[0].duplicateOf='another-photo.jpeg';
 assert.throws(()=>validateSchoolwork(held,{requireManifest:true}),
   /duplicateOf is only valid for duplicate sources/);
});

test('standalone public release validator never accepts a missing source manifest',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'abvm-public-manifest-gate-'));
 try{
  const input=join(dir,'schoolwork.json'),script=fileURLToPath(new URL('../scripts/validate-schoolwork.mjs',import.meta.url));
  const withoutManifest=pack();
  delete withoutManifest.sourceManifest;
  // Legacy library consumers can explicitly opt into a less strict shape,
  // but the command used by public release QA must always fail closed.
  assert.equal(validateSchoolwork(withoutManifest).photos,1);
  const bytes=JSON.stringify(withoutManifest);
  await writeFile(input,bytes);
  const rejected=spawnSync(process.execPath,[script,input],{encoding:'utf8'});
  assert.notEqual(rejected.status,0);
  assert.match(rejected.stderr,/Reviewed intake requires a sourceManifest/);
  assert.equal(await readFile(input,'utf8'),bytes);
  await writeFile(input,JSON.stringify(pack()));
  const accepted=spawnSync(process.execPath,[script,input],{encoding:'utf8'});
  assert.equal(accepted.status,0,accepted.stderr);
  assert.deepEqual(JSON.parse(accepted.stdout),{lessons:1,questions:1,photos:1});
 }finally{await rm(dir,{recursive:true,force:true});}
});
