import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APPROVED_SHA256,SCHOOL_SIGN,TRUNCATED_MAIN_BLOB,RESTORED_SIGN_BLOB,
  verifyApprovedSchoolSignRestoration as verify} from '../scripts/verify-approved-school-sign-parity.mjs';

const valid=()=>({
  diff:`M\t${SCHOOL_SIGN}`,
  mainBlob:TRUNCATED_MAIN_BLOB,
  previewBlob:RESTORED_SIGN_BLOB,
  bytes:Buffer.from(readFileSync(new URL('../pages/assets/school/abvm-school-sign.webp',import.meta.url)))
});

test('only the exact manifest-approved WebP repair is accepted',()=>{
  assert.equal(verify(valid()).sha256,APPROVED_SHA256);
});
test('every other protected source change is rejected',()=>{
  assert.throws(()=>verify({...valid(),diff:`M\t${SCHOOL_SIGN}\nM\tpages/data/study-pack.json`}),/only the modified approved school-sign/);
  assert.throws(()=>verify({...valid(),diff:`M\tpages/assets/school/abvm-school-hero.webp`}),/only the modified approved school-sign/);
});
test('renamed, deleted or missing sign never qualifies as an approved repair',()=>{
  for(const diff of ['',`D\t${SCHOOL_SIGN}`,`A\t${SCHOOL_SIGN}`,`R100\told\t${SCHOOL_SIGN}`])
    assert.throws(()=>verify({...valid(),diff}),/only the modified approved school-sign/);
});
test('the baseline and reviewed image Git blobs are both pinned',()=>{
  assert.throws(()=>verify({...valid(),mainBlob:'0000'}),/baseline moved/);
  assert.throws(()=>verify({...valid(),previewBlob:'1111'}),/Git blob differs/);
});
test('truncation, RIFF corruption or a changed image byte fail closed',()=>{
  const original=valid();
  assert.throws(()=>verify({...original,bytes:original.bytes.subarray(0,-1)}),/length/);
  const header=Buffer.from(original.bytes);header.write('RIFF',8);
  assert.throws(()=>verify({...original,bytes:header}),/RIFF/);
  const mutated=Buffer.from(original.bytes);mutated[100]^=1;
  assert.throws(()=>verify({...original,bytes:mutated}),/approved manifest/);
});
