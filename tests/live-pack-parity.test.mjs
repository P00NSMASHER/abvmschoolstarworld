import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sameDeployedStudyPack} from '../scripts/live-pack-parity.mjs';

const governed=JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url),'utf8'));

test('live deployment accepts exactly the governed study pack',()=>{
  assert.equal(sameDeployedStudyPack(governed,structuredClone(governed)),true);
  assert.equal(sameDeployedStudyPack(governed,null),false);
  assert.equal(sameDeployedStudyPack(governed,{}),false);
});

test('matching teacher timestamp and content hash cannot hide changed answers, tests or evidence',()=>{
  const mutations=[
    live=>{live.pack.contentPipeline.questions[0].answer='Wrong answer';},
    live=>{live.pack.importantDates[0].label='Tampered calendar event';},
    live=>{live.sourcePages[0].contentHash='a'.repeat(64);},
    live=>{live.pack.subjects[0].topics=['Unverified topic'];},
    live=>{live.pack.lunchMenuSource.retrievalState='unavailable';},
    live=>{live.pack.untrustedExtra=true;},
  ];
  for(const [index,mutate] of mutations.entries()){
    const live=structuredClone(governed);
    mutate(live);
    assert.equal(live.sourceLastCheckedAt,governed.sourceLastCheckedAt);
    assert.equal(live.pack.sourceHash,governed.pack.sourceHash);
    assert.equal(live.pack.lunchMenuHash,governed.pack.lunchMenuHash);
    assert.equal(sameDeployedStudyPack(governed,live),false,'tampering case '+index);
  }
});

test('the actual Pages verifier compares complete governed JSON and checks published bytes',()=>{
  const script=readFileSync(new URL('../scripts/verify-live-lunch.mjs',import.meta.url),'utf8');
  assert.match(script,/sameDeployedStudyPack\(expected,data\)/);
  assert.match(script,/assets\.push\('data\/study-pack\.json', 'data\/study-pack-runtime\.json'/);
  assert.match(script,/actualHash === expectedHash/);
  assert.match(script,/Verify live lunch data and visible mobile flows|receipt\.verified = true/);
});
