import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareReviewedLunch} from '../scripts/refresh-reviewed-lunch.mjs';
import {schoolWeek, validateLunchPublication} from '../scripts/lunch-publication.mjs';

const now = new Date('2026-10-13T14:00:00Z');
const offline = async () => { throw new Error('Provider unavailable'); };
function fixture() {
  return {
    delivery: 'verified',
    sourceLastCheckedAt: '2026-10-08T15:00:17.769Z',
    sourcePages: [{title: 'Reading Work', contentHash: 'a'.repeat(64)}],
    pack: {
      sourceHash: 'teacher-pages-43dda9e1caba8dc64b2e',
      sourceCheckedAt: '2026-10-08T15:00:17.769Z',
      sourceSufficient: true,
      importantDates: [{date: 'Tuesday, Oct. 20', label: 'No school for Grade 2'}],
      parentNotices: [{sourceId: 'melissa-review', text: 'Reviewed date'}],
      subjects: [{subject: 'Reading / ELA'}],
      lunchMenu: [{date: '2026-10-05', items: ['Older reviewed menu'], sourceId: 'old'}],
      lunchMenuSource: {weekStart: '2026-10-05', weekEnd: '2026-10-09', retrievalState: 'unavailable'},
    },
  };
}
test('independently rolls to Oct 12–16 without changing educator-held teacher or parent records', async () => {
  const original = fixture();
  const {document, changed, result} = await prepareReviewedLunch(original, {now, fetchImpl: offline});
  assert.equal(changed, true);
  assert.equal(result.verified, false);
  assert.deepEqual(schoolWeek(now), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']);
  assert.equal(document.pack.lunchMenuSource.weekStart, '2026-10-12');
  assert.equal(document.pack.lunchMenu.find(m => m.date === '2026-10-12').status, 'no-school');
  assert.deepEqual(document.pack.lunchMenu.find(m => m.date === '2026-10-13').items,
    ['Meatballs in sauce', 'Whole-grain buttered pasta', 'Steamed corn', 'Fruit']);
  assert.equal(document.pack.lunchMenuSource.retrievalState, 'unavailable');
  assert.deepEqual(validateLunchPublication(document.pack, {now}), []);
  assert.equal(document.sourceLastCheckedAt, original.sourceLastCheckedAt);
  assert.equal(document.pack.sourceCheckedAt, original.pack.sourceCheckedAt);
  assert.deepEqual(document.pack.importantDates, original.pack.importantDates);
  assert.deepEqual(document.pack.parentNotices, original.pack.parentNotices);
  assert.deepEqual(original.pack.lunchMenu.map(m => m.date), ['2026-10-05']);
});
test('same current-week evidence does not emit repeated heartbeat edits', async () => {
  const first = await prepareReviewedLunch(fixture(), {now, fetchImpl: offline});
  const second = await prepareReviewedLunch(first.document,
    {now: new Date('2026-10-13T15:00:00Z'), fetchImpl: offline});
  assert.equal(second.changed, false);
  assert.deepEqual(second.document, first.document);
});
test('official bytes checked today are recorded as verified without renewing teacher freshness', async () => {
  const directSource = async () => new Response(new Uint8Array([1, 2, 3]), {
    headers: {'content-type': 'image/heic'},
  });
  const {document, result} = await prepareReviewedLunch(fixture(), {now, fetchImpl: directSource});
  assert.equal(result.verified, true);
  assert.equal(document.pack.lunchMenuSource.retrievalState, 'verified');
  assert.equal(document.pack.lunchMenuSource.checkedAt, now.toISOString());
  assert.equal(document.sourceLastCheckedAt, '2026-10-08T15:00:17.769Z');
  assert.deepEqual(validateLunchPublication(document.pack, {now}), []);
});
test('transient outage never downgrades an already-verified current-week proof', async () => {
  const directSource = async () => new Response(new Uint8Array([4, 5, 6]), {
    headers: {'content-type': 'image/heic'},
  });
  const first = await prepareReviewedLunch(fixture(), {now, fetchImpl: directSource});
  const second = await prepareReviewedLunch(first.document,
    {now: new Date('2026-10-13T15:00:00Z'), fetchImpl: offline});
  assert.equal(second.changed, false);
  assert.equal(second.result.preservedVerifiedProof, true);
  assert.equal(second.document.pack.lunchMenuSource.retrievalState, 'verified');
});
test('unknown future week exposes gaps rather than inventing meals', async () => {
  const future = new Date('2026-11-02T15:00:00Z');
  const {document} = await prepareReviewedLunch(fixture(), {now: future, fetchImpl: offline});
  assert.deepEqual(document.pack.lunchMenu, []);
  assert.deepEqual(document.pack.lunchMenuSource.missingDates, schoolWeek(future));
  assert.deepEqual(validateLunchPublication(document.pack, {now: future}), []);
});
test('rejects invalid source packs before attempting any update', async () => {
  await assert.rejects(prepareReviewedLunch({delivery: 'unreviewed', pack: {}}, {now, fetchImpl: offline}), /verified school pack/);
});
