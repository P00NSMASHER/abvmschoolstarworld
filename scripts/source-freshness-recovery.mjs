import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { easternSchoolDay, reconcileScheduledSources, scheduledSourceDue } from './refresh-controller.mjs';
import {validateLunchPublication} from './lunch-publication.mjs';
export { easternSchoolDay, scheduledSourceDue, reconcileScheduledSources } from './refresh-controller.mjs';

function checkedWithinSchoolSchedule(value, now, maximumHours, kind) {
  const current = Date.parse(now), checked = Date.parse(value || '');
  if (!Number.isFinite(current) || !Number.isFinite(checked)) return false;
  const ageHours = (current - checked) / 3_600_000;
  if (ageHours < -0.25 || ageHours > maximumHours) return false;
  const checkedDay = easternSchoolDay(checked), currentDay = easternSchoolDay(current);
  if (checkedDay === currentDay) return true;
  // Midnight is not a configured scan deadline. Preserve the real previous
  // check date until the next morning scan is due, and only if the last
  // scheduled scan was actually satisfied. Hard age limits stay unchanged.
  const schedule = scheduledSourceDue({kind, now, checkedAt: value});
  return schedule.due === false && checkedDay === schedule.expectedSchoolDate
    && schedule.expectedSchoolDate < currentDay;
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
  // Content checksums describe the teacher page, not necessarily the derived
  // assignment list. Require the complete public Homework record to match.
  return live?.schemaVersion === 1
    && repo?.checkedAt === live?.checkedAt
    && repo?.contentHash === live?.contentHash
    && JSON.stringify(repo) === JSON.stringify(live);
}

// A fresh teacher timestamp cannot certify a lunch publication from last week.
// Compare the entire reviewed weekly menu and its content hash with the pinned
// catalog. A disagreement requests only the isolated, guarded lunch writer.
export function reviewedLunchWeekReady(curriculum,now) {
  const date=new Date(now);
  if(!Number.isFinite(date.getTime()))return false;
  try{return validateLunchPublication(curriculum?.pack||{},{now:date}).length===0;}
  catch{return false;}
}

/** Read-only decision: an unavailable source is never treated as confirmed. */
export function assessDailySchoolSources({
  now, curriculum, homework, publishedCurriculum, publishedHomework,
  curriculumLiveAvailable = publishedCurriculum !== null && publishedCurriculum !== undefined,
  homeworkLiveAvailable = publishedHomework !== null && publishedHomework !== undefined,
} = {}) {
  const curriculumFresh = sixTeacherPagesMatch(curriculum)
    && checkedWithinSchoolSchedule(curriculum.sourceLastCheckedAt, now, 20, 'curriculum');
  const homeworkFresh = homework?.schemaVersion === 1
    && ['assignments', 'no-homework', 'no-specific-posting'].includes(homework.status)
    && checkedWithinSchoolSchedule(homework.checkedAt, now, 8, 'homework');
  const reviewedLunchWeekCurrent=reviewedLunchWeekReady(curriculum,now);
  const curriculumLiveMatches = curriculumLiveAvailable
    ? publishedCurriculumMatches(curriculum, publishedCurriculum) : null;
  const homeworkLiveMatches = homeworkLiveAvailable
    ? publishedHomeworkMatches(homework, publishedHomework) : null;
  return {
    easternDate: easternSchoolDay(now),
    curriculumFresh,
    homeworkFresh,
    reviewedLunchWeekCurrent,
    refreshReviewedLunch:!reviewedLunchWeekCurrent,
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

// Independently compare current official teacher text with the last accepted
// posting. A fresh *timestamp* on the repository does not prove the teacher
// has not changed an undated assignment since the last hourly cron.
export async function probeOfficialHomework(homework, {fetchImpl=fetch, now=new Date().toISOString()} = {}) {
  // Lazy-load only for a real recovery probe. The health dashboard imports
  // the pure freshness classifier without acquiring live network dependencies.
  const [{assertExpectedTeacherPageUrl,pageLines},{HOMEWORK_SOURCE_URL,summarizeTeacherHomework}]=
    await Promise.all([import('./teacher-page-parsers.mjs'),import('./homework-posting.mjs')]);
  const response=await fetchImpl(HOMEWORK_SOURCE_URL,{
    headers:{accept:'text/html','user-agent':'ABVM-Parent-Companion/1.0'},
    redirect:'follow',signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error('Official Homework source returned HTTP '+response.status);
  assertExpectedTeacherPageUrl(response.url,HOMEWORK_SOURCE_URL);
  const parsed=summarizeTeacherHomework(pageLines(await response.text()),now,homework);
  return {available:true,changed:parsed.contentHash!==homework?.contentHash,
    observedContentHash:parsed.contentHash};
}

export function applyOfficialHomeworkObservation(plan, probe) {
  if(probe?.available===true && typeof probe.changed==='boolean'){
    return {...plan,officialHomeworkChanged:probe.changed,
      refreshHomework:plan.refreshHomework||probe.changed};
  }
  return {...plan,officialHomeworkChanged:null,
    caution:[...(plan.caution||[]),'official-homework-unavailable']};
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
  const [liveCurriculum, liveHomework, officialHomework] = await Promise.all([
    readLive('study-pack.json'), readLive('homework-current.json'),
    probeOfficialHomework(homework).catch(error=>({
      available:false,error:String(error?.message||error)
    })),
  ]);
  const baseline = assessDailySchoolSources({
    now, curriculum, homework,
    publishedCurriculum: liveCurriculum.data, curriculumLiveAvailable: liveCurriculum.available,
    publishedHomework: liveHomework.data, homeworkLiveAvailable: liveHomework.available,
  });
  const checkedAt = { curriculum: curriculum.sourceLastCheckedAt, homework: homework.checkedAt };
  const plan=reconcileScheduledSources(applyOfficialHomeworkObservation(baseline,officialHomework),{now,checkedAt});
  plan.checkedAt = checkedAt;
  plan.errors = [liveCurriculum.error, liveHomework.error, officialHomework.error].filter(Boolean);
  const report = process.argv.find(arg => arg.startsWith('--report='))?.slice(9);
  if (report) writeFileSync(report, JSON.stringify(plan, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(plan, null, 2));
}
