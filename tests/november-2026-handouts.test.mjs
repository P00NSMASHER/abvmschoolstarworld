import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalogMeals, validateLunchPublication} from '../scripts/lunch-publication.mjs';
import {validateUploadedNoticePolicy} from '../scripts/uploaded-notice-policy.mjs';
import {validateUploadedNoticeIntegration} from '../scripts/validate-uploaded-notices.mjs';
import {validateSchoolwork} from '../scripts/validate-schoolwork.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const notices = read('../pages/data/uploaded-notices.json');
const schoolwork = read('../pages/data/schoolwork.json');
const pack = read('../pages/data/study-pack.json');

test('November handout provenance and every posted event survive the runtime pack', () => {
  assert.equal(validateUploadedNoticePolicy(notices).documents, notices.documents.length);
  assert.equal(validateUploadedNoticeIntegration(pack, notices).documents, notices.documents.length);
  const calendar = notices.documents.find(doc => doc.id === 'nov-2026-school-calendar-parent-photo');
  const lunch = notices.documents.find(doc => doc.id === 'nov-2026-lunch-menu-parent-photo');
  assert.ok(calendar && lunch);
  const events = notices.importantDates.filter(entry => entry.sourceDocument === calendar.id);
  assert.equal(events.length, 27);
  assert.ok(events.some(entry => entry.date.endsWith('Nov. 6') && entry.label === 'Noon dismissal'));
  assert.ok(events.some(entry => entry.date.endsWith('Nov. 25') && entry.label === 'Report cards distributed'));
  assert.ok(!JSON.stringify({calendar,lunch}).includes('Emma'));
});

test('November lunch entries include all school dates, closures and noon dismissal meals', () => {
  const november = catalogMeals().filter(meal => meal.date.startsWith('2026-11'));
  assert.equal(november.length, 21);
  assert.equal(november.filter(meal => meal.status !== 'no-school').length, 18);
  for (const date of ['2026-11-26','2026-11-27','2026-11-30']) {
    assert.equal(november.find(x => x.date === date)?.status, 'no-school');
  }
  for (const date of ['2026-11-06','2026-11-25']) {
    assert.ok(november.find(x => x.date === date)?.items.length >= 3);
  }
  assert.deepEqual(validateLunchPublication(pack.pack, {now: new Date('2026-11-03T15:00:00Z')}), []);
});

test('Only original Grade 2 practice is public and undated work stays undated', () => {
  const report = validateSchoolwork(schoolwork, {requireManifest:true});
  const november = schoolwork.lessons.filter(lesson => lesson.id.startsWith('nov26-'));
  const scans = schoolwork.sourceManifest.filter(item => item.id.startsWith('abvm-nov2026-scan-'));
  assert.equal(november.length, 13);
  assert.equal(november.flatMap(lesson => lesson.questions).length, 29);
  assert.equal(scans.length, 46);
  assert.equal(scans.filter(item => item.status === 'integrated').length, 21);
  assert.equal(scans.filter(item => item.status === 'held').length, 25);
  assert.ok(november.every(lesson => lesson.studiedOn === null && /undated/i.test(lesson.dateStatus)));
  assert.ok(november.every(lesson => lesson.questions.every(q => q.provenance === 'original-practice-from-uploaded-schoolwork')));
  assert.ok(!JSON.stringify({november,scans}).includes('Emma'));
  assert.equal(report.photos, schoolwork.sourceManifest.length);
});
