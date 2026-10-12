import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildSchoolworkPhotoChecklist,buildPrivatePhotoReviewTemplate,verifySchoolworkPhotoReviews,newYorkSchoolDay} from '../scripts/verify-schoolwork-photo-reviews.mjs';
import {validateSchoolwork} from '../scripts/validate-schoolwork.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const sample=()=>({
  schemaVersion:1,uploadedPhotoCount:1,
  sourceManifest:[{id:'worksheet.jpeg',sha256:hash('photo-bytes'),status:'integrated'}],
  lessons:[{
    id:'math-review',title:'Math review',subject:'Math',
    sources:['worksheet.jpeg'],skills:['addition'],
    notes:['Two and three make five.'],studiedOn:null,addedOn:'2026-10-10',
    dateStatus:'Undated schoolwork',
    questions:[{
      id:'addition-one',subject:'Math',skill:'addition',
      prompt:'What is two plus three?',answer:'5',choices:['4','5','6'],
      explanation:'Two plus three makes five.',sourceFact:'Addition',
      provenance:'original-practice-from-uploaded-schoolwork'
    }]
  }]
});
const makeEnv=async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'abvm-photo-review-'));
  const photoDir=path.join(dir,'private-photos');
  const receiptPath=path.join(dir,'private-receipts.json');
  const repoRoot=path.join(dir,'public-repo');
  await mkdir(photoDir);await mkdir(repoRoot);
  return {dir,photoDir,receiptPath,repoRoot};
};
const reviewed=pack=>{
  const book=buildPrivatePhotoReviewTemplate(pack);
  for(const row of book.receipts){
    row.reviewedOn='2026-10-11';
    row.reviewerId='reviewer-opaque-01';
    for(const key of Object.keys(row.checks))row.checks[key]=true;
  }
  return book;
};

test('actual 23-photo library gets deterministic bound checklist without pretending source files were read',async()=>{
  const pack=JSON.parse(await readFile(new URL('../pages/data/schoolwork.json',import.meta.url),'utf8'));
  const original=JSON.stringify(pack);
  const first=buildSchoolworkPhotoChecklist(pack);
  assert.deepEqual(first.totals,{photos:23,lessons:13,questions:67});
  assert.equal(first.entries.length,23);
  assert.equal(first.entries.filter(entry=>entry.status==='duplicate').length,1);
  assert.equal(first.entries.filter(entry=>entry.status==='held').length,0);
  assert(first.entries.every(entry=>entry.lessonContentSha256.length===64));
  assert.equal(first.releaseStatus,'HOLD_EXTERNAL_SIGNOFF');
  assert.equal(JSON.stringify(pack),original);
  const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'
    ?Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,sorted(v)])):value;
  assert.deepEqual(buildSchoolworkPhotoChecklist(sorted(pack)),first,'JSON key order cannot revoke a review');
  const ids=new Set(first.entries.flatMap(entry=>entry.questionIds));
  assert.equal(ids.size,67);
});

test('only matching private bytes and fully completed records yield technical evidence status, never release approval',async()=>{
  const env=await makeEnv();
  try{
    const pack=sample(),book=reviewed(pack);
    await writeFile(path.join(env.photoDir,'worksheet.jpeg'),'photo-bytes');
    await writeFile(env.receiptPath,JSON.stringify(book));
    const result=await verifySchoolworkPhotoReviews(pack,env.photoDir,env.receiptPath,{repoRoot:env.repoRoot,asOfDay:'2026-10-11'});
    assert.equal(result.recordedEvidenceCount,1);
    assert.equal(result.unresolvedSourceCount,0);
    assert.equal(result.sources[0].status,'PHOTO_DIGEST_AND_ATTESTATION_RECORDED');
    assert.equal(result.releaseStatus,'HOLD_EXTERNAL_SIGNOFF');
    assert.equal(result.humanPhotoReviewAuthenticity,'NOT_INDEPENDENTLY_VERIFIED');
    assert(!JSON.stringify(result).includes('reviewer-opaque-01'));
    assert(!JSON.stringify(result).includes('photo-bytes'));
  }finally{await rm(env.dir,{recursive:true,force:true});}
});

test('missing and modified original photo bytes fail closed',async()=>{
  const env=await makeEnv();
  try{
    const pack=sample();
    await writeFile(env.receiptPath,JSON.stringify(reviewed(pack)));
    let output=await verifySchoolworkPhotoReviews(pack,env.photoDir,env.receiptPath,{repoRoot:env.repoRoot,asOfDay:'2026-10-11'});
    assert.equal(output.sources[0].status,'PHOTO_FILE_MISSING');
    await writeFile(path.join(env.photoDir,'worksheet.jpeg'),'altered-photo-bytes');
    output=await verifySchoolworkPhotoReviews(pack,env.photoDir,env.receiptPath,{repoRoot:env.repoRoot,asOfDay:'2026-10-11'});
    assert.equal(output.sources[0].status,'PHOTO_SHA256_MISMATCH');
    assert.equal(output.releaseStatus,'HOLD_EXTERNAL_SIGNOFF');
  }finally{await rm(env.dir,{recursive:true,force:true});}
});

test('review for old lessons becomes stale after academic content or source digest changes',async()=>{
  const env=await makeEnv();
  try{
    const pack=sample();
    await writeFile(path.join(env.photoDir,'worksheet.jpeg'),'photo-bytes');
    await writeFile(env.receiptPath,JSON.stringify(reviewed(pack)));
    const modified=structuredClone(pack);
    modified.lessons[0].questions[0].explanation='Two plus three is five: count forward from two.';
    let result=await verifySchoolworkPhotoReviews(modified,env.photoDir,env.receiptPath,{repoRoot:env.repoRoot,asOfDay:'2026-10-11'});
    assert.equal(result.sources[0].status,'STALE_EDUCATIONAL_CONTENT_RECEIPT');
    const digestChanged=structuredClone(pack);
    digestChanged.sourceManifest[0].sha256=hash('different-photo');
    result=await verifySchoolworkPhotoReviews(digestChanged,env.photoDir,env.receiptPath,{repoRoot:env.repoRoot,asOfDay:'2026-10-11'});
    assert.equal(result.sources[0].status,'PHOTO_SHA256_MISMATCH');
    assert.equal(pack.lessons[0].questions[0].explanation,'Two plus three makes five.');
  }finally{await rm(env.dir,{recursive:true,force:true});}
});

test('stale receipt digests, incomplete checks and unreviewed placeholders never become approval',async()=>{
  const env=await makeEnv();
  try{
    const pack=sample();
    await writeFile(path.join(env.photoDir,'worksheet.jpeg'),'photo-bytes');
    for(const [mutator,reason] of [
      [book=>{book.receipts[0].lessonContentSha256='a'.repeat(64);},'STALE_EDUCATIONAL_CONTENT_RECEIPT'],
      [book=>{book.receipts[0].expectedPhotoSha256='b'.repeat(64);},'STALE_PHOTO_RECEIPT'],
      [book=>{book.receipts[0].checks.printedWorkCompared=false;},'HUMAN_CHECKLIST_INCOMPLETE'],
      [book=>{book.receipts[0].reviewedOn='2026-10-09';},'REVIEW_DATE_OR_REVIEWER_INCOMPLETE'],
      [book=>{book.receipts[0].reviewedOn='2026-10-12';},'REVIEW_DATE_OR_REVIEWER_INCOMPLETE'],
      [book=>{book.receipts[0].reviewerId=null;},'REVIEW_DATE_OR_REVIEWER_INCOMPLETE'],
      [book=>{book.receipts=[];},'REVIEW_RECEIPT_MISSING']
    ]){
      const book=reviewed(pack);mutator(book);
      await writeFile(env.receiptPath,JSON.stringify(book));
      const report=await verifySchoolworkPhotoReviews(pack,env.photoDir,env.receiptPath,{repoRoot:env.repoRoot,asOfDay:'2026-10-11'});
      assert.equal(report.sources[0].status,reason);
      assert.equal(report.releaseStatus,'HOLD_EXTERNAL_SIGNOFF');
    }
  }finally{await rm(env.dir,{recursive:true,force:true});}
});

test('held sources cannot receive review receipts or authorize lessons',async()=>{
  const env=await makeEnv();
  try{
    const pack=sample();
    pack.lessons=[];
    pack.sourceManifest[0].status='held';
    pack.sourceManifest[0].reason='Await original photo and educator review.';
    const template=buildPrivatePhotoReviewTemplate(pack);
    assert.deepEqual(template.receipts,[]);
    await writeFile(env.receiptPath,JSON.stringify(template));
    const output=await verifySchoolworkPhotoReviews(pack,env.photoDir,env.receiptPath,{repoRoot:env.repoRoot,asOfDay:'2026-10-11'});
    assert.equal(output.sources[0].status,'SOURCE_HELD');
    assert.equal(output.releaseStatus,'HOLD_EXTERNAL_SIGNOFF');
    template.receipts=reviewed(sample()).receipts;
    await writeFile(env.receiptPath,JSON.stringify(template));
    await assert.rejects(
      verifySchoolworkPhotoReviews(pack,env.photoDir,env.receiptPath,{repoRoot:env.repoRoot,asOfDay:'2026-10-11'}),
      /unknown or held source/
    );
  }finally{await rm(env.dir,{recursive:true,force:true});}
});

test('malformed and duplicate private receipts are rejected, without exposing their contents',async()=>{
  const env=await makeEnv();
  try{
    const pack=sample();
    await writeFile(path.join(env.photoDir,'worksheet.jpeg'),'photo-bytes');
    const duplicate=reviewed(pack);
    duplicate.receipts.push({...duplicate.receipts[0]});
    await writeFile(env.receiptPath,JSON.stringify(duplicate));
    await assert.rejects(verifySchoolworkPhotoReviews(pack,env.photoDir,env.receiptPath,{repoRoot:env.repoRoot,asOfDay:'2026-10-11'}),/Duplicate source review receipt/);
    const extra=reviewed(pack);extra.receipts[0].privateAnswer='SYNTHETIC_PRIVATE_ANSWER';
    await writeFile(env.receiptPath,JSON.stringify(extra));
    await assert.rejects(verifySchoolworkPhotoReviews(pack,env.photoDir,env.receiptPath,{repoRoot:env.repoRoot,asOfDay:'2026-10-11'}),/unknown field privateAnswer/);
  }finally{await rm(env.dir,{recursive:true,force:true});}
});

test('private photo and receipt paths cannot point inside the public repository',async()=>{
  const env=await makeEnv();
  try{
    const pack=sample();
    await writeFile(path.join(env.photoDir,'worksheet.jpeg'),'photo-bytes');
    await writeFile(env.receiptPath,JSON.stringify(reviewed(pack)));
    await assert.rejects(verifySchoolworkPhotoReviews(pack,env.repoRoot,env.receiptPath,{repoRoot:env.repoRoot,asOfDay:'2026-10-11'}),/outside the public ABVM repository/);
    const inside=path.join(env.repoRoot,'review.json');
    await writeFile(inside,JSON.stringify(reviewed(pack)));
    await assert.rejects(verifySchoolworkPhotoReviews(pack,env.photoDir,inside,{repoRoot:env.repoRoot,asOfDay:'2026-10-11'}),/outside the public ABVM repository/);
    const malicious=sample();
    malicious.sourceManifest[0].id='..';
    malicious.lessons[0].sources=['..'];
    assert.throws(()=>validateSchoolwork(malicious,{requireManifest:true}),/Invalid non-identifying source ID/);
  }finally{await rm(env.dir,{recursive:true,force:true});}
});

test('symlinked originals cannot substitute unapproved files',{skip:process.platform==='win32'},async()=>{
  const env=await makeEnv();
  try{
    const pack=sample(),elsewhere=path.join(env.dir,'elsewhere.jpeg');
    await writeFile(elsewhere,'photo-bytes');
    await symlink(elsewhere,path.join(env.photoDir,'worksheet.jpeg'));
    await writeFile(env.receiptPath,JSON.stringify(reviewed(pack)));
    const report=await verifySchoolworkPhotoReviews(pack,env.photoDir,env.receiptPath,{repoRoot:env.repoRoot,asOfDay:'2026-10-11'});
    assert.equal(report.sources[0].status,'UNSAFE_PHOTO_FILE');
  }finally{await rm(env.dir,{recursive:true,force:true});}
});

test('default review date follows the New York school day across UTC midnight',()=>{
  assert.equal(newYorkSchoolDay(new Date('2026-10-12T01:00:00Z')),'2026-10-11');
  assert.equal(newYorkSchoolDay(new Date('2026-10-12T04:05:00Z')),'2026-10-12');
});
