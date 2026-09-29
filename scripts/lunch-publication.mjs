import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const LUNCH_FEED_URL = 'https://api-v2.appdeploy.ai/app/abvm-source-bridge-gkj08k/api/lunch-menu';
export const CATALOG = JSON.parse(readFileSync(new URL('../pages/data/lunch-catalog.json', import.meta.url), 'utf8'));
const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function validIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}
export function schoolWeek(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  const d = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1));
  return Array.from({ length: 5 }, (_, i) => new Date(d.getTime() + i * 86400000).toISOString().slice(0, 10));
}
export function displayDay(iso) {
  if (!validIsoDate(iso)) throw new Error('Invalid lunch date');
  const d = new Date(iso + 'T12:00:00Z');
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
export function catalogMeals(catalog = CATALOG) {
  if (catalog.schemaVersion !== 1 || catalog.school !== 'Assumption BVM School' || catalog.provider !== 'Saint Clair Area School District') throw new Error('Wrong lunch catalog identity');
  const dates = new Set();
  return catalog.sources.flatMap(source => {
    const proofMode = source.proofMode || 'sha256-bytes';
    if (!/^[a-f0-9]{64}$/.test(source.contentHash) || !source.url.startsWith('https://resources.finalsite.net/') || !['sha256-bytes','pinned-url'].includes(proofMode) || !validIsoDate(source.coverageStart) || !validIsoDate(source.coverageEnd) || Number.isNaN(Date.parse(source.reviewedAt))) throw new Error('Invalid reviewed lunch source');
    if (proofMode === 'pinned-url' && createHash('sha256').update(source.url).digest('hex') !== source.contentHash) throw new Error('Invalid pinned lunch source proof');
    return source.meals.map(meal => {
      if (!validIsoDate(meal.date) || meal.date < source.coverageStart || meal.date > source.coverageEnd || dates.has(meal.date) || !Array.isArray(meal.items) || (!meal.items.length && meal.status !== 'no-school') || meal.items.some(x => typeof x !== 'string' || !x.trim())) throw new Error('Invalid or duplicate lunch row');
      dates.add(meal.date);
      return { date: meal.date, day: displayDay(meal.date), items: meal.items, ...(meal.status ? { status: meal.status } : {}), sourceId: source.id };
    });
  }).sort((a, b) => a.date.localeCompare(b.date));
}
export function validateLunchFeed(feed, { now = new Date(), catalog = CATALOG } = {}) {
  const dates = schoolWeek(now);
  if (feed?.schemaVersion !== 2 || feed.school !== catalog.school || feed.source !== catalog.provider || feed.weekStart !== dates[0] || feed.weekEnd !== dates[4]) throw new Error('Lunch feed identity or week mismatch');
  if (!Array.isArray(feed.lunchMenu) || !Array.isArray(feed.sourcePages) || !Array.isArray(feed.missingDates) || !['verified', 'unavailable', 'needs-review'].includes(feed.retrievalState)) throw new Error('Malformed lunch feed');
  const expected = catalogMeals(catalog).filter(m => dates.includes(m.date));
  const rows = new Map();
  for (const meal of feed.lunchMenu) {
    const known = expected.find(m => m.date === meal.date);
    if (!known || rows.has(meal.date) || known.sourceId !== meal.sourceId || JSON.stringify(known.items) !== JSON.stringify(meal.items) || (known.status || 'meal') !== (meal.status || 'meal')) throw new Error('Unreviewed, duplicate, or mismatched lunch row');
    rows.set(meal.date, meal);
  }
  if (expected.some(m => !rows.has(m.date))) throw new Error('Lunch feed dropped a reviewed meal');
  const missing = dates.filter(date => !rows.has(date));
  if (JSON.stringify([...feed.missingDates].sort()) !== JSON.stringify(missing)) throw new Error('Lunch gap disclosure mismatch');
  for (const source of catalog.sources.filter(s => expected.some(m => m.sourceId === s.id))) {
    const proof = feed.sourcePages.find(s => s.id === source.id);
    if (!proof || proof.contentHash !== source.contentHash || proof.url !== source.url) throw new Error('Lunch source proof mismatch');
    if (feed.retrievalState === 'verified') {
      const age = now.getTime() - Date.parse(proof.checkedAt || '');
      if (proof.state !== 'verified' || !Number.isFinite(age) || age < -60000 || age > 3600000) throw new Error('Lunch verification is stale or invalid');
    }
  }
  return { dates, expected, missing };
}
export async function fetchLunchFeed({ fetchImpl = fetch, now = new Date() } = {}) {
  const response = await fetchImpl(LUNCH_FEED_URL, { headers: { accept: 'application/json', 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(22000) });
  if (!response.ok) throw new Error('Lunch API HTTP ' + response.status);
  if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('Lunch endpoint returned HTML instead of JSON');
  const text = await response.text();
  if (text.length > 250000) throw new Error('Lunch feed exceeds size limit');
  const feed = JSON.parse(text);
  validateLunchFeed(feed, { now });
  return feed;
}
export function lunchDigest(pack) {
  return createHash('sha256').update(JSON.stringify({ menu: pack.lunchMenu || [], archive: pack.lunchArchive || [], source: pack.lunchMenuSource || null })).digest('hex');
}
export async function refreshLunchPublication(pack, { now = new Date(), fetchImpl = fetch } = {}) {
  let feed = null;
  let error = null;
  try { feed = await fetchLunchFeed({ fetchImpl, now }); }
  catch (failure) { error = failure instanceof Error ? failure.message : String(failure); }
  const dates = schoolWeek(now);
  const archive = catalogMeals();
  const meals = archive.filter(m => dates.includes(m.date));
  const missingDates = dates.filter(date => !meals.some(m => m.date === date));
  const old = pack.lunchMenuSource || {};
  const sources = CATALOG.sources.filter(s => meals.some(m => m.sourceId === s.id));
  const verifiedNow = feed?.retrievalState === 'verified';
  const proofTimes = sources.map(s => feed?.sourcePages.find(p => p.id === s.id)?.checkedAt || null).filter(Boolean);
  const checkedAt = verifiedNow && proofTimes.length ? proofTimes.sort()[0] : old.checkedAt || null;
  pack.lunchMenu = meals;
  pack.lunchArchive = archive;
  pack.lunchMenuSource = {
    status: missingDates.length ? meals.length ? 'partial-current-week' : 'not-yet-verified' : 'current-week',
    retrievalState: feed?.retrievalState || 'unavailable',
    checkedAt,
    lastAttemptAt: now.toISOString(),
    provider: CATALOG.provider,
    school: CATALOG.school,
    feedUrl: LUNCH_FEED_URL,
    parentResourcesUrl: CATALOG.parentResourcesUrl,
    weekStart: dates[0], weekEnd: dates[4],
    coverageThrough: meals.at(-1)?.date || null,
    missingDates,
    sourcePages: sources.map(s => ({ id: s.id, url: s.url, contentHash: s.contentHash, reviewedAt: s.reviewedAt, checkedAt: feed?.sourcePages.find(p => p.id === s.id)?.checkedAt || null })),
    pendingDocuments: feed?.pendingDocuments || [],
    gaps: [
      ...missingDates.map(date => `No reviewed school lunch menu is available for ${date}.`),
      ...(verifiedNow ? [] : ['Source check unavailable or awaiting review; previously reviewed meals remain on their original dates.']),
    ],
    ...(error ? { lastError: error } : {}),
  };
  pack.lunchMenuHash = lunchDigest(pack);
  return { verified: Boolean(verifiedNow), meals: meals.length, missingDates, error };
}
export function validateLunchPublication(pack, { now = new Date() } = {}) {
  const errors = [];
  const dates = schoolWeek(now);
  const expected = catalogMeals().filter(m => dates.includes(m.date));
  const actual = pack.lunchMenu || [];
  const source = pack.lunchMenuSource;
  if (!source || source.school !== CATALOG.school || source.provider !== CATALOG.provider || source.weekStart !== dates[0] || source.weekEnd !== dates[4]) errors.push('Lunch publication identity/week is invalid');
  if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push('Lunch publication lost or changed a reviewed meal');
  if (pack.lunchMenuHash !== lunchDigest(pack)) errors.push('Lunch publication content hash mismatch');
  const missing = dates.filter(date => !expected.some(m => m.date === date));
  if (JSON.stringify(source?.missingDates) !== JSON.stringify(missing)) errors.push('Lunch publication gap disclosure is invalid');
  if (!['verified', 'unavailable', 'needs-review'].includes(source?.retrievalState)) errors.push('Lunch retrieval status is invalid');
  return errors;
}
