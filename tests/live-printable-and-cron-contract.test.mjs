import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const verifier=readFileSync(new URL('../scripts/verify-live-lunch.mjs',import.meta.url),'utf8');
const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');
const teacher=readFileSync(new URL('../.github/workflows/sync-study-pack.yml',import.meta.url),'utf8');
const homework=readFileSync(new URL('../.github/workflows/refresh-current-homework.yml',import.meta.url),'utf8');

test('live printable verification selects full accessible test name instead of shortened display text',()=>{
  assert.ok(verifier.includes("page.locator('[data-test-select]').and(page.getByRole('button',{name:check.label}))"));
  assert.ok(!verifier.includes("filter({hasText:check.label})"));
  assert.ok(verifier.includes("frame.locator('.student-test .problem')"));
  assert.ok(verifier.includes("frame.locator('.adult-key .key-list li')"));
  assert.ok(verifier.includes("verifiedQuestions:prompts.length"));
  assert.ok(verifier.includes("Cats name more than one cat."));
});

test('live printable acceptance checks only still-announced upcoming test dates',()=>{
  assert.ok(verifier.includes("const noLongerUpcoming=eastToday()>check.date"));
  assert.ok(verifier.includes("check.label.test(row.label)"));
  assert.ok(verifier.includes("Number(check.date.slice(-2))"));
  assert.ok(verifier.includes("reason:posted?'assessment concluded':'teacher announcement changed'"));
});

test('operational documentation describes the actual Eastern cron schedule rather than stale UTC claims',()=>{
  for(const slot of ["17 6 * * *","47 9 * * *","17 13 * * *","47 15 * * *"])
    assert.ok(teacher.includes(slot),'teacher cron missing '+slot);
  assert.ok(homework.includes("7,37 6-23 * * *"));
  assert.ok(readme.includes("America/New_York"));
  assert.ok(readme.includes("twice hourly"));
  assert.ok(!readme.includes("06:23–23:23 UTC"));
  assert.ok(!readme.includes("four scheduled UTC source scans"));
});
