import assert from 'node:assert/strict';
import test from 'node:test';

import {cleanTeacherText, pageLines, parseHomework, parseStoryTitles, spellingSourceLines, teacherContentLines} from '../scripts/teacher-page-parsers.mjs';

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

test('official Google Sites small/span spelling rows preserve all 15 words including home', () => {
  const rows = [
    '<small class="zfr3Q"><span>Skill: short and long</span></small>',
    '<small class="zfr3Q"><span>Basic Words</span><span class="Apple-tab-span"> </span><span>Review Words</span></small>',
    '<small class="zfr3Q"><span>box</span><span class="Apple-tab-span"> </span><span>side</span></small>',
    '<small class="zfr3Q"><span>fox</span><span class="Apple-tab-span"> </span><span>line</span></small>',
    '<small class="zfr3Q"><span>dog</span></small>',
    '<small class="zfr3Q"><span>lock</span></small>',
    '<small class="zfr3Q"><span>pot</span><span>High Frequency Words</span></small>',
    '<small class="zfr3Q"><span>cone</span><span>have</span></small>',
    '<small class="zfr3Q"><span>home</span><span>off</span></small>',
    '<small class="zfr3Q"><span>nose</span><span>took</span></small>',
    '<small class="zfr3Q"><span>poke</span></small>',
    '<small class="zfr3Q"><span>rope</span></small>',
  ];
  const html = '<h1>Weekly Spelling List</h1><p>Home</p>'
    + rows.join('') + '<script><small><span>secret</span></small></script>';
  assert.deepEqual(pageLines(html), ['Weekly Spelling List', 'Home']);
  const notes = spellingSourceLines(html);
  assert.deepEqual(notes, [
    'Skill: short and long', 'Basic Words', 'Review Words',
    'box', 'side', 'fox', 'line', 'dog', 'lock', 'pot',
    'High Frequency Words', 'cone', 'have', 'home', 'off',
    'nose', 'took', 'poke', 'rope',
  ]);
  assert.equal(notes.filter(line => /^(?:box|fox|dog|lock|pot|cone|home|nose|poke|rope|side|line|have|off|took)$/.test(line)).length, 15);
  assert(!notes.includes('secret'));
  // Navigation "Home" must never silently remove the spelling word "home".
  assert(notes.includes('home'));
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



test('teacherContentLines treats Religion as navigation on the spelling page', () => {
  assert.deepEqual(
    teacherContentLines(['Weekly Spelling List','Religion','Reading Work','Homework','Tests','More Home'], 'Weekly Spelling List'),
    []
  );
});


test('parseStoryTitles handles malformed mixed story quotes from the live teacher page', () => {
  assert.deepEqual(
    parseStoryTitles('"Little Flap Learns to Fly" \'Help! A Story of Friendship'),
    ['Little Flap Learns to Fly', 'Help! A Story of Friendship']
  );
});

test('parseHomework reads the official teacher page’s undelimited math and spelling lines', () => {
  const rows = parseHomework([
    'Homework',
    'Math pg. 22',
    'Spelling Choice Board activity',
    'Read',
    'Parents: cover books',
    'Reading log (please keep Reading log & Behavior chart in the HW folder)',
    'Everything should be returned in the HW folder',
  ]);
  assert.deepEqual(rows.slice(0, 2).map(row => [row.subject, row.task]), [
    ['Math', 'Page 22'],
    ['Spelling', 'Spelling Choice Board activity'],
  ]);
});

test('current official Math paper and Spelling choice board survive parsing, unlike recurring chores',()=>{
  const html='<h1>Homework</h1><p>Homework</p><p>Math paper</p><p>Spelling Choice Board activity</p>'
    +'<p>Read</p><p>Parents: cover books</p>'
    +'<p>Reading log (please keep Reading log &amp; Behavior chart in the HW folder)</p>'
    +'<p>Everything should be returned in the HW folder</p>';
  const rows=parseHomework(pageLines(html));
  assert.deepEqual(rows.filter(row=>['Math','Spelling'].includes(row.subject))
    .map(row=>[row.subject,row.task]),[
      ['Math','Math paper'],['Spelling','Spelling Choice Board activity']
    ]);
});
test('Math paper variants remain explicit without weakening textbook page parsing',()=>{
  const rows=parseHomework(['Homework','Math: paper','Math packet','Math pg. 22','Spelling Choice Board activity']);
  assert.deepEqual(rows.filter(row=>row.subject==='Math').map(row=>row.task),[
    'Math paper','Packet','Page 22'
  ]);
});
test('unknown Math assignment never disappears silently behind a valid Spelling line',()=>{
  assert.throws(
    ()=>parseHomework(['Homework','Math take-home assessment','Spelling Choice Board activity']),
    /Unrecognized Math assignment/
  );
});
