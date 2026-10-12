import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,rm,stat,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {renderSchoolworkReviewWorkbook,reviewWorkbookFingerprint,createPrivateSchoolworkReviewWorkbook} from '../scripts/build-schoolwork-review-workbook.mjs';

const load=async()=>JSON.parse(await readFile(new URL('../pages/data/schoolwork.json',import.meta.url),'utf8'));
const env=async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'abvm-offline-review-'));
  const repoRoot=path.join(dir,'public-repo');
  await mkdir(repoRoot);
  return {dir,repoRoot};
};
const rekey=value=>Array.isArray(value)?value.map(rekey):
  value&&typeof value==='object'
    ?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,rekey(item)]))
    :value;

test('existing 23/13/67 public library renders every practice question once and lists every source',async()=>{
  const pack=await load();
  const before=JSON.stringify(pack);
  const html=renderSchoolworkReviewWorkbook(pack);
  assert.equal(JSON.stringify(pack),before);
  assert.equal((html.match(/class="question" data-question-id=/g)||[]).length,67);
  assert.equal((html.match(/class="lesson" id="lesson-/g)||[]).length,13);
  for(const source of pack.sourceManifest){
    assert(html.includes(source.id),source.id);
    assert(html.includes(source.sha256),source.id+' SHA-256');
  }
  assert.match(html,/HOLD_EXTERNAL_SIGNOFF/);
  assert.match(html,/not necessarily literal worksheet questions/);
  assert.match(html,/This does NOT establish that every practice question is printed in each photo/);
  assert.match(html,/No original photos, child responses, teacher marks/);
  assert.doesNotMatch(html,/<script\b|<img\b|https?:\/\/|<iframe\b|<form\b/i);
  assert.equal(reviewWorkbookFingerprint(pack).length,64);
});

test('reordering serialized JSON keys does not change the workbook or its fingerprint',async()=>{
  const pack=await load();
  assert.equal(renderSchoolworkReviewWorkbook(pack),renderSchoolworkReviewWorkbook(rekey(pack)));
  assert.equal(reviewWorkbookFingerprint(pack),reviewWorkbookFingerprint(rekey(pack)));
});

test('changing a reviewed answer explanation or photo SHA changes the content fingerprint',async()=>{
  const pack=await load(),fingerprint=reviewWorkbookFingerprint(pack);
  const modified=structuredClone(pack);
  modified.lessons[0].questions[0].explanation+=' Verify by counting backward.';
  assert.notEqual(reviewWorkbookFingerprint(modified),fingerprint);
  const newPhoto=structuredClone(pack);
  newPhoto.sourceManifest[0].sha256='a'.repeat(64);
  assert.notEqual(reviewWorkbookFingerprint(newPhoto),fingerprint);
});

test('untrusted but schema-allowed educational text is safely HTML escaped',async()=>{
  const pack=await load();
  pack.lessons[0].title='<img src=x onerror=alert(1)>';
  pack.lessons[0].questions[0].prompt='Which is <script>alert(1)</script>?';
  pack.lessons[0].notes.push('Remember 2 < 3 & 4 > 1.');
  const html=renderSchoolworkReviewWorkbook(pack);
  assert.doesNotMatch(html,/<img\b|<script\b/i);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html,/2 &lt; 3 &amp; 4 &gt; 1/);
});

test('unknown private observation fields are rejected before rendering',async()=>{
  const pack=await load();
  pack.lessons[0].privateAnswers=['Never include this'];
  assert.throws(()=>renderSchoolworkReviewWorkbook(pack),/unknown field privateAnswers/);
});

test('held sources stay visible without giving them new lessons or questions',async()=>{
  const pack=await load();
  pack.sourceManifest.push({id:'held-review.jpeg',sha256:'b'.repeat(64),status:'held',reason:'Await photo review.'});
  pack.uploadedPhotoCount++;
  const html=renderSchoolworkReviewWorkbook(pack);
  assert.match(html,/held-review\.jpeg/);
  assert.match(html,/HELD — no content permitted/);
  assert.equal((html.match(/class="question" data-question-id=/g)||[]).length,67);
});

test('private output file uses owner-only permissions and refuses overwrite',{skip:process.platform==='win32'},async()=>{
  const {dir,repoRoot}=await env();
  try{
    const target=path.join(dir,'private','review.html'),pack=await load();
    const result=await createPrivateSchoolworkReviewWorkbook(pack,target,{repoRoot});
    assert.deepEqual([result.photos,result.lessons,result.questions],[23,13,67]);
    assert.equal(result.releaseStatus,'HOLD_EXTERNAL_SIGNOFF');
    assert.equal((await stat(target)).mode&0o777,0o600);
    const original=await readFile(target,'utf8');
    await assert.rejects(createPrivateSchoolworkReviewWorkbook(pack,target,{repoRoot}),/already exists/);
    assert.equal(await readFile(target,'utf8'),original);
    assert.deepEqual(await readdir(path.dirname(target)),['review.html']);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('public, relative and symlinked public workbook destinations are denied',{skip:process.platform==='win32'},async()=>{
  const {dir,repoRoot}=await env();
  try{
    const pack=await load();
    await assert.rejects(createPrivateSchoolworkReviewWorkbook(pack,path.join(repoRoot,'review.html'),{repoRoot}),
      /outside the public ABVM repository/);
    await assert.rejects(createPrivateSchoolworkReviewWorkbook(pack,'review.html',{repoRoot}),
      /absolute private/);
    const alias=path.join(dir,'external-alias');
    await symlink(repoRoot,alias,'dir');
    await assert.rejects(createPrivateSchoolworkReviewWorkbook(pack,path.join(alias,'review.html'),{repoRoot}),
      /outside the public ABVM repository/);
    assert.deepEqual(await readdir(repoRoot),[]);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('invalid answers cannot produce an output file',async()=>{
  const {dir,repoRoot}=await env();
  try{
    const pack=await load();
    pack.lessons[0].questions[0].answer='NOT A CHOICE';
    const dest=path.join(dir,'private','review.html');
    await assert.rejects(createPrivateSchoolworkReviewWorkbook(pack,dest,{repoRoot}),
      /answer must occur exactly once/);
    await assert.rejects(stat(dest),error=>error.code==='ENOENT');
  }finally{await rm(dir,{recursive:true,force:true});}
});
