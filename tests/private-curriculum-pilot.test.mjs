import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { buildPrivateCurriculumPilotHtml, writePrivateCurriculumPilot } from '../scripts/build-private-curriculum-pilot.mjs';
import { readHeldCandidates, auditHeldCurriculumPilot } from '../scripts/audit-held-curriculum-pilot.mjs';

const payloadFrom = html => {
  const m = html.match(/<script id="pilot-payload" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(m,'missing inert payload');
  return JSON.parse(m[1]);
};
const clone = () => structuredClone(readHeldCandidates());

test('offline educator pilot faithfully exposes 32 held questions without editing the manifests',()=>{
  const input = readHeldCandidates();
  const before=JSON.stringify(input);
  const html = buildPrivateCurriculumPilotHtml(input);
  const payload=payloadFrom(html);
  assert.equal(payload.families.length,4);
  assert.equal(payload.families.reduce((n,f)=>n+f.questions.length,0),32);
  assert.equal(payload.contentFingerprint,auditHeldCurriculumPilot(input).contentFingerprint);
  assert.equal(JSON.stringify(input),before);
  assert.equal(payload.evidenceClass,'LOCAL_UNRECORDED_PREVIEW');
  for(let i=0;i<4;i++){
    assert.equal(payload.families[i].topic,input[i].topic);
    for(let j=0;j<8;j++){
      const received=payload.families[i].questions[j];
      const original=input[i].proposedQuestions[j];
      for(const key of ['prompt','hint','answer','explanation'])assert.equal(received[key],original[key]);
      assert.deepEqual(received.choices,original.choices);
    }
  }
});

test('offline file strictly blocks external network, active embedded assets and persistent tracking',()=>{
  const html=buildPrivateCurriculumPilotHtml();
  for(const policy of ["default-src 'none'","connect-src 'none'","worker-src 'none'","form-action 'none'","object-src 'none'"])assert.ok(html.includes(policy),policy);
  assert.match(html,/script-src 'sha256-[A-Za-z0-9+/=]+'/);
  assert.match(html,/style-src 'sha256-[A-Za-z0-9+/=]+'/);
  assert.match(html,/noindex,nofollow,noarchive/);
  assert.doesNotMatch(html,/\b(?:fetch\s*\(|sendBeacon\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|serviceWorker)\b/);
  assert.doesNotMatch(html,/<(?:img|iframe|link|form|audio|video)\b/i);
  assert.match(html, /No tracking or data collection/);
  assert.match(html,/cannot serve as learner-use evidence/);
});

test('untrusted prompts cannot close inert JSON script or inject active markup',()=>{
  const candidates=clone();
  candidates[0].proposedQuestions[0].prompt="Read this: </script><img src=x onerror=alert('oops')>. Which is safest?";
  const html=buildPrivateCurriculumPilotHtml(candidates);
  assert.ok(!html.includes("</script><img"));
  assert.ok(html.includes("\\u003c/script\\u003e"));
  assert.equal(payloadFrom(html).families[0].questions[0].prompt,candidates[0].proposedQuestions[0].prompt);
});

test('private reviewer file is generated outside the repository and never overwrites existing data',()=>{
  const dir=mkdtempSync(join(tmpdir(),'abvm-educator-pilot-test-'));
  try {
    const first=writePrivateCurriculumPilot({directory:dir});
    assert.ok(first.path.startsWith(dir));
    assert.equal(first.questions,32);
    assert.equal(first.recordedLearnerData,false);
    assert.equal(first.evidenceClass,'SYNTHETIC_TEST_ONLY');
    assert.deepEqual(readdirSync(dir),['educator-pilot.html']);
    assert.equal(readFileSync(first.path,'utf8'),buildPrivateCurriculumPilotHtml());
    // Windows does not implement POSIX owner/group/other permission bits.
    if (process.platform !== 'win32') assert.equal(statSync(first.path).mode & 0o777,0o600);
    assert.throws(()=>writePrivateCurriculumPilot({directory:dir}),/EEXIST/);
  } finally { rmSync(dir,{force:true,recursive:true}); }
});

test('private pilot refuses generation under the repository tree',()=>{
  const inside=dirname(fileURLToPath(import.meta.url));
  assert.throws(()=>writePrivateCurriculumPilot({directory:inside}),/outside the Git repository/);
});

test('held-default or answer-key tampering fails before rendering any pilot',()=>{
  const auto=clone();auto[0].enabledByDefault=true;
  assert.throws(()=>buildPrivateCurriculumPilotHtml(auto),/release-hold/);
  const bad=clone();bad[1].proposedQuestions[0].answer='invalid';
  assert.throws(()=>buildPrivateCurriculumPilotHtml(bad),/invalid-answer-key/);
});

test('a full pilot preview contains no actual result, permission or educator verification claims',()=>{
  const html=buildPrivateCurriculumPilotHtml();
  assert.match(html,/not published/i);
  assert.match(html,/neither is required to promote an independently verified question family/);
  assert.match(html,/not be placed in Pages/);
  assert.doesNotMatch(html,/\b(?:pilot passed|learner verified|educator approved automatically)\b/i);
});
