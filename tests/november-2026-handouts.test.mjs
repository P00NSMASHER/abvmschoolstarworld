import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalogMeals, schoolWeek, refreshLunchPublication, validateLunchPublication} from '../scripts/lunch-publication.mjs';
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

test('November lunch entries include all school dates, closures and noon dismissal meals', async () => {
  const november = catalogMeals().filter(meal => meal.date.startsWith('2026-11'));
  assert.equal(november.length, 21);
  assert.equal(november.filter(meal => meal.status !== 'no-school').length, 18);
  for (const date of ['2026-11-26','2026-11-27','2026-11-30']) {
    assert.equal(november.find(x => x.date === date)?.status, 'no-school');
  }
  for (const date of ['2026-11-06','2026-11-25']) {
    assert.ok(november.find(x => x.date === date)?.items.length >= 3);
  }

  // This is a versioned November archive test, not a demand that the *live*
  // lunch publication always remain on November 2-6. The production recovery
  // controller independently checks the current school week and live parity.
  const declaredWeek = pack.pack?.lunchMenuSource?.weekStart;
  assert.match(declaredWeek, /^\d{4}-\d{2}-\d{2}$/);
  const publishedDate = new Date(declaredWeek + 'T15:00:00Z');
  assert.equal(schoolWeek(publishedDate)[0], declaredWeek,
    'A published lunch week must begin on its declared school Monday');
  assert.deepEqual(validateLunchPublication(pack.pack, {now: publishedDate}), []);

  // Reproduce both handout-backed weeks offline. An independent newly built
  // November 9-13 publication must pass without accepting invented lunches,
  // a forged source week, or a network-only replacement of reviewed evidence.
  for (const iso of ['2026-11-03T15:00:00Z','2026-11-09T15:00:00Z']) {
    const now = new Date(iso), candidate = {};
    const result = await refreshLunchPublication(candidate, {
      now,
      fetchImpl: async () => { throw new Error('Unexpected network lunch source'); },
    });
    assert.equal(result.verified, true,
      'The pinned, reviewed November school notice must establish its own meals');
    assert.deepEqual(candidate.lunchMenu.map(meal => meal.date), schoolWeek(now));
    assert.deepEqual(validateLunchPublication(candidate, {now}), []);

    const changedMeal = structuredClone(candidate);
    changedMeal.lunchMenu[0].items = ['Unreviewed replacement'];
    assert.match(validateLunchPublication(changedMeal, {now}).join(' '),
      /lost or changed a reviewed meal/);
    const wrongWeek = structuredClone(candidate);
    wrongWeek.lunchMenuSource.weekStart = '2026-10-26';
    assert.match(validateLunchPublication(wrongWeek, {now}).join(' '),
      /identity\/week is invalid/);
  }
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
