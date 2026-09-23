import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const DATA_PATH = new URL('../pages/data/study-pack.json', import.meta.url);
const SITE_ROOT = 'https://sites.google.com/view/abvmgr2';
const PAGE_PATHS = [
  ['home', 'Home'],
  ['homework', 'Homework'],
  ['reading-work', 'Reading Work'],
  ['weekly-spelling-list', 'Weekly Spelling List'],
  ['tests', 'Tests'],
  ['religion', 'Religion'],
];
const DAY_NAMES = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday';
const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, entity => ({
      '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ',
    })[entity.toLowerCase()] || entity);
}

function pageLines(html) {
  const withoutScripts = html.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  const lines = [...withoutScripts.matchAll(/<(?:p|h[1-3])\b[^>]*>([\s\S]*?)<\/(?:p|h[1-3])>/gi)]
    .map(match => decodeHtml(match[1].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return [...new Set(lines)];
}

async function fetchPage(path, title) {
  const url = `${SITE_ROOT}/${path}`;
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'user-agent': 'ABVM-Parent-Companion/1.0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`${title} returned HTTP ${response.status}.`);
  const html = await response.text();
  if (new URL(response.url).hostname === 'accounts.google.com' || /<title>\s*Sign in(?:\s|<)/i.test(html)) {
    throw new Error(`${title} unexpectedly requires Google sign-in.`);
  }
  const lines = pageLines(html);
  const hasExpectedHeading = title === 'Home'
    ? lines.some(line => /Mrs\.\s*Benulis.*ABVM Grade 2/i.test(line))
    : lines.some(line => line.toLowerCase() === title.toLowerCase());
  if (!hasExpectedHeading) {
    throw new Error(`${title} did not contain its expected page heading.`);
  }
  return { title, url, lines };
}

function requireLine(lines, prefix, pageName) {
  const line = lines.find(item => item.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!line) throw new Error(`${pageName} is missing “${prefix}”.`);
  return line.slice(prefix.length).trim();
}

function cleanTeacherText(value) {
  const cleaned = String(value || '')
    .replace(/Handwrititng/gi, 'Handwriting')
    .replace(/\b2 letter\b/gi, '2-letter')
    .replace(/--/g, ' — ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\b(\d+)\s+\/\s+(\d+)\b/g, '$1/$2')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned ? cleaned[0].toUpperCase() + cleaned.slice(1) : cleaned;
}

function parseHomework(lines) {
  const source = lines.filter(line => line.toLowerCase() !== 'homework');
  if (source.length < 5) throw new Error('Homework page has too few assignments to publish safely.');
  const entries = [];
  for (const line of source) {
    let match;
    if ((match = line.match(/^Spelling:\s*(.+)$/i))) {
      entries.push({ day: 'Current Homework posting', subject: 'Spelling', task: `Spelling ${cleanTeacherText(match[1])}`, due: 'Current posting' });
    } else if ((match = line.match(/^Math(?:\s*:)?\s*(.+)$/i))) {
      const task = /^pg\.?\s*(\d+)/i.test(match[1]) ? match[1].replace(/^pg\.?/i, 'Page') : cleanTeacherText(match[1]);
      entries.push({ day: 'Current Homework posting', subject: 'Math', task, due: 'Current posting' });
    } else if (/^Read$/i.test(line)) {
      entries.push({ day: 'Current Homework posting', subject: 'Reading', task: 'Read', due: 'Current posting' });
    } else if ((match = line.match(/^Parents?:\s*(.+)$/i))) {
      entries.push({ day: 'Current Homework posting', subject: 'Parent', task: cleanTeacherText(match[1]), due: 'Current posting' });
    } else if (/^Reading log/i.test(line)) {
      entries.push({
        day: 'Current Homework posting',
        subject: 'Reading',
        task: 'Keep Reading Log and Behavior Chart in the HW folder',
        due: 'Ongoing',
      });
    } else if (/everything should be returned/i.test(line)) {
      entries.push({
        day: 'Current Homework posting',
        subject: 'Homework Folder',
        task: 'Return everything in the HW folder',
        due: 'Next school day',
      });
    }
  }
  const subjects = new Set(entries.map(item => item.subject));
  if (entries.length < 5 || !subjects.has('Spelling') || !subjects.has('Math') || !subjects.has('Reading')) {
    throw new Error('Homework page did not contain the expected Spelling, Math, and Reading assignments.');
  }
  return entries;
}

function formatMonth(raw) {
  const clean = raw.replace('.', '').toLowerCase();
  const labels = {
    jan: 'Jan.', january: 'Jan.', feb: 'Feb.', february: 'Feb.', mar: 'Mar.', march: 'Mar.',
    apr: 'Apr.', april: 'Apr.', may: 'May', jun: 'Jun.', june: 'Jun.', jul: 'Jul.', july: 'Jul.',
    aug: 'Aug.', august: 'Aug.', sep: 'Sept.', sept: 'Sept.', september: 'Sept.', oct: 'Oct.', october: 'Oct.',
    nov: 'Nov.', november: 'Nov.', dec: 'Dec.', december: 'Dec.',
  };
  return labels[clean] || '';
}

function parseDatedLines(lines) {
  const items = [];
  const rangePattern = new RegExp(`^(${DAY_NAMES})\\s+([A-Za-z]+)\\.?\\s+(\\d{1,2})\\s*&\\s*(${DAY_NAMES})\\s+([A-Za-z]+)\\.?\\s+(\\d{1,2}):\\s*(.+)$`, 'i');
  const singlePattern = new RegExp(`^(${DAY_NAMES})\\s+([A-Za-z]+)\\.?\\s+(\\d{1,2}):\\s*(.+)$`, 'i');
  for (const line of lines) {
    let match = line.match(rangePattern);
    if (match) {
      items.push({
        date: `${match[1]}–${match[4]}, ${formatMonth(match[2])} ${Number(match[3])}–${Number(match[6])}`,
        label: cleanTeacherText(match[7]),
      });
      continue;
    }
    match = line.match(singlePattern);
    if (match) {
      items.push({ date: `${match[1]}, ${formatMonth(match[2])} ${Number(match[3])}`, label: cleanTeacherText(match[4]) });
    }
  }
  return items;
}

function kindFor(label) {
  if (/STAR/i.test(label)) return 'assessment';
  if (/test|grammar|subtraction|addition/i.test(label)) return 'test';
  if (/due|money|rsvp/i.test(label)) return 'deadline';
  if (/no school|closed/i.test(label)) return 'holiday';
  if (/lego club/i.test(label)) return 'club';
  if (/hsa meeting/i.test(label)) return 'meeting';
  if (/dismissal/i.test(label)) return 'schedule change';
  if (/conference/i.test(label)) return 'conference';
  return 'school event';
}

function dateKey(value) {
  const match = String(value || '').match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})/i);
  if (!match) return '';
  return `${MONTHS[match[1].replace('.', '').toLowerCase()]}-${Number(match[2])}`;
}

function topicKey(value) {
  const label = String(value || '').toLowerCase();
  const patterns = [
    ['stationery', /stationa(?:ry|ery).*money/], ['pretzel', /pretzel/], ['dress-down', /dress down/],
    ['lego', /lego club/], ['picture', /picture day/], ['hsa', /hsa.*meeting/], ['closed', /no school|closed/],
    ['dismissal', /dismissal/], ['conference', /conference/], ['spelling', /spelling/],
    ['subtraction', /subtraction/], ['grammar', /grammar|types of sentences/], ['addition', /addition/],
  ];
  return patterns.find(([, pattern]) => pattern.test(label))?.[0]
    || label.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(word => word.length > 3).slice(0, 3).join('-');
}

function mergeTeacherEvents(existing, incoming, source) {
  const newKeys = new Set(incoming.map(item => `${dateKey(item.date)}:${topicKey(item.label)}`));
  const uniqueTopicKeys = new Set(incoming.filter(item => topicKey(item.label) === 'conference').map(item => topicKey(item.label)));
  const kept = existing.filter(item => {
    if (item.source === source) return false;
    const key = `${dateKey(item.date)}:${topicKey(item.label)}`;
    return !newKeys.has(key) && !uniqueTopicKeys.has(topicKey(item.label));
  });
  return [...kept, ...incoming.map(item => ({ ...item, kind: item.kind || kindFor(item.label), source }))]
    .sort((a, b) => eventTime(a.date) - eventTime(b.date));
}

function eventTime(value) {
  const match = String(value || '').match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const month = MONTHS[match[1].replace('.', '').toLowerCase()];
  const now = new Date();
  let year = now.getUTCFullYear();
  if (now.getUTCMonth() >= 7 && month <= 5) year += 1;
  if (now.getUTCMonth() <= 5 && month >= 7) year -= 1;
  return Date.UTC(year, month, Number(match[2]));
}

function upsertSubject(subjects, matcher, next) {
  const index = subjects.findIndex(item => matcher.test(item.subject || ''));
  if (index >= 0) subjects[index] = next;
  else subjects.push(next);
}

function schoolWeekLabel(now) {
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const monday = new Date(local);
  const day = local.getDay();
  monday.setDate(local.getDate() - (day === 0 ? 6 : day - 1));
  return `Week of ${monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

function readableList(items) {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

const fetched = await Promise.all(PAGE_PATHS.map(([path, title]) => fetchPage(path, title)));
const pages = Object.fromEntries(fetched.map(page => [page.title, page]));

const homeLines = pages.Home.lines;
const homeEvents = parseDatedLines(homeLines).map(item => ({ ...item, source: 'teacher-home' }));
const specialsStart = homeLines.findIndex(line => /^Specials Schedule:?$/i.test(line));
const specials = specialsStart >= 0
  ? homeLines.slice(specialsStart + 1).filter(line => new RegExp(`^(${DAY_NAMES}):`, 'i').test(line)).slice(0, 5)
  : [];
if (homeEvents.length < 8 || specials.length !== 5) {
  throw new Error('Teacher Home page did not contain a complete event and specials snapshot.');
}
if (homeEvents.some(item => !dateKey(item.date))) {
  throw new Error('Teacher Home page contained an unreadable event date.');
}

const homework = parseHomework(pages.Homework.lines);
const readingLines = pages['Reading Work'].lines;
const story = requireLine(readingLines, 'Stories:', 'Reading Work');
const sightWords = requireLine(readingLines, 'Sight Words:', 'Reading Work');
const phonics = requireLine(readingLines, 'Phonics:', 'Reading Work');
const vocabulary = requireLine(readingLines, 'Vocab Words:', 'Reading Work');
const wordStructure = requireLine(readingLines, 'Word Structure:', 'Reading Work');
const comprehension = requireLine(readingLines, 'Reading Comprehension:', 'Reading Work');
const testItems = parseDatedLines(pages.Tests.lines).map(item => ({ ...item, kind: 'test', source: 'teacher-tests' }));
if (testItems.length < 2) throw new Error('Tests page did not contain enough dated tests to publish safely.');

const religionLines = pages.Religion.lines.filter(line => line.toLowerCase() !== 'religion');
if (!religionLines.some(line => /^Unit\s/i.test(line)) || !religionLines.some(line => /^Chapter\s/i.test(line))) {
  throw new Error('Religion page did not contain the expected unit and chapter material.');
}

const normalizedSource = fetched.map(page => `${page.title}\n${page.lines.join('\n')}`).join('\n\n');
const digest = createHash('sha256').update(normalizedSource).digest('hex');
const sourceHash = `teacher-pages-${digest.slice(0, 20)}`;
const checkedAt = new Date().toISOString();
const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
const pack = data.pack || {};
const contentChanged = pack.sourceHash !== sourceHash;
const capturedAt = contentChanged ? checkedAt : (data.sourceCapturedAt || pack.sourceCapturedAt || checkedAt);

const subjects = Array.isArray(pack.subjects) ? [...pack.subjects] : [];
const grammarTest = testItems.find(item => /grammar|types of sentences/i.test(item.label));
upsertSubject(subjects, /Reading \/ ELA/i, {
  subject: 'Reading / ELA',
  topics: [
    `Story: ${story.replace(/^['“"]|['”"]$/g, '')}`,
    `Sight words: ${sightWords}`,
    `Phonics: ${phonics.replace(/2 letter/i, '2-letter')}`,
    `Vocabulary: ${vocabulary}`,
    `Word structure: ${/^cvc words$/i.test(wordStructure) ? 'CVC words' : wordStructure}`,
    ...(grammarTest ? [`Grammar: ${grammarTest.label.match(/\(([^)]+)\)/)?.[1] || grammarTest.label} (test ${grammarTest.date})`] : []),
  ],
  studyNotes: comprehension
    ? [`Reading comprehension: ${comprehension}`]
    : ['The current Reading Work page does not list a reading-comprehension skill.'],
});

const spellingTest = testItems.find(item => /spelling/i.test(item.label));
upsertSubject(subjects, /Spelling/i, {
  subject: 'Spelling / Handwriting',
  topics: spellingTest ? [`${spellingTest.date} test focus: ${spellingTest.label.replace(/^Spelling\s*/i, '').replace(/\s*\/\s*Handwriting$/i, '').replace(/^\(([^)]+)\)$/, '$1')}`] : [`Phonics: ${phonics}`],
  studyNotes: pages['Weekly Spelling List'].lines.length > 1
    ? pages['Weekly Spelling List'].lines.slice(1)
    : ['The Weekly Spelling List page currently has no word list posted.'],
});

const religionTopics = [];
const religionNotes = [];
for (const line of religionLines) {
  const segments = line.split(/\s*\*\s*/).map(item => item.trim()).filter(Boolean);
  if (segments[0]) religionTopics.push(segments[0]);
  religionNotes.push(...segments.slice(1));
}
upsertSubject(subjects, /^Religion$/i, {
  subject: 'Religion',
  topics: religionTopics,
  studyNotes: religionNotes.map(note => cleanTeacherText(note
    .replace(/^\|+|\|+$/g, '')
    .replace(/---/g, ' — ')
    .replace(/\bhe tell us\b/i, 'he tells us')
    .replace(/\bresponsiblity\b/i, 'responsibility'))),
});

const mathTest = testItems.find(item => /subtraction|addition|math/i.test(item.label));
const mathHomework = homework.find(item => item.subject === 'Math');
upsertSubject(subjects, /^Math$/i, {
  subject: 'Math',
  topics: mathTest ? [mathTest.label] : [],
  studyNotes: [
    ...(mathTest ? [`The Tests page lists ${mathTest.label} for ${mathTest.date}.`] : []),
    ...(mathHomework ? [`The current Homework page assigns ${mathHomework.task}.`] : []),
  ],
});

upsertSubject(subjects, /^Specials$/i, { subject: 'Specials', topics: specials, studyNotes: [] });
pack.subjects = subjects;
pack.homework = homework;
pack.vocabulary = vocabulary.split(',').map(term => term.trim()).filter(Boolean).map(term => ({
  subject: 'Reading / ELA',
  term,
  meaning: 'Current Reading Work vocabulary word; the teacher page does not provide a definition.',
}));
pack.importantDates = mergeTeacherEvents(pack.importantDates || [], homeEvents, 'teacher-home');
pack.importantDates = mergeTeacherEvents(pack.importantDates, testItems, 'teacher-tests');
pack.schemaVersion = 2;
pack.sourceHash = sourceHash;
pack.sourceCapturedAt = capturedAt;
pack.sourceCheckedAt = checkedAt;
pack.generatedAt = checkedAt;
pack.weekLabel = schoolWeekLabel(new Date(checkedAt));
pack.summary = `Current Grade 2 teacher-site material: Homework lists ${readableList(homework.slice(0, 4).map(item => item.subject === 'Parent' ? `parent task “${item.task}”` : `${item.subject} “${item.task}”`))}. Upcoming tests include ${readableList(testItems.slice(0, 4).map(item => `${item.label} on ${item.date}`))}.`;
pack.sourceSufficient = true;
pack.gaps = (pack.gaps || []).filter(item => !/source bridge|four-hour|does not show a date|spelling-word list|weekly spelling|reading work page leaves/i.test(item));
pack.gaps = [...new Set([...pack.gaps,
  'The public teacher Homework page does not show a date, so assignments are labeled as the current posting and refreshed daily.',
  ...(pages['Weekly Spelling List'].lines.length > 1 ? [] : ['The Weekly Spelling List page currently has no word list posted.']),
  ...(comprehension ? [] : ['The current Reading Work page leaves Reading Comprehension blank, so no comprehension target is invented.']),
])];

data.source = 'ABVM Grade 2 public teacher pages';
data.delivery = 'verified';
data.syncPolicy = {
  intervalHours: 24,
  dailyAt: '1:00 PM',
  timeZone: 'America/New_York',
  source: `${SITE_ROOT}/home`,
};
data.sourceLastCheckedAt = checkedAt;
data.sourceLastSeenAt = checkedAt;
data.sourceCapturedAt = capturedAt;
data.freshnessHours = 0;
data.sourcePages = fetched.map(page => ({
  title: page.title,
  url: page.url,
  checkedAt,
  contentHash: createHash('sha256').update(page.lines.join('\n')).digest('hex'),
}));
data.pack = pack;

if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ checkedAt, contentChanged, sourceHash, homework, tests: testItems }, null, 2));
} else {
  writeFileSync(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`${contentChanged ? 'Updated' : 'Checked'} ${fetched.length} teacher pages; ${homework.length} homework items are current.`);
}
