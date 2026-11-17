import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {questionsForTest} from '../pages/study-hub-core.mjs';
import {createStudyMaterials} from '../pages/study-materials.mjs';
import {buildGrade2ContentPipeline} from '../scripts/grade2-content-pipeline.mjs';
import {renderTestWorksheet} from '../pages/test-study-pair.mjs';

// Original ABVM questions generated from an announced skill, never teacher test wording.
const announced={date:'2026-11-20',label:'Spelling (long a) / Handwriting',kind:'test'};
const pack={sourceHash:'single-long-a-regression',sourceCheckedAt:'2026-11-16T23:32:10.126Z',
  weekLabel:'Week of November 16, 2026',teacherPostingWeekLabel:'Week of November 16, 2026',
  subjects:[{subject:'Spelling / Handwriting',topics:['Friday, Nov. 20 test focus: long a'],studyNotes:[]}],vocabulary:[]};
pack.contentPipeline=buildGrade2ContentPipeline(pack,{sourceHash:pack.sourceHash});
const rows=pack.contentPipeline.questions.filter(q=>q.skill==='long-short-a');
const expected=[
  'Which word has a long a sound because of the a_e pattern?',
  'Why does the a in “game” have a long sound?',
  'Which word uses the a_e pattern to make long a?',
];

test('a single long-a test retains three explicitly long-a questions from the combined bank',()=>{
  assert.equal(rows.length,8,'the reviewed family is still generated');
  assert.deepEqual(questionsForTest(announced,rows).map(q=>q.prompt),expected);
});

test('single-sound matching excludes short-only, mixed-focus and unknown-focus questions',()=>{
  const selected=questionsForTest(announced,rows);
  assert.ok(selected.length>0);
  assert.ok(selected.every(q=>!/^Which pair|short a sound|different a sound|compares/.test(q.prompt)));
  const unscoped={...rows[0],id:'scope-not-proved',prompt:'Which word matches this vowel pattern?'};
  assert.deepEqual(questionsForTest(announced,[unscoped]),[]);
  const wrongVowel={...rows[0],id:'wrong-vowel',prompt:'Which word has a long i sound?',skill:'short-i-long-i',sourceFact:'Short i and long i'};
  assert.deepEqual(questionsForTest(announced,[wrongVowel]),[]);
  assert.equal(questionsForTest({...announced,label:'Spelling (short a / long a)'},rows).length,8,
    'an explicitly combined test retains its full reviewed bank');
  assert.deepEqual(questionsForTest({...announced,label:'Spelling (short a)'},rows).map(q=>q.prompt),[
    'Which pair of words both use the short a sound?', 'Which word has the short a sound?',
  ]);
});

test('a photographed spelling item remains locked to its actual date',()=>{
  const photographed={...rows[0],sourceFact:'Photo-confirmed weekly spelling words for 2026-11-13'};
  assert.deepEqual(questionsForTest(announced,[photographed]),[]);
  assert.deepEqual(questionsForTest({...announced,date:'2026-11-13'},[photographed]),[photographed]);
  const unknownShort={...rows[0],skill:'long-short-o',prompt:'Which word has a short o sound?',sourceFact:'Long and short o'};
  assert.deepEqual(questionsForTest({label:'Spelling (long o / Short )',date:'2026-11-20'},[unknownShort]),[],
    'a missing short vowel is still unknown');
});

test('the actual engine, Test Prep model and printable worksheet agree on the scoped bank',()=>{
  const storage={getItem:()=>null,setItem:()=>{}};
  const context=vm.createContext({window:{},console,Intl,Date,localStorage:storage});
  vm.runInContext(readFileSync(new URL('../pages/study-games.js',import.meta.url),'utf8'),context);
  const engine=context.window.ABVMStudyGames,catalog=engine.buildCatalog(pack);
  const model=createStudyMaterials({pack,catalog,events:[announced],engine,storage,
    now:()=>Date.parse('2026-11-17T00:00:00Z')});
  assert.equal(model.upcomingTests().supported[0]?.count,3);
  assert.equal(model.testPreview(0).total,3);
  assert.deepEqual(model.testGuide(0).practice.map(q=>q.prompt),expected);
  const round=model.testRound({index:0,upcoming:true,seed:'single-sound'});
  assert.equal(round.questions.length,3);
  assert.ok(round.questions.every(q=>expected.includes(q.prompt)));
  const paper=renderTestWorksheet(model.testGuide(0));
  assert.equal((paper.match(/class="problem /g)||[]).length,3);
  for(const answer of ['game','gate','The final e helps the a say its name.'])
    assert.ok(paper.split('<section class="sheet adult-key">')[1].includes(answer));
  assert.ok(!paper.includes('Which word has the short a sound?'));
});
