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

test('reviewed school closure overrides a district meal during the next publication week',()=>{
  const meal={date:'2026-10-20',sourceId:'reviewed-district-menu',items:['Chicken tacos']};
  const pack={lunchMenu:[meal],importantDates:[{date:'Tuesday, Oct. 20',kind:'holiday',label:'Grade 2 / K–4: No School — Parent-Teacher Conferences'}]};
  assert.equal(publishedMealForDate(pack,meal.date).status,'no-school');
  assert.deepEqual(publishedMealForDate(pack,meal.date).items,[]);
  assert.deepEqual(meal.items,['Chicken tacos']);
});

test('closure date matching handles ranges and retains nearby open-school meals',()=>{
  const dates=['2026-10-19','2026-10-20','2026-10-21','2026-10-22'];
  const pack={lunchMenu:dates.map(date=>({date,items:['Reviewed meal']})),importantDates:[{date:'Tuesday–Wednesday, Oct. 20–21',kind:'holiday',label:'No School'}]};
  assert.equal(publishedMealForDate(pack,dates[0]),pack.lunchMenu[0]);
  for(const date of dates.slice(1,3))assert.equal(publishedMealForDate(pack,date).status,'no-school');
  assert.equal(publishedMealForDate(pack,dates[3]),pack.lunchMenu[3]);
  pack.importantDates=[{date:'Tuesday, Oct. 20',kind:'conference',label:'Parent-teacher conferences'}];
  assert.equal(publishedMealForDate(pack,dates[1]),pack.lunchMenu[1]);
});

test('closure proof supports year-crossing breaks and explicit dated records without leaking years',()=>{
  const pack={importantDates:[{date:'Dec. 24–Jan. 2',kind:'holiday',label:'No School'}]};
  assert.equal(publishedMealForDate(pack,'2027-01-01').status,'no-school');
  assert.equal(publishedMealForDate(pack,'2026-12-24').status,'no-school');
  assert.equal(publishedMealForDate(pack,'2027-01-03'),undefined);
  pack.importantDates=[{date:'Oct. 20, 2025',kind:'holiday',label:'No School'}];
  assert.equal(publishedMealForDate(pack,'2026-10-20'),undefined);
  pack.importantDates=[{date:'2026-10-20',kind:'holiday',label:'No School'}];
  assert.equal(publishedMealForDate(pack,'2026-10-20').status,'no-school');
});
