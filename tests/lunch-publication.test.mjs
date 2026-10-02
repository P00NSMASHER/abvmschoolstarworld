import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CATALOG, LUNCH_FEED_URL, catalogMeals, schoolWeek, validateLunchFeed, verifyCatalogSources, refreshLunchPublication, validateLunchPublication } from '../scripts/lunch-publication.mjs';

const now = new Date('2026-09-29T12:00:00Z');
const meals = catalogMeals().filter(m => schoolWeek(now).includes(m.date));
function validFeed() {
  return {
    schemaVersion: 2, source: CATALOG.provider, school: CATALOG.school,
    weekStart: '2026-09-28', weekEnd: '2026-10-02',
    lunchMenu: meals.map(({ date, items, sourceId }) => ({ date, items, sourceId })),
    retrievalState: 'verified', sourceCheckedAt: now.toISOString(),
    missingDates: [], pendingDocuments: [], gaps: [],
    sourcePages: CATALOG.sources.map(s => ({ id: s.id, url: s.url, contentHash: s.contentHash, checkedAt: now.toISOString(), state: 'verified' })),
  };
}
const mock = data => async () => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

test('keeps the AppDeploy endpoint only as a bridge fallback', () => {
  assert.equal(new URL(LUNCH_FEED_URL).origin, 'https://api-v2.appdeploy.ai');
  assert.match(LUNCH_FEED_URL, /\/app\/abvm-source-bridge-gkj08k\/api\/lunch-menu$/);
});

test('direct verification checks official source bytes and pinned URLs without the bridge', async () => {
  const pdfUrl = 'https://resources.finalsite.net/test/reviewed-menu.pdf';
  const imageUrl = 'https://resources.finalsite.net/test/reviewed-menu.heic';
  const pdfBytes = new TextEncoder().encode('reviewed official pdf bytes');
  const imageBytes = new TextEncoder().encode('reachable pinned image');
  const directCatalog = {
    schemaVersion: 1,
    school: CATALOG.school,
    provider: CATALOG.provider,
    parentResourcesUrl: CATALOG.parentResourcesUrl,
    sources: [
      {
        id: 'direct-pdf',
        url: pdfUrl,
        contentHash: createHash('sha256').update(pdfBytes).digest('hex'),
        reviewedAt: '2026-09-29T05:26:39Z',
        coverageStart: '2026-09-28',
        coverageEnd: '2026-09-30',
        meals: [
          { date: '2026-09-28', items: ['Meal 1'] },
          { date: '2026-09-29', items: ['Meal 2'] },
          { date: '2026-09-30', items: ['Meal 3'] },
        ],
      },
      {
        id: 'direct-image',
        url: imageUrl,
        proofMode: 'pinned-url',
        contentHash: createHash('sha256').update(imageUrl).digest('hex'),
        reviewedAt: '2026-10-01T00:44:00Z',
        coverageStart: '2026-10-01',
        coverageEnd: '2026-10-02',
        meals: [
          { date: '2026-10-01', items: ['Meal 4'] },
          { date: '2026-10-02', items: ['Meal 5'] },
        ],
      },
    ],
  };
  const seen = [];
  const fetchImpl = async url => {
    seen.push(String(url));
    const isPdf = String(url) === pdfUrl;
    return new Response(isPdf ? pdfBytes : imageBytes, {
      status: 200,
      headers: { 'content-type': isPdf ? 'application/pdf' : 'image/heic' },
    });
  };
  const feed = await verifyCatalogSources({ fetchImpl, now, catalog: directCatalog });
  assert.equal(feed.retrievalState, 'verified');
  assert.equal(feed.verificationMode, 'direct-official-source');
  assert.deepEqual(seen, [pdfUrl, imageUrl]);
  assert.deepEqual(feed.missingDates, []);
  assert.ok(feed.sourcePages.every(page => page.state === 'verified' && page.checkedAt === now.toISOString()));
  assert.equal(validateLunchFeed(feed, { now, catalog: directCatalog }).expected.length, 5);
});

test('complete reviewed rows and exact source hashes are required', () => {
  assert.equal(validateLunchFeed(validFeed(), { now }).expected.length, 5);
  const changed = validFeed(); changed.lunchMenu[1].items = ['Invented pizza'];
  assert.throws(() => validateLunchFeed(changed, { now }), /mismatched/);
  const wrongSource = validFeed(); wrongSource.sourcePages[0].contentHash = 'a'.repeat(64);
  assert.throws(() => validateLunchFeed(wrongSource, { now }), /proof mismatch/);
  const dropped = validFeed(); dropped.lunchMenu.pop();
  assert.throws(() => validateLunchFeed(dropped, { now }), /dropped/);
});
test('wrong-week, impossible-date and empty success responses are rejected', () => {
  const old = validFeed(); old.weekStart = '2026-09-21';
  assert.throws(() => validateLunchFeed(old, { now }), /week mismatch/);
  const impossible = validFeed(); impossible.lunchMenu[0].date = '2026-09-31';
  assert.throws(() => validateLunchFeed(impossible, { now }), /Unreviewed/);
  const empty = validFeed(); empty.lunchMenu = [];
  assert.throws(() => validateLunchFeed(empty, { now }), /dropped/);
});
test('refresh publishes meals, archive and a reproducible content receipt', async () => {
  const pack = {};
  const result = await refreshLunchPublication(pack, { now, fetchImpl: mock(validFeed()) });
  assert.equal(result.verified, true);
  assert.deepEqual(pack.lunchMenu.map(m => m.date), ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  assert.equal(pack.lunchArchive.length, catalogMeals().length);
  assert.deepEqual(validateLunchPublication(pack, { now }), []);
  pack.lunchMenu[1] = { ...pack.lunchMenu[1], items: ['Wrong lunch'] };
  assert.match(validateLunchPublication(pack, { now }).join(' '), /changed a reviewed meal/);
});
test('HTTP error, HTML, malformed JSON and empty feed never erase reviewed meals', async () => {
  const failures = [
    async () => { throw new Error('Network timeout'); },
    async () => new Response('<html>App shell</html>', { headers: { 'content-type': 'text/html' } }),
    async () => new Response('not-json', { headers: { 'content-type': 'application/json' } }),
    mock({ ...validFeed(), lunchMenu: [] }),
  ];
  for (const fetchImpl of failures) {
    const previousCheck = '2026-09-28T20:30:00Z';
    const pack = {
      lunchMenuSource: {
        checkedAt: previousCheck,
        sourcePages: CATALOG.sources.map(source => ({ id: source.id, checkedAt: previousCheck })),
      },
    };
    await refreshLunchPublication(pack, { now, fetchImpl });
    assert.equal(pack.lunchMenu.length, 5);
    assert.equal(pack.lunchMenuSource.retrievalState, 'unavailable');
    assert.equal(pack.lunchMenuSource.checkedAt, previousCheck);
    assert.equal(pack.lunchMenuSource.lastAttemptAt, now.toISOString());
    assert.ok(pack.lunchMenuSource.sourcePages.every(proof => proof.checkedAt === previousCheck));
    assert.deepEqual(validateLunchPublication(pack, { now }), []);
  }
});
test('next reviewed October week publishes exact meals even when live source check is unavailable', async () => {
  const next = new Date('2026-10-05T12:00:00Z');
  const pack = {};
  await refreshLunchPublication(pack, { now: next, fetchImpl: async () => { throw new Error('Unavailable'); } });
  assert.deepEqual(pack.lunchMenu.map(m => m.date), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
  assert.equal(pack.lunchMenu.at(-1).items[0], 'No lunch — noon dismissal');
  assert.equal(pack.lunchMenuSource.status, 'current-week');
  assert.equal(pack.lunchMenuSource.retrievalState, 'unavailable');
  assert.deepEqual(pack.lunchMenuSource.missingDates, []);
  assert.equal(pack.lunchArchive.length, catalogMeals().length);
  assert.deepEqual(validateLunchPublication(pack, { now: next }), []);
  assert.deepEqual(schoolWeek(new Date('2027-01-01T12:00:00Z')), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01']);
});


test('October catalog covers every printed weekday through Oct. 30', () => {
  const rows = catalogMeals().filter(m => m.date.startsWith('2026-10-'));
  assert.equal(rows.length, 22);
  assert.equal(rows.find(m => m.date === '2026-10-09').items[0], 'No lunch — noon dismissal');
  assert.equal(rows.find(m => m.date === '2026-10-12').status, 'no-school');
  assert.equal(rows.at(-1).date, '2026-10-30');
});

test('pinned image source proof is recomputed from its exact URL', () => {
  const changed = structuredClone(CATALOG);
  const october = changed.sources.find(source => source.proofMode === 'pinned-url');
  assert.ok(october);
  october.contentHash = 'a'.repeat(64);
  assert.throws(() => catalogMeals(changed), /Invalid pinned lunch source proof/);
});


test('transient verification outage keeps per-source proof for the published current week', async () => {
  const previousCheck = '2026-09-28T20:30:00Z';
  const pack = {
    lunchMenuSource: {
      checkedAt: previousCheck,
      sourcePages: CATALOG.sources.map(source => ({ id: source.id, checkedAt: previousCheck })),
    },
  };
  await refreshLunchPublication(pack, { now, fetchImpl: async () => { throw new Error('Temporary outage'); } });
  const usedSourceIds = new Set(pack.lunchMenu.map(meal => meal.sourceId));
  const publishedProofs = pack.lunchMenuSource.sourcePages.filter(proof => usedSourceIds.has(proof.id));
  assert.ok(publishedProofs.length > 0);
  assert.ok(publishedProofs.every(proof => proof.checkedAt === previousCheck));
});
