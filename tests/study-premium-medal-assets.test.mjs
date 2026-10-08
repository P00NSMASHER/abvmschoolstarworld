import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync(new URL('../docs/ABVM_PREMIUM_MEDAL_RELEASE_MANIFEST.json',import.meta.url)));
const old=manifest.original_unchanged_sha256, fresh=manifest.new_384px_webp_sha256;
test('all 22 premium rank medals exist, have exact approved bytes, and preserve the original seven',()=>{
 assert.equal(Object.keys(old).length,7);
 assert.equal(Object.keys(fresh).length,15);
 const sums=new Set();
 for(const [filename,expected] of Object.entries({...old,...fresh})){
  const path=new URL('../pages/assets/badges/'+filename,import.meta.url);
  assert.ok(existsSync(path),filename+' is required before merging');
  const data=readFileSync(path);
  assert.equal(data.toString('ascii',0,4),'RIFF',filename+' RIFF header');
  assert.equal(data.toString('ascii',8,12),'WEBP',filename+' WebP header');
  const actual=createHash('sha256').update(data).digest('hex');
  assert.equal(actual,expected,filename+' differs from the approved asset');
  assert.ok(!sums.has(actual),filename+' duplicates another emblem');
  sums.add(actual);
 }
});
