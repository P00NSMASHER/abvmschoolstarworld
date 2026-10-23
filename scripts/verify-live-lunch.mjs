import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { publishedMealForDate } from './published-meal.mjs';
import {sameDeployedStudyPack} from './live-pack-parity.mjs';
import { scrollLiveElementAfterRepaint } from './live-lunch-dom.mjs';

const base = process.env.ABVM_LIVE_URL || 'https://p00nsmasher.github.io/abvmschoolstarworld/';
const expected = JSON.parse(readFileSync(new URL('../pages/data/study-pack.json', import.meta.url), 'utf8'));
const artRegistry=JSON.parse(readFileSync(new URL('../pages/data/lunch-art-registry.json',import.meta.url),'utf8'));
const out = 'live-lunch-proof';
mkdirSync(out, { recursive: true });
const receipt = {
  verified: false,
  startedAt: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  base,
  expectedLunchHash: expected.pack.lunchMenuHash,
  screens: [],
  consoleErrors: [],
};
let browser;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function livePack() {
  const deadline = Date.now() + 180000;
  let detail = '';
  while (Date.now() < deadline) {
    try {
      const r = await fetch(new URL('data/study-pack.json?lunch-proof=' + Date.now(), base), {
        headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(12000),
      });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error('Live pack is not JSON: ' + r.status);
      const data = await r.json();
      if (sameDeployedStudyPack(expected,data)) return data;
      detail = 'CDN has not served the exact governed study pack yet';
    } catch (error) { detail = error.message; }
    await sleep(5000);
  }
  throw new Error(detail);
}
function eastToday() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
async function liveStudyAssets() {
  const assets = ['lunch-art.js','data/lunch-art-current.json','data/lunch-art-registry.json',...artRegistry.artworks.filter(art=>art.status==='reviewed').map(art=>art.src),'index.html', 'app.js', 'product-view.js', 'styles.css', 'study-teaching.css', 'study-review.js', 'weekly-learning.js', 'assets/school/abvm-school-hero.webp', 'study-games.js', 'study-games-view.js', 'study-materials.mjs', 'study-games-materials-view.mjs', 'grade2-original-vocabulary.mjs', 'study-games-materials.css', 'sw.js', ...['math', 'reading', 'spelling', 'religion', 'eagle'].map(name => 'assets/illustrations/' + name + '.webp'), ...['eaglet','starlight','spark','scholar','golden','eagle','champion'].map(name=>'assets/badges/'+name+'.webp'), ...['nest-explorer','little-luminary','feather-cadet','star-voyager','sky-scholar','wing-leader','study-sentinel','school-spirit','blue-ribbon-ace','golden-quill','sky-captain','eagle-vanguard','honor-guardian','crown-keeper','star-commander'].map(name=>'assets/badges/'+name+'-premium.webp')];
  // A live source timestamp is insufficient if the published question bank,
  // Homework feed, or printable renderers still contain an earlier build.
  assets.push('data/study-pack.json', 'data/study-pack-runtime.json', 'data/study-archive.json', 'data/homework-current.json',
    'test-study-pair.mjs', 'classroom-test-guide.mjs', 'premium-paper-theme.mjs', 'study-notes-library.mjs');
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  return Promise.all(assets.map(async path => {
    const expectedBytes = readFileSync(new URL('../pages/' + path, import.meta.url));
    const expectedHash = digest(expectedBytes), deadline = Date.now() + 180000;
    let detail = 'Live asset has not matched the deployed checkout: ' + path;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(new URL(path + '?study-proof=' + Date.now(), base), {
          headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new Error(path + ': HTTP ' + response.status);
        const bytes = Buffer.from(await response.arrayBuffer()), actualHash = digest(bytes);
        if (actualHash === expectedHash) return { path, sha256: actualHash, bytes: bytes.length, status: response.status };
        detail = path + ': expected ' + expectedHash + ', received ' + actualHash;
      } catch (error) { detail = error.message; }
      await sleep(5000);
    }
    throw new Error(detail);
  }));
}
try {
  const data = await livePack();
  receipt.studyAssets = await liveStudyAssets();
  writeFileSync(`${out}/deployed-pack.json`, JSON.stringify(data, null, 2));
  receipt.actualLunchHash = data.pack.lunchMenuHash;
  receipt.sourceCheckedAt = data.sourceLastCheckedAt;
  receipt.lunchCheckedAt = data.pack.lunchMenuSource.checkedAt;
  receipt.missingDates = data.pack.lunchMenuSource.missingDates;
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
  const page = await context.newPage();
  page.on('pageerror', error => receipt.consoleErrors.push(error.message));
  await page.goto(base + '?lunch-proof=' + Date.now() + '#today');
  await expect(page.locator('.screen')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.today-screen .study-invitation')).toHaveCount(0);
  const today = eastToday();
  const todayMeal = publishedMealForDate(data.pack, today);
  if ([0,6].includes(new Date(today+'T12:00:00Z').getUTCDay())) {
    await expect(page.locator('.lunch-card')).toHaveCount(0);
  } else if (todayMeal?.status==='no-school') {
    await expect(page.locator('.lunch-card')).toContainText('No school lunch');
    await expect(page.locator('.lunch-card .lunch-art')).toHaveCount(0);
  } else if (todayMeal?.items.length) {
    for (const item of todayMeal.items) await expect(page.locator('.lunch-card')).toContainText(item);
  } else if (![0, 6].includes(new Date(today + 'T12:00:00Z').getUTCDay())) {
    await expect(page.locator('.lunch-card')).toContainText(/No school lunch|Lunch menu not yet verified/);
  }
  // Today may re-render its verified lunch card while the live pack finishes loading.
  // Retry only the detached DOM scroll, never the source/meal or image assertions.
  if (await page.locator('.lunch-card').count()) await scrollLiveElementAfterRepaint(page.locator('.lunch-card').first());
  const mealArt=page.locator('.today-screen .lunch-art-tray img');
  if(await mealArt.count()){await expect.poll(()=>mealArt.evaluate(img=>img.complete&&img.naturalWidth>=1200)).toBe(true);await expect(mealArt).toHaveAttribute('alt',/^Illustration of/);await expect(page.locator('.lunch-art-tray figcaption')).toHaveCount(0);receipt.todayTrayImage={src:await mealArt.getAttribute('src'),decoded:true};}
  await page.screenshot({ path: `${out}/today.png` });
  receipt.screens.push({ screen: 'Today', date: today, lunch: await page.locator('.lunch-card').allTextContents() });

  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.getByRole('button', { name: 'Week', exact: true }).click();
  async function selectWeekDate(date) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const target = page.locator(`[data-day^="${date}"]`);
      if (await target.count()) { await target.click(); return; }
      const firstDate = (await page.locator('[data-day]').first().getAttribute('data-day')).slice(0, 10);
      await page.getByRole('button', { name: firstDate < date ? 'Next week' : 'Previous week', exact: true }).click();
    }
    throw new Error('Could not reach published lunch date in Week: ' + date);
  }
  for (const publishedMeal of data.pack.lunchMenu) {
    const meal=publishedMealForDate(data.pack,publishedMeal.date);
    await selectWeekDate(meal.date);
    if(meal.status==='no-school'){
      await expect(page.locator('.lunch-card')).toContainText('No school lunch');
      await expect(page.locator('.lunch-card .lunch-art')).toHaveCount(0);
      (receipt.verifiedClosures??=[]).push({date:meal.date,label:meal.closure||'Published no-school lunch',imageAbsent:true});
      receipt.screens.push({screen:'Week',date:meal.date,lunch:await page.locator('.lunch-card').textContent()});
      continue;
    }
    for (const item of meal.items) await expect(page.locator('.lunch-card')).toContainText(item);
    const reviewed=artRegistry.artworks.find(art=>art.status==='reviewed'&&art.approvedMenus.some(menu=>menu.sourceId===meal.sourceId&&JSON.stringify(menu.items)===JSON.stringify(meal.items)));
    if(reviewed){
      const image=page.locator('.week-rail .lunch-art-tray img');
      await expect(image,'a reviewed published menu must actually display its tray image').toHaveCount(1);
      await expect(image).toHaveAttribute('src',reviewed.src);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(()=>image.evaluate(img=>img.complete&&img.naturalWidth>=1200)).toBe(true);
      (receipt.reviewedTrayImages??=[]).push({date:meal.date,src:reviewed.src,decoded:true});
    }
    receipt.screens.push({ screen: 'Week', date: meal.date, lunch: await page.locator('.lunch-card').textContent() });
  }
  await page.locator('.lunch-card').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/week.png` });
  for (const date of data.pack.lunchMenuSource.missingDates) {
    await selectWeekDate(date);
    await expect(page.locator('.lunch-card')).toContainText(/Lunch menu not yet verified|No school lunch/);
    receipt.screens.push({ screen: 'Week gap', date, text: await page.locator('.lunch-card').textContent() });
  }

  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  for (const publishedMeal of data.pack.lunchMenu) {
    // Match Today and Week: a reviewed closure supersedes a district meal.
    // Never fail publication because the app correctly says no school.
    const meal = publishedMealForDate(data.pack, publishedMeal.date);
    for (let attempt = 0; attempt < 24; attempt++) {
      const displayedMonth = (await page.locator('[data-cal-day]').first().getAttribute('data-cal-day')).slice(0, 7);
      const targetMonth = meal.date.slice(0, 7);
      if (displayedMonth === targetMonth) break;
      await page.getByRole('button', { name: displayedMonth < targetMonth ? 'Next month' : 'Previous month', exact: true }).click();
    }
    await page.locator(`[data-cal-day^="${meal.date}"]`).click();
    if (meal.status === 'no-school') {
      await expect(page.locator('.calendar-day-card .agenda-lunch')).toContainText('No school lunch');
      (receipt.verifiedClosures??=[]).push({date:meal.date,label:meal.closure||'Published no-school lunch',screen:'Calendar'});
    } else {
      for (const item of meal.items) await expect(page.locator('.calendar-day-card .agenda-lunch')).toContainText(item);
    }
    receipt.screens.push({ screen: 'Calendar', date: meal.date, lunch: await page.locator('.calendar-day-card .agenda-lunch').textContent() });
  }
  await page.locator('.calendar-day-card').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/calendar.png` });
  await page.getByRole('button', { name: 'Study', exact: true }).click();
  for (const label of ['Reading', 'Spelling', 'Math', 'Religion', 'Mix']) {
    await expect(page.locator('.study-game-tile').filter({has:page.locator('.study-game-copy > strong', {hasText:new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})})).toBeVisible({ timeout: 15000 });
  }
  await expect(page.locator('[data-game-start="reading"]')).toHaveAccessibleName('Reading / ELA');
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state', 'ready', { timeout: 15000 });
  await expect(page.locator('[data-study-source]')).toHaveCount(0);
  await expect(page.locator('[data-open-prep]')).toHaveAccessibleName(/test prep/i);
  await page.locator('[data-open-prep]').click();
  const testChoices=page.locator('[data-test-select]');
  for(const choice of await testChoices.all()){await expect(choice).toHaveRole('button');await expect(choice).toHaveAttribute('aria-pressed',/true|false/);}
  await page.screenshot({path:`${out}/test-prep.png`});
  receipt.screens.push({screen:'Test Prep',testCount:await testChoices.count()});
  await page.locator('[data-close-prep]').click();
  await expect(page.locator('.study-games-cta, .study-at-a-glance, [data-learning-panel]')).toHaveCount(0);
  const modeCount = await page.locator('.study-game-tile').count();
  expect(modeCount).toBe(5);
  await page.screenshot({ path: `${out}/study-games.png` });
  receipt.screens.push({ screen: 'Study', modeCount, sourcePolicy: 'current, recent, saved, Grade 2 fallback' });
  await page.locator('[data-game-start="mix"]').click();
  await expect(page.locator('.game-question-card')).toBeVisible();
  expect([3, 4]).toContain(await page.locator('.game-answer').count());
  await page.screenshot({ path: `${out}/study-quick-question.png` });
  await page.getByRole('button', { name: 'Back to study', exact: true }).click();
  await expect(page.locator('.study-game-tile')).toHaveCount(5);
  const studySource = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack-runtime.json').then(response => response.json());
    const engine = window.ABVMStudyGames;
    const catalog = engine.buildCatalog(envelope.pack, { sourceKey: engine.sourceKeyFromEnvelope(envelope.pack, envelope) });
    const { loadStudyMaterials } = await import('./study-materials.mjs');
    const materials = await loadStudyMaterials({ pack: envelope.pack, catalog, engine });
    const scope = materials.forMode('math', { source: 'weekly' });
    return { questions: scope.catalog.questions.filter(question => scope.eligibleIds.includes(question.id)), total: Math.min(8, scope.count) };
  });
  expect(studySource.total).toBeGreaterThan(0);
  await page.locator('[data-game-start="math"]').click();
  const playedQuestions = [];
  for (let index = 0; index < studySource.total; index++) {
    await expect(page.locator('.game-topbar')).toContainText(`${index + 1} of ${studySource.total}`);
    const prompt = await page.locator('.game-question-card > h2').innerText();
    const choices = await page.locator('[data-game-answer] strong').allTextContents();
    expect([3, 4]).toContain(choices.length);
    const question = studySource.questions.find(row => row.prompt === prompt && row.choices.length === choices.length && row.choices.every(choice => choices.includes(choice)));
    expect(question, 'live question belongs to the selected weekly source').toBeTruthy();
    const correct = choices.indexOf(question.answer);
    expect(correct).toBeGreaterThanOrEqual(0);
    if (index === 0) {
      await page.screenshot({ path: `${out}/study-question.png` });
      await page.locator('[data-game-hint]').click();
      await expect(page.locator('.game-hint')).toBeVisible();
      const wrong = choices.findIndex(choice => choice !== question.answer);
      await page.locator('[data-game-answer]').nth(wrong).click();
      await expect(page.locator('[data-game-answer]').nth(wrong)).toBeDisabled();
      await expect(page.locator('.game-feedback.retry')).toBeVisible();
      await expect(page.locator('[data-game-next]')).toHaveCount(0);
      await page.screenshot({ path: `${out}/study-retry.png` });
    }
    await page.locator('[data-game-answer]').nth(correct).click();
    await expect(page.locator('.game-feedback.correct')).toBeVisible();
    if (index === 0) {
      receipt.firstStudyResolution = await page.evaluate(skill => window.ABVMStudyGames.loadLearning()[skill].LastResolution, question.skill);
      expect(receipt.firstStudyResolution).toEqual(expect.objectContaining({ independent: false, attemptCount: 2, incorrectCount: 1, hintCount: 1 }));
      await page.screenshot({ path: `${out}/study-correct.png` });
    }
    playedQuestions.push(question.id);
    await page.locator('[data-game-next]').click();
  }
  await expect(page.locator('.game-finish')).toBeVisible();
  const expectedFirstTry = Math.max(0, studySource.total - 1);
  const expectedPercent = studySource.total ? Math.round((expectedFirstTry / studySource.total) * 100) : 0;
  await expect(page.locator('.game-score-summary > strong')).toHaveText(`${expectedFirstTry} / ${studySource.total} correct on the first try · ${expectedPercent}%`);
  await expect(page.locator('.game-score-summary > span')).toContainText('Corrected on retry: 1');
  await expect(page.locator('.game-score-summary > span')).toContainText('Hints used: 1');
  await expect(page.locator('.game-section-scores > div').filter({ hasText: 'Math' })).toContainText(`${expectedFirstTry} / ${studySource.total} · ${expectedPercent}%`);
  await expect(page.locator('.study-star-earned')).toContainText('+20 Study Stars');
  await page.screenshot({ path: `${out}/study-result.png` });
  receipt.studyWalkthrough = { mode: 'math', source: 'weekly', questions: playedQuestions, hint: true, retry: true, correct: true, completed: true, firstTryCorrect: expectedFirstTry, firstTryPercent: expectedPercent, earned: await page.locator('.study-star-earned').innerText() };
  await page.getByRole('button', { name: 'Back to study', exact: true }).click();
  await page.evaluate(async () => { if ('serviceWorker' in navigator) await navigator.serviceWorker.ready; });
  await page.reload();
  for (const label of ['Reading', 'Spelling', 'Math', 'Religion', 'Mix']) {
    await expect(page.locator('.study-game-tile').filter({has:page.locator('.study-game-copy > strong', {hasText:new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})})).toBeVisible({ timeout: 15000 });
  }
  await expect(page.locator('.study-game-tile')).toHaveCount(5);
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready', { timeout: 15000 });
  await expect(page.locator('[data-game-start="math"]')).toContainText(`Practiced before · Best solved: ${studySource.total} / ${studySource.total} (includes retries)`);
  receipt.savedSolvedLabel=await page.locator('[data-game-start="math"] em').innerText();
  for(const width of [390,820]){
    await page.setViewportSize({width,height:width===390?844:1080});
    await page.locator('[data-game-start="math"]').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${out}/study-saved-score-${width}.png`});
  }
  await page.setViewportSize({width:390,height:844});
  receipt.studyWalkthrough.returnedAndRecordSurvivedReload = true;
  // Exercise the actual published notes, without assuming any particular topic
  // or chapter must remain current forever. This browser profile is isolated.
  const printHistory=page.locator('[data-study-test-options]');
  const printHistoryBefore=await printHistory.innerHTML();
  await page.locator('[data-study-notes] > summary').click();
  const notes=page.locator('[data-study-notes]');
  const noteSearch=notes.getByRole('searchbox',{name:'Search study notes'});
  await expect(noteSearch).toBeVisible();
  let noteSubject=null,noteQuery=null;
  for(const width of [390,820]){
    await page.setViewportSize({width,height:width===390?844:1080});
    if(await notes.locator('.notes-reader').isVisible())await notes.locator('[data-notes-back]').click();
    await notes.locator('.notes-library-heading').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${out}/notes-library-${width}.png`,animations:'disabled'});
    const card=notes.locator('[data-notes-subject]').first();
    if(await card.count()){
      noteSubject=await card.getAttribute('aria-label');
      await card.click();
      const reader=notes.locator('[data-note-subject]:not([hidden])');
      await expect(reader.locator('h3')).toHaveText(noteSubject);
      noteQuery=await reader.locator('.study-note-topic li').first().count()
        ? (await reader.locator('.study-note-topic li').first().innerText()).slice(0,100) : noteSubject.slice(0,100);
      await noteSearch.fill(noteQuery);
      await expect(noteSearch).toBeFocused();
      await expect(noteSearch).toHaveValue(noteQuery);
      await notes.getByRole('button',{name:noteSubject,exact:true}).click();
      await expect(reader.locator('h3')).toHaveText(noteSubject);
      await notes.locator('[data-notes-back]').scrollIntoViewIfNeeded();
      await page.screenshot({path:`${out}/notes-reader-${width}.png`,animations:'disabled'});
      await notes.getByRole('button',{name:'Clear note search',exact:true}).click();
      await expect(noteSearch).toHaveValue('');
    }else await expect(notes.locator('.study-tools-empty')).toContainText('No lesson notes');
  }
  const subjectEvidence=[];
  for(const width of [390,820]){
    await page.setViewportSize({width,height:width===390?844:1080});
    for(const subject of ['Reading / ELA','Math','Religion']){
      await noteSearch.fill('');
      if(await notes.locator('.notes-reader').isVisible())await notes.locator('[data-notes-back]').click();
      const card=notes.getByRole('button',{name:subject,exact:true});
      if(!await card.count())continue;
      await card.click();
      const panel=notes.locator('[data-note-subject]:not([hidden])');
      await expect(panel.locator('summary').filter({hasText:/^Practice ideas/})).toHaveCount(0);
      await expect(panel.locator('.study-note-review > summary')).toHaveCount(0);
      const paragraphs=panel.locator('.study-note-point p');
      if(await paragraphs.count())await expect(paragraphs.first()).toBeVisible();
      const worked=panel.locator('.notes-worked-lesson');
      if(subject==='Math'&&await panel.locator('.study-note-topic').allTextContents().then(rows=>rows.some(text=>/\bsubtraction\b/i.test(text)))){
        await expect(worked).toContainText('12 − 5 = 7');await expect(worked).toContainText('7 + 5 = 12');
      }
      await page.screenshot({path:`${out}/notes-${subject.startsWith('Reading')?'reading':subject.toLowerCase()}-${width}.png`,animations:'disabled'});
      subjectEvidence.push({width,subject,classNoteParagraphs:await paragraphs.count(),chapterExplanationParagraphs:await panel.locator('.study-note-topic .notes-explanation p').count(),workedExamples:await worked.count()});
    }
  }
  expect(await printHistory.innerHTML()).toBe(printHistoryBefore);
  receipt.notesLibrary={verified:true,subject:noteSubject,query:noteQuery,historyUnchanged:true,subjects:subjectEvidence};
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  if (todayMeal?.items.length) for (const item of todayMeal.items) await expect(page.locator('.lunch-card')).toContainText(item);
  // Validate every deployed promotion in a new isolated browser profile, never in the learner's device storage.
  await expect(page.locator('.study-badge-latest')).toContainText('OF 22', {timeout:15000});
  await page.locator('.study-badge-latest[data-open-badges]').click();
  const rankCollection = page.locator('[data-badge-collection]');
  await expect(rankCollection).toBeVisible();
  const actualBadges = rankCollection.locator('.study-badge-grid img');
  await expect(actualBadges).toHaveCount(21);
  await expect.poll(()=>actualBadges.evaluateAll(images=>images.every(image=>image.complete && image.naturalWidth > 0))).toBe(true);
  const badgePaths = await actualBadges.evaluateAll(images=>images.map(image=>new URL(image.src).pathname));
  expect(new Set(badgePaths).size).toBe(21);
  expect(badgePaths.filter(path=>path.endsWith('-premium.webp')).length).toBe(15);
  expect(badgePaths.filter(path=>path.endsWith('.webp')).length).toBe(21);
  await expect(rankCollection.locator('.study-badge-grid').getByRole('listitem')).toHaveCount(21);
  await expect(rankCollection.locator('.study-badge-grid')).toContainText('ABVM Legend');
  await expect(rankCollection.locator('.study-badge-grid')).toContainText('Nest Explorer');
  const deployedThresholds = await page.evaluate(()=>window.ABVMStudyGames.studyBadgeCatalog().map(badge=>badge.target));
  expect(deployedThresholds).toEqual([25,50,75,100,150,200,250,300,375,450,525,600,700,800,900,1000,1100,1200,1300,1400,1500]);
  await page.screenshot({path:`${out}/rank-ladder.png`,animations:'disabled'});
  receipt.rankLadder = {totalRanks:22,permanentPromotions:21,originalWebpCount:7,newPremiumWebpCount:15,thresholds:deployedThresholds,allImagesLoaded:true};
  receipt.screens.push({screen:'Rank ladder',totalRanks:22});
  // Search a real published event after the normal cache-reload walkthrough.
  // No dated fixture or invented school event enters production acceptance.
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  const search = page.getByRole('searchbox', { name: 'Search calendar events' });
  await expect(search).toBeVisible();
  const searchable = data.pack.importantDates.find(row => row.label && /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i.test(row.date || ''));
  expect(searchable, 'a published dated event is required for live search acceptance').toBeTruthy();
  const query = searchable.label.slice(0, 80);
  await search.fill(query);
  const result = page.locator('.cal-search-list button').filter({ hasText: searchable.label }).first();
  await expect(result).toBeVisible();
  const selectedDate = await result.getAttribute('data-cal-search-date');
  expect(selectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.screenshot({path:`${out}/calendar-search.png`,animations:'disabled'});
  await result.click();
  await expect(page.locator(`[data-cal-day="${selectedDate}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.calendar-day-card .cal-event[open]')).toContainText(searchable.label);
  receipt.calendarSearch = { query, selectedDate, openedEvent: searchable.label, verified: true };
  receipt.screens.push({screen:'Calendar search',selectedDate});
  receipt.cacheReloadVerified = true;
  expect(receipt.consoleErrors).toEqual([]);
  receipt.verified = true;
} catch (error) {
  receipt.error = error.stack || String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  receipt.completedAt = new Date().toISOString();
  writeFileSync(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt, null, 2));
}
