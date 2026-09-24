import { readFileSync } from 'node:fs';

const DATA_PATH = new URL('../pages/data/study-pack.json', import.meta.url);
const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
const pack = data.pack || {};
const args = new Map(process.argv.slice(2).map(arg => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
  return [key, value];
}));
const maxAgeHours = Number(args.get('max-age-hours') || 30);
const requireToday = args.get('require-today') === 'true';

function fail(message) {
  console.error('REFRESH HEALTH FAIL:', message);
  process.exitCode = 1;
}
function easternDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = Object.fromEntries(parts.map(item => [item.type, item.value]));
  return `${part.year}-${part.month}-${part.day}`;
}

const checkedAt = data.sourceLastCheckedAt || pack.sourceCheckedAt;
const checkedTime = Date.parse(checkedAt || '');
if (!Number.isFinite(checkedTime)) fail('sourceLastCheckedAt is missing or invalid.');
else {
  const ageHours = (Date.now() - checkedTime) / 3_600_000;
  if (ageHours < -0.25) fail(`source timestamp is ${Math.abs(ageHours).toFixed(1)} hours in the future.`);
  if (ageHours > maxAgeHours) fail(`source data is ${ageHours.toFixed(1)} hours old; limit is ${maxAgeHours} hours.`);
  if (requireToday && easternDayKey(checkedAt) !== easternDayKey(new Date())) {
    fail(`source data was not checked today in America/New_York (last: ${checkedAt}).`);
  }
}

if (pack.sourceSufficient !== true) fail('pack.sourceSufficient is not true.');
if (!/^teacher-pages-/.test(pack.sourceHash || '')) fail('teacher source hash is missing.');
if (!Array.isArray(data.sourcePages) || data.sourcePages.length !== 6) {
  fail(`expected exactly 6 teacher source pages; found ${data.sourcePages?.length ?? 0}.`);
} else {
  const expected = new Set(['Home','Homework','Reading Work','Weekly Spelling List','Tests','Religion']);
  const seen = new Set(data.sourcePages.map(page => page.title));
  for (const title of expected) if (!seen.has(title)) fail(`missing source page: ${title}.`);
  for (const page of data.sourcePages) {
    if (!page.url || !page.contentHash || !page.checkedAt) fail(`incomplete source-page receipt for ${page.title || 'unknown'}.`);
    if (checkedAt && page.checkedAt !== checkedAt) fail(`source-page timestamp mismatch for ${page.title}.`);
  }
}
for (const [field, minimum] of [['homework', 5], ['subjects', 4], ['importantDates', 2], ['reminders', 1]]) {
  if (!Array.isArray(pack[field]) || pack[field].length < minimum) {
    fail(`pack.${field} has ${pack[field]?.length ?? 0} items; expected at least ${minimum}.`);
  }
}
if (!data.syncPolicy?.primaryAt || !data.syncPolicy?.backupAt || data.syncPolicy?.retriesPerSource !== 3) {
  fail('syncPolicy does not describe the hardened primary/backup refresh plan.');
}

if (!process.exitCode) {
  console.log('Refresh health PASS', {
    checkedAt,
    easternDay: easternDayKey(checkedAt),
    sourcePages: data.sourcePages.length,
    homework: pack.homework.length,
    subjects: pack.subjects.length,
    importantDates: pack.importantDates.length,
  });
}
