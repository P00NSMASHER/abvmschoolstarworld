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
