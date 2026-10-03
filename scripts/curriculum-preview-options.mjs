import { resolve } from 'node:path';

export function parseCurriculumPreviewOptions(argv = [], {
  productionDataPath,
  curriculumFamilies = [],
} = {}) {
  const args = Array.isArray(argv) ? argv.map(String) : [];
  const flagArgs = args.filter(arg => arg.startsWith('--curriculum-feature-flag='));
  const rawFlags = flagArgs.map(arg => arg.slice('--curriculum-feature-flag='.length).trim());
  if (rawFlags.some(flag => !flag)) {
    throw new Error('Curriculum feature flags cannot be empty.');
  }
  const activeCurriculumFeatureFlags = [...new Set(rawFlags)].sort();
  if (activeCurriculumFeatureFlags.length !== rawFlags.length) {
    throw new Error('Curriculum feature flags cannot be duplicated.');
  }

  const candidateFlags = new Set(
    (Array.isArray(curriculumFamilies) ? curriculumFamilies : [])
      .filter(family => family?.rolloutStatus === 'CANDIDATE' && family?.enabledByDefault === false)
      .map(family => String(family?.featureFlag || '').trim())
      .filter(Boolean)
  );
  const invalidPreviewFlags = activeCurriculumFeatureFlags.filter(flag => !candidateFlags.has(flag));
  if (invalidPreviewFlags.length) {
    throw new Error(`Curriculum preview flags must identify disabled CANDIDATE families: ${invalidPreviewFlags.join(', ')}`);
  }

  const outputArgs = args.filter(arg => arg.startsWith('--curriculum-preview-output='));
  if (outputArgs.length > 1) throw new Error('Curriculum preview output may be specified only once.');
  const rawOutput = outputArgs[0]?.slice('--curriculum-preview-output='.length).trim() || '';
  if (outputArgs.length && !rawOutput) throw new Error('Curriculum preview output path cannot be empty.');
  if (activeCurriculumFeatureFlags.length && !rawOutput) {
    throw new Error('Candidate curriculum feature flags require --curriculum-preview-output=...; production study-pack output stays fail-closed.');
  }

  const curriculumPreviewOutput = rawOutput ? resolve(rawOutput) : '';
  if (curriculumPreviewOutput && productionDataPath && curriculumPreviewOutput === resolve(String(productionDataPath))) {
    throw new Error('Curriculum preview output cannot overwrite the production study pack.');
  }

  return Object.freeze({
    activeCurriculumFeatureFlags: Object.freeze(activeCurriculumFeatureFlags),
    curriculumPreviewOutput,
  });
}
