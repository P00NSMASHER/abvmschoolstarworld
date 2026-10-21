import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function easternSchoolDay(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function checkedToday(value, now, maximumHours) {
  const current = Date.parse(now), checked = Date.parse(value || '');
  if (!Number.isFinite(current) || !Number.isFinite(checked)) return false;
  const ageHours = (current - checked) / 3_600_000;
  return ageHours >= -0.25 && ageHours <= maximumHours
    && easternSchoolDay(checked) === easternSchoolDay(current);
}

function sixTeacherPagesMatch(pack) {
  const checked = pack?.sourceLastCheckedAt;
  const pages = pack?.sourcePages;
  const titles = ['Home', 'Homework', 'Reading Work', 'Weekly Spelling List', 'Tests', 'Religion'];
  return pack?.delivery === 'verified' && pack?.pack?.sourceSufficient === true
    && pack?.pack?.sourceCheckedAt === checked
    && Array.isArray(pages) && pages.length === titles.length
    && titles.every(title => pages.some(page => page?.title === title
      && page?.checkedAt === checked && Boolean(page?.contentHash)));
}

function publishedCurriculumMatches(repo, live) {
  // Matching teacher timestamps do not prove identical practice questions,
  // test dates, teaching explanations or reviewed lunch reached public Pages.
  return live?.delivery === 'verified'
    && repo?.sourceLastCheckedAt === live?.sourceLastCheckedAt
    && repo?.pack?.sourceHash === live?.pack?.sourceHash
    && repo?.pack?.uploadedNoticeHash === live?.pack?.uploadedNoticeHash
    && JSON.stringify(repo) === JSON.stringify(live);
}

function publishedHomeworkMatches(repo, live) {
  return live?.schemaVersion === 1
    && repo?.checkedAt === live?.checkedAt
    && repo?.contentHash === live?.contentHash;
}

/** Read-only decision: an unavailable source is never treated as confirmed. */
export function assessDailySchoolSources({
  now, curriculum, homework, publishedCurriculum, publishedHomework,
  curriculumLiveAvailable = publishedCurriculum !== null && publishedCurriculum !== undefined,
  homeworkLiveAvailable = publishedHomework !== null && publishedHomework !== undefined,
} = {}) {
  const curriculumFresh = sixTeacherPagesMatch(curriculum)
    && checkedToday(curriculum.sourceLastCheckedAt, now, 20);
  const homeworkFresh = homework?.schemaVersion === 1
    && ['assignments', 'no-homework', 'no-specific-posting'].includes(homework.status)
    && checkedToday(homework.checkedAt, now, 8);
  const curriculumLiveMatches = curriculumLiveAvailable
    ? publishedCurriculumMatches(curriculum, publishedCurriculum) : null;
  const homeworkLiveMatches = homeworkLiveAvailable
    ? publishedHomeworkMatches(homework, publishedHomework) : null;
  return {
    easternDate: easternSchoolDay(now),
    curriculumFresh,
    homeworkFresh,
    curriculumLiveMatches,
    homeworkLiveMatches,
    refreshCurriculum: !curriculumFresh,
    refreshHomework: !homeworkFresh,
    redeploy: (curriculumFresh && curriculumLiveMatches === false)
      || (homeworkFresh && homeworkLiveMatches === false),
    caution: [
      ...(!curriculumLiveAvailable ? ['live-curriculum-unavailable'] : []),
      ...(!homeworkLiveAvailable ? ['live-homework-unavailable'] : []),
    ],
  };
}

const ROOT = new URL('../pages/data/', import.meta.url);
const LIVE = 'https://p00nsmasher.github.io/abvmschoolstarworld/data/';
async function readLive(file) {
  try {
    const response = await fetch(LIVE + file + '?freshness=' + Date.now(), {
      cache: 'no-store', signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return { available: true, data: await response.json() };
  } catch (error) {
    return { available: false, data: null, error: String(error.message || error) };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const now = new Date().toISOString();
  const curriculum = JSON.parse(readFileSync(new URL('study-pack.json', ROOT), 'utf8'));
  const homework = JSON.parse(readFileSync(new URL('homework-current.json', ROOT), 'utf8'));
  const [liveCurriculum, liveHomework] = await Promise.all([
    readLive('study-pack.json'), readLive('homework-current.json'),
  ]);
  const plan = assessDailySchoolSources({
    now, curriculum, homework,
    publishedCurriculum: liveCurriculum.data, curriculumLiveAvailable: liveCurriculum.available,
    publishedHomework: liveHomework.data, homeworkLiveAvailable: liveHomework.available,
  });
  plan.checkedAt = { curriculum: curriculum.sourceLastCheckedAt, homework: homework.checkedAt };
  plan.errors = [liveCurriculum.error, liveHomework.error].filter(Boolean);
  const report = process.argv.find(arg => arg.startsWith('--report='))?.slice(9);
  if (report) writeFileSync(report, JSON.stringify(plan, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(plan, null, 2));
}
