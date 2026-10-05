import test from 'node:test';
import assert from 'node:assert/strict';
import { publishedMealForDate } from '../scripts/published-meal.mjs';

test('publication proof finds Monday in the monthly archive after weekly rollover', () => {
  const monday = { date: '2026-10-05', items: ['Popcorn chicken'] };
  const pack = { lunchArchive: [monday], lunchMenu: [{ date: '2026-10-02', items: ['Pizza'] }] };
  assert.equal(publishedMealForDate(pack, monday.date), monday);
});
test('current weekly menu overrides archive and missing dates remain missing', () => {
  const current = { date: '2026-10-05', items: ['Revised meal'] };
  const pack = { lunchArchive: [{ date: current.date, items: ['Old meal'] }], lunchMenu: [current] };
  assert.equal(publishedMealForDate(pack, current.date), current);
  assert.equal(publishedMealForDate(pack, '2026-10-06'), undefined);
  assert.equal(publishedMealForDate({}, current.date), undefined);
});
