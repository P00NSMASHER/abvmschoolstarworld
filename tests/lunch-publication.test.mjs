import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, LUNCH_FEED_URL, catalogMeals, schoolWeek, validateLunchFeed, refreshLunchPublication, validateLunchPublication } from '../scripts/lunch-publication.mjs';

const now = new Date('2026-09-29T12:00:00Z');
const meals = catalogMeals().filter(m => schoolWeek(now).includes(m.date));
function validFeed() {
  return {
    schemaVersion: 2, source: CATALOG.provider, school: CATALOG.school,
    weekStart: '2026-09-28', weekEnd: '2026-10-02',
    lunchMenu: meals.map(({ date, items, sourceId }) => ({ date, items, sourceId })),
    retrievalState: 'verified', sourceCheckedAt: now.toISOString(),
    missingDates: ['2026-10-01', '2026-10-02'], pendingDocuments: [], gaps: [],
    sourcePages: CATALOG.sources.map(s => ({ id: s.id, url: s.url, contentHash: s.contentHash, checkedAt: now.toISOString(), state: 'verified' })),
  };
}
const mock = data => async () => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });

test('uses the actual AppDeploy API host, never the HTML website route', () => {
  assert.equal(new URL(LUNCH_FEED_URL).origin, 'https://api-v2.appdeploy.ai');
  assert.match(LUNCH_FEED_URL, /\/app\/abvm-source-bridge-gkj08k\/api\/lunch-menu$/);
});
test('complete reviewed rows and exact source hashes are required', () => {
  assert.equal(validateLunchFeed(validFeed(), { now }).expected.length, 3);
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
  assert.deepEqual(pack.lunchMenu.map(m => m.date), ['2026-09-28', '2026-09-29', '2026-09-30']);
  assert.equal(pack.lunchArchive.length, 22);
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
    const pack = { lunchMenuSource: { checkedAt: '2026-09-28T20:30:00Z' } };
    await refreshLunchPublication(pack, { now, fetchImpl });
    assert.equal(pack.lunchMenu.length, 3);
    assert.equal(pack.lunchMenuSource.retrievalState, 'unavailable');
    assert.equal(pack.lunchMenuSource.checkedAt, '2026-09-28T20:30:00Z');
    assert.equal(pack.lunchMenuSource.lastAttemptAt, now.toISOString());
    assert.deepEqual(validateLunchPublication(pack, { now }), []);
  }
});
test('new week does not relabel old meals and unknown months do not halt teacher updates', async () => {
  const next = new Date('2026-10-05T12:00:00Z');
  const pack = {};
  await refreshLunchPublication(pack, { now: next, fetchImpl: async () => { throw new Error('Unavailable'); } });
  assert.deepEqual(pack.lunchMenu, []);
  assert.equal(pack.lunchMenuSource.status, 'not-yet-verified');
  assert.equal(pack.lunchMenuSource.missingDates.length, 5);
  assert.equal(pack.lunchArchive.length, 22);
  assert.deepEqual(validateLunchPublication(pack, { now: next }), []);
  assert.deepEqual(schoolWeek(new Date('2027-01-01T12:00:00Z')), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01']);
});
