import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../.github/workflows/'+name,import.meta.url),'utf8').replace(/\r\n/g,'\n');

test('hosted-runner provisioning receives a bounded 60-minute budget without weakening QA',()=>{
  const qa=read('qa.yml'),repro=read('qa-reproduction.yml');
  const privacy=read('public-privacy-visual-acceptance.yml'),pages=read('pages.yml');
  for(const [name,source] of Object.entries({qa,repro,privacy,pages})){
    assert.match(source,/timeout-minutes:\s*60/,name+' needs enough time for real browser QA');
    assert.match(source,/npx playwright install --with-deps chromium webkit/,name+' must install both engines');
  }
  for(const [name,source] of Object.entries({qa,repro,privacy})){
    assert.match(source,/if-no-files-found: error/,name+' required PR proof must fail closed');
  }
  assert.match(qa,/npm run qa:unit/);
  assert.match(qa,/npm run qa:e2e/);
  assert.match(repro,/npm run qa:unit/);
  assert.match(repro,/npm run qa:e2e/);
  assert.match(repro,/Verify publication checker against candidate app/);
  assert.match(privacy,/Verify exact review-head commit/);
  assert.match(privacy,/Anonymous iPhone 375-430 Chromium and Safari-WebKit/);
  assert.doesNotMatch(privacy,/continue-on-error:\s*true/);
  assert.match(pages,/Run release QA[\s\S]*run: npm run qa/);
  assert.match(pages,/Recheck protected-main before publishing/);
  assert.match(pages,/Verify live lunch data and visible mobile flows/);
});


test('source-gated visual and fresh-curriculum QA retain full engine checks within adequate runner budgets',()=>{
  const visual=[
    'study-visual-acceptance.yml',
    'today-visual-acceptance.yml',
    'study-player-visual-acceptance.yml',
    'study-tools-visual.yml',
  ];
  for(const file of visual){
    const source=read(file);
    assert.ok(source.includes('timeout-minutes: 60'),file+' has sufficient job budget');
    assert.ok(source.includes('name: Cache version-pinned Playwright browsers'),file+' caches installed browsers');
    assert.ok(source.includes('npx playwright install --with-deps chromium webkit'),file+' installs both browsers');
    assert.ok(source.includes('--project=mobile --project=iphone-webkit'),file+' runs both mobile engines');
    assert.ok(source.includes('if: always()'),file+' retains evidence');
    assert.ok(!source.includes('continue-on-error: true'),file+' has mandatory visual gate');
  }
  const teacher=read('teacher-refresh-candidate.yml');
  assert.ok(teacher.includes('timeout-minutes: 60'));
  assert.ok(teacher.includes('Generate a fresh candidate from all verified teacher pages'));
  assert.ok(teacher.includes('Reject unverified curriculum and source-lineage gaps'));
  assert.ok(teacher.includes('Verify fresh teacher check, not just a recent notice import'));
  assert.ok(teacher.includes('npm run qa'));
  assert.ok(teacher.includes('npx playwright install --with-deps chromium webkit'));
});
