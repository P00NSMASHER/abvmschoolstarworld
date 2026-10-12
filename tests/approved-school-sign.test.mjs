import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const p=new URL('../pages/assets/school/abvm-school-sign.webp',import.meta.url);
const bytes=readFileSync(p);
const approvedSha256='e0ba8feebe0ca8484492a85f686d64774ad6603a846469d7a29b584912d4ff11';

test('Howard Avenue sign matches the exact previously approved bytes',()=>{
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(bytes.readUInt32LE(4)+8,bytes.length,'truncated RIFF must be rejected');
  assert.equal(bytes.length,24164);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),approvedSha256);
});

test('the source manifest still records the same approved sign digest',()=>{
  const readme=readFileSync(new URL('../pages/assets/school/README.md',import.meta.url),'utf8');
  assert.ok(readme.includes('- sign: `'+approvedSha256+'`'));
});
