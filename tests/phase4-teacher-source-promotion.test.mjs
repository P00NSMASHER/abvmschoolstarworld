import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildRuntimePack} from '../scripts/build-runtime-pack.mjs';
import {validateGrade2ContentPipeline} from '../scripts/grade2-content-pipeline.mjs';
import {religionChapterScopes} from '../pages/study-hub-core.mjs';

// Read the WORKTREE pack deliberately, not the historical test fixture. This
// must pass both normal PR QA and fresh-teacher candidate QA after regeneration.
const envelope=JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url),'utf8'));
const pack=envelope.pack;
test('fresh teacher candidate retains only checked, source-bound content and current skill identities',()=>{
  const pipeline=pack.contentPipeline||{};
  assert.ok(pack.sourceHash && Array.isArray(pipeline.skills) && Array.isArray(pipeline.questions));
  assert.deepEqual(validateGrade2ContentPipeline(pipeline),[]);
  const ids=new Set(pipeline.skills.map(skill=>skill.id));
  assert.equal(ids.size,pipeline.skills.length,'unique current skills');
  assert.ok(pipeline.questions.every(q=>ids.has(q.skill)),'no stale question from an absent skill');
  assert.ok(pipeline.questions.every(q=>q.sourceLineage?.quality==='page-exact'),
    'published original questions require exact teacher-source lineage');
  const runtime=buildRuntimePack(envelope).pack;
  assert.equal(runtime.contentPipeline.questions.length,pipeline.questions.length);
  const full=new Map(pipeline.questions.map(q=>[q.id,q]));
  for(const q of runtime.contentPipeline.questions){
    const original=full.get(q.id);
    assert.ok(original,'runtime cannot create an unseen teacher question');
    assert.equal(q.skill,original.skill);
    assert.equal(q.subject,original.subject);
    assert.equal(Object.hasOwn(q,'sourceLineage'),false,'audit hashes never ship to public runtime');
    assert.deepEqual(q.sourceChapters||[],religionChapterScopes(original));
  }
});
