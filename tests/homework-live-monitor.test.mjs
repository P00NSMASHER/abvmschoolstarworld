import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeTeacherHomework} from '../scripts/homework-posting.mjs';
import {homeworkPublicationErrors,liveHomeworkUrl} from '../scripts/homework-live-monitor.mjs';

const observedAt='2026-10-21T19:17:50.979Z';
const now='2026-10-21T19:35:00.000Z';
const verified=summarizeTeacherHomework(['Homework','Spelling Choice Board activity','Math Page 29-30'],observedAt);

test('live Homework must match the entire verified posting, not merely source hash',()=>{
  assert.deepEqual(homeworkPublicationErrors(verified,structuredClone(verified),now),[]);
  const wrong=structuredClone(verified);
  wrong.assignments[1].task='Page 28'; // same hash and timestamp, corrupted body
  assert.equal(wrong.contentHash,verified.contentHash);
  assert.match(homeworkPublicationErrors(verified,wrong,now).join(' '),/does not match/);
  const old=structuredClone(verified);
  old.checkedAt='2026-10-21T15:21:51.820Z';
  assert.match(homeworkPublicationErrors(verified,old,now).join(' '),/does not match/);
  assert.match(homeworkPublicationErrors(verified,null,now).join(' '),/unavailable/);
});

test('saved Homework age and Eastern school-day provenance remain required',()=>{
  const stale=summarizeTeacherHomework(['Homework','Math Page 29-30'],'2026-10-20T22:00:00Z');
  assert.match(homeworkPublicationErrors(stale,structuredClone(stale),now).join(' '),/stale or invalid/);
  const bad={...verified,checkedAt:'not-a-date'};
  assert.match(homeworkPublicationErrors(bad,structuredClone(bad),now).join(' '),/stale or invalid/);
});

test('public Homework endpoint must share the verified study-pack URL scope',()=>{
  assert.equal(
    liveHomeworkUrl('https://p00nsmasher.github.io/abvmschoolstarworld/data/study-pack.json?health=123'),
    'https://p00nsmasher.github.io/abvmschoolstarworld/data/homework-current.json'
  );
  assert.equal(liveHomeworkUrl('http://127.0.0.1:4173/data/study-pack.json'),
    'http://127.0.0.1:4173/data/homework-current.json');
  for(const url of ['https://example.test/other.json','https://example.test/data/study-pack.json.bad']){
    assert.throws(()=>liveHomeworkUrl(url),/Expected the public study-pack/);
  }
});

test('real live watchdog checks independent Homework parity and reports it',()=>{
  const script=readFileSync(new URL('../scripts/check-refresh-health.mjs',import.meta.url),'utf8');
  assert.match(script,/HOMEWORK_PATH/);
  assert.match(script,/fetchLiveHomework/);
  assert.match(script,/homeworkPublicationErrors\(localHomework,candidateHomework,new Date\(\).toISOString\(\)\)/);
  assert.match(script,/Deployed Homework parity:/);
  assert.doesNotMatch(script,/continue-on-error: true/);
});
