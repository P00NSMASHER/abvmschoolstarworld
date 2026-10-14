import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, UPLOADED_NOTICES, catalogMeals, validateLunchFeed, verifyCatalogSources } from '../scripts/lunch-publication.mjs';
import { validateUploadedNoticePolicy } from '../scripts/uploaded-notice-policy.mjs';

const now = new Date('2026-10-14T09:45:56Z');
const sourceId = 'abvm-2026-10-15-school-notice';
const documentId = 'lunch-revision-2026-10-15';

test('October 15 uses the privacy-reviewed school notice and preserves published sides', () => {
  const rows = catalogMeals().filter(meal => meal.date === '2026-10-15');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourceId, sourceId);
  assert.deepEqual(rows[0].items, ['Chicken patty on a roll', 'French fries', 'Mixed vegetables', 'Fruit']);

  const official = CATALOG.sources.find(source => source.id === 'abvm-2026-10-official');
  const amendment = CATALOG.sources.find(source => source.id === sourceId);
  assert.equal(official.meals.some(meal => meal.date === '2026-10-15'), false);
  assert.deepEqual(amendment.supersedes, { sourceId: official.id, date: '2026-10-15' });
  assert.equal(amendment.sourceDocument, documentId);
});

test('reviewed-notice provenance is cross-locked without publishing message PII', () => {
  assert.doesNotThrow(() => validateUploadedNoticePolicy(UPLOADED_NOTICES));
  const notice = UPLOADED_NOTICES.documents.find(document => document.id === documentId);
  const source = CATALOG.sources.find(candidate => candidate.id === sourceId);
  assert.ok(notice);
  assert.equal(notice.provenance.sourceContentHash, source.contentHash);
  assert.doesNotMatch(JSON.stringify(notice), /@|mthompson|recipient|schoolmessenger/i);

  const wrongHash = structuredClone(CATALOG);
  wrongHash.sources.find(candidate => candidate.id === sourceId).contentHash = 'a'.repeat(64);
  assert.throws(() => catalogMeals(wrongHash), /notice proof/);

  const wrongDocument = structuredClone(CATALOG);
  wrongDocument.sources.find(candidate => candidate.id === sourceId).sourceDocument = 'missing-notice';
  assert.throws(() => catalogMeals(wrongDocument), /notice proof/);
});

test('reviewed notice is verified locally while the official source remains directly checked', async () => {
  const seen = [];
  const feed = await verifyCatalogSources({
    now,
    fetchImpl: async url => {
      seen.push(String(url));
      return new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'image/heic' } });
    },
  });
  assert.equal(feed.verificationMode, 'direct-official-source+reviewed-notice');
  assert.equal(seen.length, 1);
  assert.equal(seen[0], CATALOG.sources.find(source => source.id === 'abvm-2026-10-official').url);

  const proof = feed.sourcePages.find(page => page.id === sourceId);
  assert.deepEqual(
    { sourceDocument: proof.sourceDocument, state: proof.state, contentHash: proof.contentHash },
    {
      sourceDocument: documentId,
      state: 'reviewed-notice',
      contentHash: CATALOG.sources.find(source => source.id === sourceId).contentHash,
    },
  );
  assert.equal(validateLunchFeed(feed, { now }).expected.length, 5);

  const tampered = structuredClone(feed);
  tampered.lunchMenu.find(meal => meal.date === '2026-10-15').items[0] = 'Hamburger on whole-grain roll';
  assert.throws(() => validateLunchFeed(tampered, { now }), /mismatched/);
});
