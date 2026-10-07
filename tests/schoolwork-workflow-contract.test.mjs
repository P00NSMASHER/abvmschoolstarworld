import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const workflowPath = new URL('../docs/SCHOOLWORK_INTAKE.md', import.meta.url);
const agentsPath = new URL('../AGENTS.md', import.meta.url);

test('schoolwork intake keeps the canonical 12-step cumulative workflow in order', async () => {
  const text = await readFile(workflowPath, 'utf8');
  const headings = [
    '### 1. Preserve the original source',
    '### 2. Identify the assignment and supported date',
    '### 3. Extract the questions and printed task',
    "### 4. Identify the student's responses",
    '### 5. Identify teacher markings and corrections',
    '### 6. Determine correct and incorrect independently',
    '### 7. Map every scorable problem to academic skills',
    '### 8. Compare the skills with longitudinal history',
    '### 9. Update mastery and confidence states',
    '### 10. Decide whether targeted practice is warranted',
    '### 11. Update the cumulative ABVM learning record',
    '### 12. Update the current week and test-prep views only when relevant'
  ];
  let previous = -1;
  for (const heading of headings) {
    const index = text.indexOf(heading);
    assert(index > previous, `Missing or out-of-order workflow heading: ${heading}`);
    previous = index;
  }
});

test('schoolwork workflow preserves the public/private boundary and cumulative semantics', async () => {
  const text = (await readFile(workflowPath, 'utf8')).toLowerCase();
  for (const phrase of [
    'raw photos, ocr dumps',
    'student responses are evidence for analysis, not public content',
    'teacher marks',
    'knowledge gap, concept gap, procedure error, reading/comprehension, recall',
    'not-enough-evidence -> learning -> improving -> mastered',
    'compare each observed skill with prior evidence',
    'target the smallest useful need',
    'private longitudinal archive',
    'public abvm repository'
  ]) assert(text.includes(phrase), `Missing workflow contract phrase: ${phrase}`);
});

test('root agent instructions route schoolwork photos through the 12-step contract', async () => {
  const text = await readFile(agentsPath, 'utf8');
  assert(text.includes('canonical **12-step cumulative** intake process'));
  for (let step = 1; step <= 12; step += 1) assert(new RegExp(`^\\s*${step}\\. `, 'm').test(text));
  assert(/public repository/i.test(text));
  assert(/private archive/i.test(text));
});
