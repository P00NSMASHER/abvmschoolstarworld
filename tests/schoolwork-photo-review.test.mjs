import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chmod,mkdir,mkdtemp,readFile,rm,stat,symlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {
  auditPhotoReviewPacket,buildPhotoReviewPacket,checkPrivatePhotoReviewPacket,
  createPrivatePhotoReviewPacket,reviewContentSha256,verifyPrivateOriginalPhoto
} from '../scripts/schoolwork-photo-review.mjs';

const sample=(sha='a'.repeat(64))=>({
  schemaVersion:1,uploadedPhotoCount:1,
  sourceManifest:[{id:'worksheet.jpeg',sha256:sha,status:'integrated'}],
  lessons:[{
    id:'add-facts',title:'Fact families',subject:'Math',sources:['worksheet.jpeg'],
    skills:['fact-families'],notes:['Adding two numbers makes a total.'],
    studiedOn:null,addedOn:'2026-10-08',dateStatus:'Undated schoolwork',
    questions:[{
      id:'q-1',subject:'Math',skill:'fact-families',
      prompt:'What is 2 + 5?',answer:'7',choices:['7','8','9'],
      explanation:'Two plus five equals seven.',
      sourceFact:'Addition facts',provenance:'original-practice-from-uploaded-schoolwork'
    }]
  }]
});

test('real 23-photo library generates complete private photo-to-question review inventory',async()=>{
  const pack=JSON.parse(await readFile(new URL('../pages/data/schoolwork.json',import.meta.url),'utf8'));
  const before=JSON.stringify(pack);
  const receipt=buildPhotoReviewPacket(pack);
  const report=auditPhotoReviewPacket(pack,receipt);
  assert.deepEqual(report.totals,{lessons:13,questions:67,photos:23});
  assert.equal(receipt.sources.length,23);
  assert.equal(receipt.lessons.length,13);
  assert.equal(receipt.lessons.reduce((total,l)=>total+l.questions.length,0),67);
  assert.equal(receipt.sources.filter(s=>s.duplicateKind==='semantic-rephotograph').length,1);
  assert.equal(receipt.lessons.filter(l=>l.dateEvidence==='undated').length,12);
  assert.equal(receipt.lessons.filter(l=>l.dateEvidence==='verified-week-only').length,1);
  assert.equal(report.checklist.pending,23*4+13*3+67*3);
  assert.equal(report.checklist.confirmed,0);
  assert.equal(report.checklistComplete,false);
  assert.equal(report.releaseStatus,'HOLD_EXTERNAL_SIGNOFF');
  assert.equal(receipt.releaseAuthority,'NOT_GRANTED_BY_THIS_PACKET');
  assert.equal(JSON.stringify(pack),before,'review creation never modifies the governed pack');
  assert(!JSON.stringify(receipt).includes('teacherMarkSummary'));
});

test('byte and academic-content changes invalidate prior review even with identical IDs',()=>{
  const original=sample();
  const receipt=buildPhotoReviewPacket(original);
  const alteredAnswer=structuredClone(original);
  alteredAnswer.lessons[0].questions[0].answer='8';
  alteredAnswer.lessons[0].questions[0].choices[0]='7';
  assert.throws(()=>auditPhotoReviewPacket(alteredAnswer,receipt),/stale|altered/);
  const alteredPhoto=sample('b'.repeat(64));
  assert.throws(()=>auditPhotoReviewPacket(alteredPhoto,receipt),/stale|altered/);
  const alteredDate=sample();
  alteredDate.lessons[0].studiedOn='2026-10-07';
  alteredDate.lessons[0].dateStatus='Verified day';
  assert.throws(()=>auditPhotoReviewPacket(alteredDate,receipt),/stale|altered/);
  const badReceipt=structuredClone(receipt);
  badReceipt.sources[0].sourceManifest.sha256='b'.repeat(64);
  assert.throws(()=>auditPhotoReviewPacket(original,badReceipt),/stale|altered/);
});

test('object property reordering does not invalidate a truly identical source review',()=>{
  const pack=sample();
  const receipt=buildPhotoReviewPacket(pack);
  const reorder=value=>Array.isArray(value)?value.map(reorder):
    value&&typeof value==='object'
      ?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reorder(item)]))
      :value;
  const reordered=reorder(pack);
  assert.equal(reviewContentSha256(reordered),reviewContentSha256(pack));
  assert.deepEqual(auditPhotoReviewPacket(reordered,receipt).totals,{lessons:1,questions:1,photos:1});
  assert.equal(auditPhotoReviewPacket(pack,reorder(receipt)).releaseStatus,'HOLD_EXTERNAL_SIGNOFF');
});

test('checklist states are strict and never authorize deployment',()=>{
  const pack=sample(),receipt=buildPhotoReviewPacket(pack);
  const all=[];
  receipt.sources.forEach(row=>all.push(row.review));
  receipt.lessons.forEach(lesson=>{
    all.push(lesson.review);
    lesson.questions.forEach(question=>all.push(question.review));
  });
  for(const section of all)
    for(const field of Object.keys(section))section[field]='confirmed';
  const complete=auditPhotoReviewPacket(pack,receipt);
  assert.equal(complete.checklistComplete,true);
  assert.equal(complete.checklist.pending,0);
  assert.equal(complete.releaseStatus,'HOLD_EXTERNAL_SIGNOFF');
  const invalid=structuredClone(receipt);
  invalid.lessons[0].questions[0].review.ageAndPrivacy='automatically-approved';
  assert.throws(()=>auditPhotoReviewPacket(pack,invalid),/Invalid review status/);
  const injected=structuredClone(receipt);
  injected.releaseAuthority='RELEASE';
  assert.throws(()=>auditPhotoReviewPacket(pack,injected),/stale|altered/);
  const extra=structuredClone(receipt);
  extra.sources[0].review.teacherName='Private';
  assert.throws(()=>auditPhotoReviewPacket(pack,extra),/status shape/);
  const held=sample();
  held.sourceManifest=[{id:'held.jpeg',sha256:'b'.repeat(64),status:'held',reason:'No readable photograph.'}];
  held.lessons=[];held.uploadedPhotoCount=1;
  const heldReceipt=buildPhotoReviewPacket(held);
  for(const key of Object.keys(heldReceipt.sources[0].review))
    heldReceipt.sources[0].review[key]='confirmed';
  assert.equal(auditPhotoReviewPacket(held,heldReceipt).checklistComplete,false);
});

test('private receipt is owner-only, preserves manually edited reviews, and never overwrites',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'abvm-photo-review-'));
  try{
    const repoRoot=path.join(dir,'public-repo'),destination=path.join(dir,'private','review.json');
    await mkdir(repoRoot);
    const pack=sample();
    const made=await createPrivatePhotoReviewPacket(pack,destination,{repoRoot});
    assert.equal(made.created,true);
    assert.equal(made.releaseStatus,'HOLD_EXTERNAL_SIGNOFF');
    if(process.platform!=='win32'){
      assert.equal((await stat(destination)).mode&0o777,0o600);
      assert.equal((await stat(path.dirname(destination))).mode&0o777,0o700);
    }
    const receipt=JSON.parse(await readFile(destination,'utf8'));
    receipt.sources[0].review.originalPhotoDigest='confirmed';
    await writeFile(destination,JSON.stringify(receipt));
    const prior=await readFile(destination,'utf8');
    await assert.rejects(createPrivatePhotoReviewPacket(pack,destination,{repoRoot}),
      error=>error.code==='EEXIST');
    assert.equal(await readFile(destination,'utf8'),prior);
    assert.equal((await checkPrivatePhotoReviewPacket(pack,destination,{repoRoot}))
      .checklist.confirmed,1);
    const revised=sample('b'.repeat(64));
    await assert.rejects(checkPrivatePhotoReviewPacket(revised,destination,{repoRoot}),/stale|altered/);
    await assert.rejects(createPrivatePhotoReviewPacket(pack,path.join(repoRoot,'leak.json'),{repoRoot}),
      /outside the public ABVM repository/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('original photo bytes are checked privately without interpreting or exporting them',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'abvm-photo-hash-'));
  try{
    const repoRoot=path.join(dir,'public-repo'),photoPath=path.join(dir,'private','original.jpeg');
    await mkdir(path.dirname(photoPath));await mkdir(repoRoot);
    const image=Buffer.from('SYNTHETIC PHOTO FIXTURE: not a real student document');
    await writeFile(photoPath,image);
    const pack=sample(createHash('sha256').update(image).digest('hex'));
    const matching=await verifyPrivateOriginalPhoto(pack,'worksheet.jpeg',photoPath,{repoRoot});
    assert.deepEqual(matching,{
      sourceId:'worksheet.jpeg',sha256MatchesManifest:true,humanContentReview:'NOT_PERFORMED'
    });
    await writeFile(photoPath,Buffer.from('SYNTHETIC PHOTO DIFFERENT BYTES'));
    const mismatch=await verifyPrivateOriginalPhoto(pack,'worksheet.jpeg',photoPath,{repoRoot});
    assert.equal(mismatch.sha256MatchesManifest,false);
    await assert.rejects(verifyPrivateOriginalPhoto(pack,'unknown.jpeg',photoPath,{repoRoot}),
      /Unknown source ID/);
    await assert.rejects(verifyPrivateOriginalPhoto(pack,'worksheet.jpeg',
      path.join(repoRoot,'public-photo.jpeg'),{repoRoot}),/outside the public ABVM repository/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('private review packet symlink escape and permissive permissions are rejected',{skip:process.platform==='win32'},async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'abvm-review-symlink-'));
  try{
    const repoRoot=path.join(dir,'public-repo'),outside=path.join(dir,'private');
    await mkdir(repoRoot);await mkdir(outside);
    const alias=path.join(outside,'public-alias');
    await symlink(repoRoot,alias,'dir');
    await assert.rejects(
      createPrivatePhotoReviewPacket(sample(),path.join(alias,'review.json'),{repoRoot}),
      /outside the public ABVM repository/
    );
    const receiptPath=path.join(outside,'review.json');
    await createPrivatePhotoReviewPacket(sample(),receiptPath,{repoRoot});
    await chmod(receiptPath,0o644);
    await assert.rejects(checkPrivatePhotoReviewPacket(sample(),receiptPath,{repoRoot}),
      /owner-only/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
