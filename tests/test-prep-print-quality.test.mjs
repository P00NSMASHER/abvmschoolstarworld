import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTestStudyGuide,renderTestWorksheet} from '../pages/test-study-pair.mjs';
import {premiumPaperCss} from '../pages/premium-paper-theme.mjs';

const sample=(label,practice=[],extra={})=>({
  label,date:'2026-10-16',subject:'Reading / ELA',
  facts:['Review the verified class skill.'],practice,warnings:[],
  sourceLabel:'Reviewed ABVM class notes',sourceCheckedAt:'2026-10-15T11:00:00Z',...extra,
});

test('short-vowel guide teaches the complete cat-bed-pig-hot-sun picture without borrowing unrelated topics',()=>{
  const item={skill:'short-vowels',prompt:'Which word has short o?',answer:'hot',
    choices:['home','hot','rope'],explanation:'Hot has the short o sound.'};
  const html=renderTestStudyGuide(sample('Phonics (short vowels)',[item]));
  assert.match(html,/Picture the five short vowels/);
  for (const word of ['cat','bed','pig','hot','sun']) {
    assert.match(html,new RegExp('class="vowel-card"[^>]*>[\\s\\S]*?'+word));
  }
  assert.match(html,/cat, bed, pig, hot, sun/);
  assert.match(html,/Which word has short o\?/);
  assert.match(html,/Hot has the short o sound/);
  assert.match(html,/Teacher source checked 2026-10-15/);
  assert.doesNotMatch(renderTestStudyGuide(sample('Phonics (long i)',[
    {...item,skill:'long-i',prompt:'Which word has long i?'}])),/Picture the five short vowels/);
  assert.doesNotMatch(renderTestStudyGuide(sample('Religion Chapter 3',[],{subject:'Religion'})),/Picture the five short vowels/);
});

test('the student worksheet leaves generous original writing space and separates teaching notes into the parent key',()=>{
  const items=[
    {skill:'math-subtraction',prompt:'Solve 15 - 6.',answer:'9',
      choices:['8','9','10'],explanation:'Count back six from fifteen to reach nine.'},
    {skill:'math-subtraction',prompt:'What is 18 - 7?',answer:'11',
      choices:['10','11','12'],explanation:'Eighteen minus seven is eleven.'},
  ];
  const html=renderTestWorksheet(sample('Math (subtraction)',items,{subject:'Math'}));
  const student=html.split('<section class="sheet adult-key">')[0];
  const adult=html.split('<section class="sheet adult-key">')[1];
  assert.match(student,/class="math-work-canvas"/);
  assert.match(student,/class="math-answer"/);
  assert.match(student,/Before I finish/);
  assert.match(student,/math subtraction/);
  assert.doesNotMatch(student,/Count back six from fifteen/);
  assert.match(adult,/Why: Count back six from fifteen to reach nine/);
  assert.match(adult,/Why: Eighteen minus seven is eleven/);
  assert.match(adult,/11/);
});

test('print practice keeps every answer choice and offers full-width lines for written reasoning',()=>{
  const choices=['first','second','third','fourth','fifth'];
  const html=renderTestWorksheet(sample('Reading',[
    {skill:'text-evidence',prompt:'Which detail supports your answer?',answer:'fifth',
      choices,explanation:'The fifth detail is the matching reviewed evidence.'},
    {skill:'text-evidence',prompt:'Explain why the character acted that way.',
      answer:'The character was worried about the storm.',choices:[]},
  ]));
  const student=html.split('<section class="sheet adult-key">')[0];
  const parent=html.split('<section class="sheet adult-key">')[1];
  for(const option of ['A. first','B. second','C. third','D. fourth','E. fifth'])
    assert.ok(student.includes(option),option+' must not be lost');
  assert.match(student,/class="response-lines extended"/);
  assert.match(student,/Circle one answer/);
  assert.doesNotMatch(student,/The fifth detail is the matching reviewed evidence/);
  assert.match(parent,/Why: The fifth detail is the matching reviewed evidence/);
});

test('spelling study notes do not falsely teach that have obeys the silent-e rule',()=>{
  const guide=sample('Spelling (long o / Short ) / Handwriting',[],{
    subject:'Spelling / Handwriting',spellingWords:['home','have','cone','nose','fox'],
  });
  const html=renderTestStudyGuide(guide);
  assert.match(html,/Spelling Word Study/);
  assert.match(html,/Magic e:<\/b> home, cone, nose/);
  assert.match(html,/Watch out:<\/b> have/);
  assert.doesNotMatch(html,/Magic e:<\/b> have/);
  const worksheet=renderTestWorksheet(guide);
  assert.equal((worksheet.match(/class="dictation-item"/g)||[]).length,5);
  const student=worksheet.split('<section class="sheet adult-key">')[0];
  assert.doesNotMatch(student,/<strong>home<\/strong>/);
  assert.match(worksheet,/Adult Dictation List/);
});

test('paper theme keeps bright previews but uses grayscale outlines and splittable cards for home printing',()=>{
  assert.match(premiumPaperCss,/\.premium-paper \.vowel-cards/);
  assert.match(premiumPaperCss,/\.premium-paper \.response-lines/);
  assert.match(premiumPaperCss,/print-color-adjust:economy/);
  assert.match(premiumPaperCss,/\.premium-paper \.topic-grid\{display:block!important\}/);
  assert.match(premiumPaperCss,/\.premium-paper \.topic-card\{break-inside:auto!important/);
  assert.match(premiumPaperCss,/filter:grayscale\(1\) contrast\(1\.35\)/);
});
