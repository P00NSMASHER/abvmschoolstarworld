import assert from 'node:assert/strict';
import test from 'node:test';
import {buildCurriculumCoveragePlan} from '../scripts/curriculum-coverage-autopilot.mjs';
import {assertSafeTeacherRefresh} from '../scripts/assert-safe-teacher-refresh.mjs';

const checkedAt = '2026-10-14T22:40:00.000Z';
const sourceHash = 'teacher-pages-' + 'a'.repeat(20);
const pageNames = ['Home', 'Homework', 'Reading Work', 'Weekly Spelling List', 'Tests', 'Religion'];
function fixture({gap = true} = {}) {
  const pages = pageNames.map((title, index) => ({
    title,
    url: 'https://sites.google.com/view/abvmgr2/' + (index === 0 ? 'home' : index === 1 ? 'homework' : index === 2 ? 'reading-work' : index === 3 ? 'weekly-spelling-list' : index === 4 ? 'tests' : 'religion'),
    checkedAt,
    contentHash: (index + 1).toString(16).repeat(64),
    lines: index === 2 ? ['Reading Comprehension: main idea/details; charts'] : [title],
  }));
  const coverage = [
    {subject: 'Reading / ELA', topic: 'main idea/details', skillId: 'main-idea', status: 'COVERED'},
    ...(gap ? [{subject: 'Reading / ELA', topic: 'charts', status: 'GENERATOR_UNSUPPORTED'}] : []),
  ];
  const pipeline = {
    generatedAt: checkedAt,
    sourceHash,
    coverage,
    questions: [{
      id: 'reading-main-idea-1',
      skill: 'main-idea',
      sourceLineage: {
        quality: 'page-exact',
        sourceUrl: pages[2].url,
        sourceCaptureHash: pages[2].contentHash,
        sourceCheckedAt: checkedAt,
        evidenceExcerptHash: 'sha256:' + 'f'.repeat(64),
      },
    }],
    qa: {status: 'pass', questionCount: 1, unsupportedSkillCount: Number(gap), unresolvedLineageCount: 0},
  };
  const pack = {
    delivery: 'verified',
    sourceLastCheckedAt: checkedAt,
    sourcePages: pages,
    pack: {sourceSufficient: true, sourceHash, sourceCheckedAt: checkedAt, contentPipeline: pipeline},
  };
  const plan = structuredClone(buildCurriculumCoveragePlan({pipeline, sourcePages: pages, sourceHash, generatedAt: checkedAt}));
  return {pack, plan};
}

test('publishes checked teacher data despite held charts candidate, without publishing its questions', () => {
  const {pack, plan} = fixture();
  assert.equal(plan.unsupportedCount, 1);
  assert.equal(plan.candidates[0].enabledByDefault, false);
  assert.equal(plan.candidates[0].readiness.status, 'HOLD');
  assert.deepEqual(assertSafeTeacherRefresh(plan, pack), {unsupportedCount: 1, questionCount: 1});
});

test('still permits fully covered sources with no candidates', () => {
  const {pack, plan} = fixture({gap: false});
  assert.deepEqual(assertSafeTeacherRefresh(plan, pack), {unsupportedCount: 0, questionCount: 1});
});

test('rejects dishonest and unisolated curriculum coverage', () => {
  for (const mutate of [
    ({plan}) => { plan.unsupportedCount = 0; },
    ({plan}) => { plan.candidates[0].enabledByDefault = true; },
    ({plan}) => { plan.candidates[0].readiness.status = 'READY_FOR_MANUAL_PROMOTION'; },
    ({pack}) => { pack.pack.contentPipeline.qa.unsupportedSkillCount = 0; },
    ({pack}) => { pack.pack.contentPipeline.coverage[1].status = 'COVERED'; },
    ({pack}) => { pack.pack.contentPipeline.questions[0].skill = 'charts'; },
  ]) {
    const data = fixture();
    mutate(data);
    assert.throws(() => assertSafeTeacherRefresh(data.plan, data.pack), /Unsafe teacher refresh:/);
  }
});

test('rejects stale/mismatched source and question provenance', () => {
  for (const mutate of [
    ({pack}) => { pack.pack.sourceCheckedAt = '2026-10-08T15:00:00.000Z'; },
    ({pack}) => { pack.sourcePages[2].checkedAt = '2026-10-08T15:00:00.000Z'; },
    ({pack}) => { pack.sourcePages[2].contentHash = '0'.repeat(64); },
    ({pack}) => { pack.pack.contentPipeline.questions[0].sourceLineage.quality = 'unresolved'; },
    ({pack}) => { pack.pack.contentPipeline.questions[0].sourceLineage.sourceCheckedAt = '2026-10-08T15:00:00.000Z'; },
    ({pack}) => { pack.pack.contentPipeline.qa.status = 'fail'; },
    ({pack}) => { pack.sourcePages.pop(); },
    ({pack}) => { pack.pack.sourceHash = 'teacher-pages-' + 'b'.repeat(20); },
  ]) {
    const data = fixture();
    mutate(data);
    assert.throws(() => assertSafeTeacherRefresh(data.plan, data.pack), /Unsafe teacher refresh:/);
  }
});
