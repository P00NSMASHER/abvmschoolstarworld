import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifiedSpellingDictationWords} from '../scripts/live-spelling-dictation-evidence.mjs';
import {renderTestWorksheet} from '../pages/test-study-pair.mjs';

const words=['scratch','catch','scrape','sting','spring','throne','stripe','strange',
  'far','shred','flower','shrub','until','splash','split'];
const label='Spelling (3 letter blends) / Handwriting';
const pack=()=>({
  spellingListProvenance:{
    weekLabel:'Week of November 9, 2026',
    sourceUrl:'https://sites.google.com/view/abvmgr2/weekly-spelling-list',
    wordsHash:createHash('sha256').update(JSON.stringify(words)).digest('hex'),
  },
  subjects:[{subject:'Spelling / Handwriting',studyNotes:[
    'Skill: 3 letter blends',
    'Teacher-posted spelling words (page undated): '+words.join(', '),
  ]}],
});

test('current source-hashed spelling list is accepted as a real dictation paper, not six multiple-choice items',()=>{
  assert.deepEqual(verifiedSpellingDictationWords(pack(),'2026-11-13',label),words);
  const paper=renderTestWorksheet({
    label,subject:'Spelling / Handwriting',date:'2026-11-13',
    spellingWords:words,practice:Array.from({length:8},(_,i)=>({
      skill:'three-letter-blends',prompt:'Original example '+i,
      choices:['street','scrub','splash'],answer:'street',
    })),
  });
  assert.equal((paper.match(/class="dictation-item"/g)||[]).length,words.length);
  assert.match(paper,/Adult Dictation List/);
  assert.doesNotMatch(paper,/class="sheet student-test/);
});

test('old week, wrong skill, corrupted hash and foreign source never count as verified dictation',()=>{
  const old=pack();old.spellingListProvenance.weekLabel='Week of November 2, 2026';
  assert.deepEqual(verifiedSpellingDictationWords(old,'2026-11-13',label),[]);
  const different=pack();different.subjects[0].studyNotes[0]='Skill: consonant digraphs';
  assert.deepEqual(verifiedSpellingDictationWords(different,'2026-11-13',label),[]);
  const modified=pack();modified.subjects[0].studyNotes[1]+=', banana';
  assert.deepEqual(verifiedSpellingDictationWords(modified,'2026-11-13',label),[]);
  const noDigest=pack();delete noDigest.spellingListProvenance.wordsHash;
  assert.deepEqual(verifiedSpellingDictationWords(noDigest,'2026-11-13',label),[]);
  const foreign=pack();foreign.spellingListProvenance.sourceUrl='https://example.invalid/spelling';
  assert.deepEqual(verifiedSpellingDictationWords(foreign,'2026-11-13',label),[]);
  assert.deepEqual(verifiedSpellingDictationWords(pack(),'2026-11-20',label),[]);
  assert.deepEqual(verifiedSpellingDictationWords(pack(),'2026-11-13','Grammar (singular & plural nouns)'),[]);
});

test('live verifier passes the selected teacher label, not a regex, to the strict dictation source gate',()=>{
  const src=readFileSync(new URL('../scripts/verify-live-lunch.mjs',import.meta.url),'utf8');
  assert.match(src,/selectedTestKey=await worksheet\.getAttribute\('data-test-key'\)/);
  assert.match(src,/selectedTestLabel=selectedTestKey\.slice\(check\.date\.length\+1\)/);
  assert.match(src,/verifiedSpellingDictationWords\(data\.pack,check\.date,selectedTestLabel\)/);
  assert.doesNotMatch(src,/verifiedSpellingDictationWords\(data\.pack,check\.date,check\.label\)/);
  assert.deepEqual(verifiedSpellingDictationWords(pack(),'2026-11-13',/3 letter blends/i),[],
    'search regex is not a teacher title and must never authorize dictation');
});
