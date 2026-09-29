import assert from 'node:assert/strict';
import test from 'node:test';

import {cleanTeacherText, pageLines, parseHomework, parseStoryTitles, teacherContentLines} from '../scripts/teacher-page-parsers.mjs';

test('pageLines reads current Google Sites text containers without scripts', () => {
  const html = `
    <h1>Homework</h1>
    <ul><li>Math:</li><li>pg. 42</li></ul>
    <table><tr><td>Reading: Read 20 minutes</td></tr></table>
    <script><p>Spelling: should not leak</p></script>
  `;
  assert.deepEqual(pageLines(html), [
    'Homework',
    'Math:',
    'pg. 42',
    'Reading: Read 20 minutes',
  ]);
});

test('parseHomework accepts inline subject assignments with colon dash or em dash', () => {
  const rows = parseHomework([
    'Homework',
    'Spelling - Choice Board',
    'Math: pg. 18',
    'Reading — Read 20 minutes',
  ]);
  assert.deepEqual(rows.map(row => [row.subject, row.task]), [
    ['Spelling', 'Spelling Choice Board'],
    ['Math', 'Page 18'],
    ['Reading', 'Read 20 minutes'],
  ]);
});

test('parseHomework accepts split subject headers and assignment lines', () => {
  const rows = parseHomework([
    'Homework',
    'Math:',
    'pg. 27 #1-8',
    'Reading',
    'Read chapter 3',
  ]);
  assert.deepEqual(rows.map(row => [row.subject, row.task]), [
    ['Math', 'Page 27 #1-8'],
    ['Reading', 'Read chapter 3'],
  ]);
});

test('parseHomework does not require every academic subject on every posting', () => {
  const rows = parseHomework([
    'Homework',
    'Math: Page 31',
    'Parents: Sign the communication folder',
  ]);
  assert.equal(rows.some(row => row.subject === 'Math'), true);
  assert.equal(rows.some(row => row.subject === 'Spelling'), false);
  assert.equal(rows.some(row => row.subject === 'Reading'), false);
});


test('parseHomework accepts the live September 26 teacher posting', () => {
  const rows = parseHomework([
    'Homework',
    'Attend Mass',
    'Read',
    'Parents: cover books',
    'Reading log (please keep Reading log & Behavior chart in the HW folder)',
    'Everything should be returned in the HW folder',
  ]);
  assert.deepEqual(rows.map(row => [row.subject, row.task, row.due]), [
    ['Religion', 'Attend Mass', 'Current posting'],
    ['Reading', 'Read', 'Current posting'],
    ['Parent', 'Cover books', 'Current posting'],
    ['Reading', 'Keep Reading Log and Behavior Chart in the HW folder', 'Ongoing'],
    ['Homework Folder', 'Return everything in the HW folder', 'Next school day'],
  ]);
});
test('parseHomework accepts an explicit no-homework posting', () => {
  assert.deepEqual(parseHomework(['Homework', 'No homework!']), [{
    day: 'Current Homework posting',
    subject: 'Homework',
    task: 'No homework assigned',
    due: 'Current posting',
  }]);
});

test('parseHomework still fails closed when nothing academic can be verified', () => {
  assert.throws(
    () => parseHomework(['Homework', 'Remember your water bottle.', 'Picture Day is Friday.']),
    /verifiable academic assignment or an explicit no-homework state/
  );
});


test('teacherContentLines removes Google Sites navigation chrome from lesson content', () => {
  assert.deepEqual(teacherContentLines([
    'Religion',
    'Home',
    'Reading Work',
    'Weekly Spelling List',
    'Homework',
    'Tests',
    'More Home',
    'Unit 1: God Gives Us Life & Love',
    "Chapter 2: Jesus is God's Best Gift",
  ], 'Religion'), [
    'Unit 1: God Gives Us Life & Love',
    "Chapter 2: Jesus is God's Best Gift",
  ]);
});

test('parseStoryTitles separates the two live story titles cleanly', () => {
  assert.deepEqual(
    parseStoryTitles('"Little Flap Learns to Fly" \'Help! A Story of Friendship\''),
    ['Little Flap Learns to Fly', 'Help! A Story of Friendship']
  );
});

test('cleanTeacherText fixes obvious teacher-page typo without changing meaning', () => {
  assert.equal(cleanTeacherText('visualize, theme, dioalogue'), 'Visualize, theme, dialogue');
});


test('teacherContentLines removes Google Sites navigation from actual lesson content', () => {
  assert.deepEqual(teacherContentLines([
    'Religion','Home','Reading Work','Weekly Spelling List','Homework','Tests','More Home',
    'Unit 1: God Gives Us Life & Love',
    "Chapter 2: Jesus is God's Best Gift",
  ], 'Religion'), [
    'Unit 1: God Gives Us Life & Love',
    "Chapter 2: Jesus is God's Best Gift",
  ]);
});

test('parseStoryTitles separates the two quoted Reading Work stories', () => {
  assert.deepEqual(
    parseStoryTitles('"Little Flap Learns to Fly" “Help! A Story of Friendship”'),
    ['Little Flap Learns to Fly', 'Help! A Story of Friendship']
  );
});

test('cleanTeacherText corrects obvious teacher-page spelling noise', () => {
  assert.equal(cleanTeacherText('visualize, theme, dioalogue'), 'Visualize, theme, dialogue');
});
