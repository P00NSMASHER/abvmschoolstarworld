import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCurriculumPreviewOptions } from '../scripts/curriculum-preview-options.mjs';

const families = [
  { featureFlag:'curriculum-family:approved', rolloutStatus:'APPROVED', enabledByDefault:true },
  { featureFlag:'curriculum-family:characters-candidate', rolloutStatus:'CANDIDATE', enabledByDefault:false },
];

test('candidate preview options stay empty by default', () => {
  assert.deepEqual(parseCurriculumPreviewOptions([], {
    productionDataPath:'/repo/pages/data/study-pack.json',
    curriculumFamilies:families,
  }), {
    activeCurriculumFeatureFlags:[],
    curriculumPreviewOutput:'',
  });
});

test('candidate preview requires exact disabled candidate flag and separate output', () => {
  const result=parseCurriculumPreviewOptions([
    '--curriculum-feature-flag=curriculum-family:characters-candidate',
    '--curriculum-preview-output=.tmp/characters-preview.json',
  ], {
    productionDataPath:'/repo/pages/data/study-pack.json',
    curriculumFamilies:families,
  });
  assert.deepEqual([...result.activeCurriculumFeatureFlags], ['curriculum-family:characters-candidate']);
  assert.ok(result.curriculumPreviewOutput.replaceAll('\\','/').endsWith('/.tmp/characters-preview.json'));
});

test('candidate preview rejects unknown, approved, empty, duplicate, and unscoped flags', () => {
  const options={productionDataPath:'/repo/pages/data/study-pack.json',curriculumFamilies:families};
  assert.throws(() => parseCurriculumPreviewOptions([
    '--curriculum-feature-flag=curriculum-family:missing',
    '--curriculum-preview-output=.tmp/out.json',
  ], options), /disabled CANDIDATE/);
  assert.throws(() => parseCurriculumPreviewOptions([
    '--curriculum-feature-flag=curriculum-family:approved',
    '--curriculum-preview-output=.tmp/out.json',
  ], options), /disabled CANDIDATE/);
  assert.throws(() => parseCurriculumPreviewOptions([
    '--curriculum-feature-flag=',
    '--curriculum-preview-output=.tmp/out.json',
  ], options), /cannot be empty/);
  assert.throws(() => parseCurriculumPreviewOptions([
    '--curriculum-feature-flag=curriculum-family:characters-candidate',
    '--curriculum-feature-flag=curriculum-family:characters-candidate',
    '--curriculum-preview-output=.tmp/out.json',
  ], options), /cannot be duplicated/);
  assert.throws(() => parseCurriculumPreviewOptions([
    '--curriculum-feature-flag=curriculum-family:characters-candidate',
  ], options), /require --curriculum-preview-output/);
});

test('candidate preview cannot overwrite production pack or accept ambiguous outputs', () => {
  const production='/repo/pages/data/study-pack.json';
  const options={productionDataPath:production,curriculumFamilies:families};
  assert.throws(() => parseCurriculumPreviewOptions([
    '--curriculum-feature-flag=curriculum-family:characters-candidate',
    `--curriculum-preview-output=${production}`,
  ], options), /cannot overwrite the production study pack/);
  assert.throws(() => parseCurriculumPreviewOptions([
    '--curriculum-preview-output=.tmp/a.json',
    '--curriculum-preview-output=.tmp/b.json',
  ], options), /only once/);
});
