import assert from 'node:assert/strict';
import test from 'node:test';
import {renderTestStudyGuide} from '../pages/test-study-pair.mjs';

const childPage=guide=>renderTestStudyGuide(guide).split('<main')[1].split('<details')[0];

test('shortening keeps the last word, rule, and classroom fact without printing a bank of drills',()=>{
  const words=Array.from({length:32},(_,i)=>'word'+String.fromCharCode(97+i%26)+(i>=26?'s':''));
  const extra='The two letters stay together even at the end of a word.';
  const fact='Remember to read the last word on the back of the page.';
  const practice=Array.from({length:20},(_,i)=>({skill:'new-pattern',prompt:'Practice '+i+'?',answer:'yes'}));
  const guide={label:'Spelling (new pattern) / Handwriting',spellingWords:words,practice,
    reviewTopics:[{id:'new-pattern',label:'New pattern',notes:['Find the pair of letters.',extra]}],
    teacherFacts:[fact],classFacts:[fact,extra]};
  const html=childPage(guide);
  for(const word of words)assert.ok(html.includes('<strong>'+word+'</strong>'));
  assert.ok(html.includes(extra));
  assert.equal(html.split(fact).length-1,1);
  assert.equal(html.split(extra).length-1,1);
  assert.doesNotMatch(html,/Practice (?:0|19)\?/);
  assert.match(html,/Handwriting/);
});

test('a familiar rule can gain a new exception without losing the new text',()=>{
  const rule='Most nouns add -s to become plural; nouns ending in sounds such as s, x, and ch often add -es.';
  const updated=rule+' The plural of child is children.';
  const guide={label:'Grammar (plural nouns)',reviewTopics:[{id:'singular-plural-nouns',label:'Plural nouns',notes:[rule,updated]}]};
  const html=childPage(guide);
  assert.match(html,/cat → cats/);
  assert.match(html,/box → boxes/);
  assert.ok(html.includes(updated));
});

test('source model preserves a long week-matched word list and withdraws it the following week',async()=>{
  const {createStudyMaterials}=await import('../pages/study-materials.mjs');
  const words=Array.from({length:32},(_,i)=>'word'+String.fromCharCode(97+Math.floor(i/26),97+i%26));
  const pack={weekLabel:'Week of November 2, 2026',subjects:[{subject:'Spelling / Handwriting',
    studyNotes:['Teacher spelling words: '+words.join(', ')]}]};
  const model=createStudyMaterials({pack,events:['2026-11-06','2026-11-13'].map(date=>({
    date,label:'Spelling (consonant digraphs) / Handwriting'})),now:()=> '2026-11-06T10:00:00Z'});
  assert.deepEqual(model.testGuide(0).spellingWords,words);
  assert.deepEqual(model.testGuide(1).spellingWords,[]);
  assert.ok(!renderTestStudyGuide(model.testGuide(1)).includes(words.at(-1)));
});

test('named papers cannot inherit unrelated questions or other sections of a shared teacher line',async()=>{
  const {createStudyMaterials}=await import('../pages/study-materials.mjs');
  const p={subjects:[{subject:'Reading / ELA',topics:[],studyNotes:[
    'Reading comprehension: Main idea / details; diagrams & labels; text features',
  ]}],vocabulary:[{subject:'Reading / ELA',term:'mammal'}]};
  const question=(subject,skill)=>({id:skill,subject,skill,tier:'material',prompt:'Example for '+skill,
    choices:['a','b'],answer:'a'});
  const catalog={questions:[
    ...['main-idea-details','suffix-ed-ing','singular-plural-nouns'].map(skill=>question('Reading / ELA',skill)),
    question('Math','telling-time'),question('Math','coin-addition'),
    question('Reading / ELA','subject-predicate'),question('Spelling / Handwriting','suffix'),
  ]};
  const get=label=>createStudyMaterials({pack:p,catalog,now:()=>Date.parse('2026-11-02T17:00:00Z'),
    events:[{date:'2026-11-04',label}]}).testGuide(0);
  const reading=get('Reading (main idea / details)');
  assert.deepEqual([...new Set(reading.practice.map(q=>q.skill))],['main-idea-details']);
  assert.deepEqual(reading.classFacts,['Reading comprehension: Main idea / details']);
  assert.deepEqual(reading.vocabulary,[]);
  assert.deepEqual(get('Math (telling time)').practice.map(q=>q.skill),['telling-time']);
  for(const label of ['Reading (unlisted story)','Grammar (adjectives)','Spelling (homophones)'])
    assert.deepEqual(get(label).practice,[],label);
});

test('a chapter paper keeps all question IDs and notes from matching dated lessons only',async()=>{
  const {createStudyMaterials}=await import('../pages/study-materials.mjs');
  const {readFileSync}=await import('node:fs');
  const schoolwork=JSON.parse(readFileSync(new URL('../pages/data/schoolwork.json',import.meta.url)));
  const lessons=schoolwork.lessons.filter(l=>['nov3-photo-math-ch2-written','nov3-photo-math-ch2-four-choice'].includes(l.id));
  assert.equal(lessons.length,2);
  const wrongLesson=(name,date,title,studiedOn)=>({...lessons[0],weekOf:date,studiedOn,title,notes:[name],
    questions:[{...lessons[0].questions[0],id:name,prompt:name,skill:'place-value'}]});
  const model=createStudyMaterials({schoolwork:{lessons:[...lessons,
    wrongLesson('other chapter','2026-11-02','Chapter 21 place value'),
    wrongLesson('prior week','2026-10-26','Chapter 2 place value'),
    wrongLesson('undated',null,'Chapter 2 place value'),
    wrongLesson('conflicting dates','2026-11-02','Chapter 2 place value','2026-10-30'),
  ]},events:[{date:'2026-11-05',label:'Math (Ch. 2)'}],now:()=>Date.parse('2026-11-04T17:00:00Z')});
  const guide=model.testGuide(0);
  assert.deepEqual(new Set(guide.practice.map(q=>q.prompt)),new Set(lessons.flatMap(l=>l.questions.map(q=>q.prompt))));
  assert.deepEqual(new Set(guide.classFacts),new Set(lessons.flatMap(l=>l.notes)));
  assert.ok(guide.practice.some(q=>q.skill==='counting-by-tens'));
  assert.ok(guide.practice.some(q=>q.skill==='number-words-to-numerals'));
});
