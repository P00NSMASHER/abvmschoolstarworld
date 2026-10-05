import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { approvedArtwork, buildArtPlan, hasLunch, pendingArtMenus, renderLunchArtwork } from '../scripts/build-lunch-art-plan.mjs';
import { CATALOG, catalogMeals } from '../scripts/lunch-publication.mjs';
const meal = catalogMeals().find(meal => meal.date === '2026-10-05');
const entry = { id: 'popcorn-chicken', src: 'assets/lunch-art/popcorn-chicken.webp', alt: 'Illustration of popcorn chicken', status: 'reviewed', reviewedAt: '2026-10-05T04:00:00Z', reviewNotes: 'Entrée only; no sides depicted.', approvedMenus: [meal] };
const registry = { schemaVersion: 1, artworks: [entry] };

test('exact reviewed menu displays labeled art, changed sides or source do not', () => {
  const map = approvedArtwork(catalogMeals(), registry);
  assert.match(renderLunchArtwork(meal, map), /Meal illustration/);
  assert.match(renderLunchArtwork(meal, map), /popcorn-chicken.webp/);
  assert.equal(renderLunchArtwork({ ...meal, items: [...meal.items, 'Milk'] }, map), '');
  assert.equal(renderLunchArtwork({ ...meal, sourceId: 'unreviewed-source' }, map), '');
});
test('no-school, no-lunch, missing and unreviewed entries show no image', () => {
  assert.equal(hasLunch({ status: 'no-school', items: [] }), false);
  assert.equal(hasLunch({ items: ['No lunch — noon dismissal'] }), false);
  assert.equal(hasLunch({ items: ['Not available'] }), false);
  assert.equal(hasLunch({ items: [] }), false);
  assert.deepEqual(approvedArtwork(catalogMeals(), { ...registry, artworks: [{ ...entry, status: 'pending' }] }), {});
});
test('registry rejects stale menu approval, unsafe path and duplicate mapping', () => {
  assert.throws(() => approvedArtwork(catalogMeals(), { ...registry, artworks: [{ ...entry, approvedMenus: [{ ...meal, items: ['Unknown food'] }] }] }), /unknown menu/);
  assert.throws(() => approvedArtwork(catalogMeals(), { ...registry, artworks: [{ ...entry, src: 'https://example.com/image.png' }] }), /Invalid/);
  assert.throws(() => approvedArtwork(catalogMeals(), { ...registry, artworks: [entry, entry] }), /Duplicate/);
});
test('monthly plan is deterministic, records exact menu and omits non-meal days', () => {
  const plan = buildArtPlan(CATALOG, registry);
  assert.deepEqual(plan, buildArtPlan(CATALOG, registry));
  const october = plan.menus.filter(menu => menu.dates.some(date => date.startsWith('2026-10')));
  assert.equal(october.length, 20);
  assert.equal(october.filter(menu => menu.status === 'ready').length, 1);
  assert.ok(october.every(menu => !menu.dates.includes('2026-10-09') && !menu.dates.includes('2026-10-12')));
  assert.match(october.find(menu => menu.items[0] === 'Taco Tuesday & chips').prompt, /ambiguous.*human review/);
});

test('automatic queue includes current and future menus without expired-month churn', () => {
  const plan = buildArtPlan(CATALOG, registry);
  const queue = pendingArtMenus(plan, '2026-10');
  assert.equal(queue.length, 19);
  assert.ok(queue.every(menu => menu.dates.some(date => date >= '2026-10-01')));
  assert.equal(pendingArtMenus(plan, '2026-11').length, 0);
  assert.throws(() => pendingArtMenus(plan, '2026-13'), /Invalid/);
  const future = { ...plan, menus: [...plan.menus, { artwork: null, dates: ['2026-11-02'] }] };
  assert.equal(pendingArtMenus(future, '2026-10').length, 20);
});

test('published October registry covers every meal and leaves all closures text-only', () => {
  const published = JSON.parse(readFileSync(new URL('../pages/data/lunch-art-registry.json', import.meta.url), 'utf8'));
  const meals = catalogMeals();
  const map = approvedArtwork(meals, published);
  const october = meals.filter(meal => meal.date.startsWith('2026-10'));
  assert.equal(october.filter(meal => renderLunchArtwork(meal, map)).length, 20);
  assert.equal(october.filter(meal => !hasLunch(meal)).length, 2);
  assert.ok(october.filter(meal => !hasLunch(meal)).every(meal => renderLunchArtwork(meal, map) === ''));
  assert.equal(pendingArtMenus(buildArtPlan(CATALOG, published), '2026-10').length, 0);
});
