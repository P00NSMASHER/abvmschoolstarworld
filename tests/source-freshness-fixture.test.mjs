import {test} from 'node:test';
import assert from 'node:assert/strict';
import {olderTeacherCheckWithNewNotice} from './helpers/source-freshness-fixture.mjs';

const eastern = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});
const easternDay = (timestamp) => eastern.format(new Date(timestamp));
const HOUR_MS = 3_600_000;

test('fixture stays distinct across every fifteen-minute boundary in 2026 and 2027', () => {
  let count = 0;
  for (let t = Date.parse('2026-01-01T00:00:00Z'); t < Date.parse('2028-01-01T00:00:00Z'); t += 15 * 60_000) {
    const {checkedAt, noticeAt} = olderTeacherCheckWithNewNotice(t);
    assert.notEqual(easternDay(checkedAt), easternDay(noticeAt), `source and notice collide at ${new Date(t).toISOString()}`);
    assert.equal(t - Date.parse(checkedAt), 27 * HOUR_MS);
    assert.equal(t - Date.parse(noticeAt), 60_000);
    count++;
  }
  assert.equal(count, 730 * 96);
});

test('reproduces Oct 31 to Nov 1 midnight collision that broke CI', () => {
  const t = Date.parse('2026-11-01T04:00:35Z');
  const priorChecked = new Date(t - 24 * HOUR_MS).toISOString();
  const priorNotice = new Date(t - 60_000).toISOString();
  assert.equal(easternDay(priorChecked), easternDay(priorNotice), 'the 24-hour predecessor falsely assumed different dates');
  const {checkedAt, noticeAt} = olderTeacherCheckWithNewNotice(t);
  assert.notEqual(easternDay(checkedAt), easternDay(noticeAt));
});

test('fails closed on impossible clock inputs', () => {
  assert.throws(() => olderTeacherCheckWithNewNotice(NaN), TypeError);
  assert.throws(() => olderTeacherCheckWithNewNotice(Infinity), TypeError);
});
