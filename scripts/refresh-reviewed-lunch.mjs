import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  refreshLunchPublication,
  validateLunchPublication,
} from './lunch-publication.mjs';

const DATA_PATH = new URL('../pages/data/study-pack.json', import.meta.url);
const LUNCH_FIELDS = ['lunchMenu', 'lunchArchive', 'lunchMenuSource', 'lunchMenuHash'];

function withoutLunch(document) {
  const copy = structuredClone(document);
  for (const key of LUNCH_FIELDS) delete copy.pack[key];
  return JSON.stringify(copy);
}

function meaningfulLunchState(pack) {
  const source = pack.lunchMenuSource || {};
  return JSON.stringify({
    menu: pack.lunchMenu || [],
    archive: pack.lunchArchive || [],
    school: source.school,
    provider: source.provider,
    weekStart: source.weekStart,
    weekEnd: source.weekEnd,
    retrievalState: source.retrievalState,
    missingDates: source.missingDates || [],
    proofSources: (source.sourcePages || []).map(p => ({
      id: p.id, url: p.url, contentHash: p.contentHash, reviewedAt: p.reviewedAt,
    })),
  });
}

export async function prepareReviewedLunch(document, {now = new Date(), fetchImpl = fetch} = {}) {
  if (document?.delivery !== 'verified' || !document?.pack || typeof document.pack !== 'object') {
    throw new Error('Only an existing, verified school pack may receive a reviewed lunch-week update');
  }
  const next = structuredClone(document);
  const protectedBefore = withoutLunch(document);
  const oldState = meaningfulLunchState(document.pack);
  const result = await refreshLunchPublication(next.pack, {now, fetchImpl});

  const errors = validateLunchPublication(next.pack, {now});
  if (errors.length) throw new Error('Reviewed lunch validation failed: ' + errors.join('; '));
  if (withoutLunch(next) !== protectedBefore) {
    throw new Error('Teacher, calendar, learner, curriculum or source-clock data changed');
  }

  const oldSource = document.pack.lunchMenuSource || {};
  const newSource = next.pack.lunchMenuSource || {};
  const sameWeek = oldSource.weekStart === newSource.weekStart
    && oldSource.weekEnd === newSource.weekEnd;
  if (sameWeek && oldSource.retrievalState === 'verified' && !result.verified
      && validateLunchPublication(document.pack, {now}).length === 0) {
    return {document, changed: false, result: {...result, preservedVerifiedProof: true}};
  }
  if (oldState === meaningfulLunchState(next.pack)) {
    // Do not create a new commit just because checkedAt/lastAttemptAt advanced.
    return {document, changed: false, result};
  }
  return {document: next, changed: true, result};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  const {document, changed, result} = await prepareReviewedLunch(source);
  if (changed && process.argv.includes('--write')) {
    writeFileSync(DATA_PATH, JSON.stringify(document, null, 2) + '\n');
  }
  console.log(JSON.stringify({
    lane: 'reviewed-lunch-only',
    changed,
    writeRequested: process.argv.includes('--write'),
    weekStart: document.pack.lunchMenuSource?.weekStart,
    weekEnd: document.pack.lunchMenuSource?.weekEnd,
    reviewedRows: document.pack.lunchMenu?.length || 0,
    officialSourceVerifiedNow: result.verified,
    teacherLastCheckedAt: document.sourceLastCheckedAt,
    teacherSourceHash: document.pack.sourceHash,
    teacherSourceClockRenewed: false,
    educatorHoldAffected: false,
    missingDates: document.pack.lunchMenuSource?.missingDates || [],
  }, null, 2));
}
