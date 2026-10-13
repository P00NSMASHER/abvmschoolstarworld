import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {adaptivePracticeRound,practiceIdentity,learningRows,learningSummaryMarkup} from '../pages/study-experience.mjs';
const question=(n,skill='addition')=>({id:String(n),prompt:`Question ${n}`,answer:String(n),skill,choices:[String(n),'other']});
const pool=Array.from({length:24},(_,i)=>question(i));

test('non-test rounds never exceed eight questions',()=>assert.equal(adaptivePracticeRound([pool],100).length,8));
test('same seed and history reproduce selection',()=>assert.deepEqual(adaptivePracticeRound([pool],8,31),adaptivePracticeRound([pool],8,31)));
test('no question is duplicated across overlapping sources',()=>{const rows=adaptivePracticeRound([pool,pool],8,7);assert.equal(new Set(rows.map(practiceIdentity)).size,8)});
test('source turns stay balanced',()=>{const rows=adaptivePracticeRound([pool,pool.map((q,i)=>question(i+100,'reading'))],8,4);assert.equal(rows.filter(q=>q.skill==='reading').length,4)});
test('due and missed work precedes ordinary material',()=>{const rows=adaptivePracticeRound([[question(1,'mastered'),question(2,'due'),question(3,'missed')]],3,1,{learning:{mastered:{Seen:5},due:{Seen:3},missed:{Seen:2}},priority:s=>({mastered:.5,due:6,missed:4})[s]});assert.equal(rows[0].skill,'due');assert.equal(rows[1].skill,'missed')});
test('unseen material is not starved by due work',()=>{const rows=adaptivePracticeRound([[...pool,question(100,'unseen')]],8,1,{learning:{addition:{Seen:4}},priority:s=>s==='addition'?6:1});assert.equal(rows[1].skill,'unseen')});
test('recent items are avoided when equivalent fresh items exist',()=>{const first=adaptivePracticeRound([pool],8,1);const second=adaptivePracticeRound([pool],8,2,{recent:first.map(practiceIdentity)});assert.equal(second.filter(q=>first.some(x=>practiceIdentity(x)===practiceIdentity(q))).length,0)});
test('three rounds can cover twenty-four distinct eligible items',()=>{let recent=[];for(let i=0;i<3;i++){const rows=adaptivePracticeRound([pool],8,i,{recent});assert.equal(rows.filter(q=>recent.includes(practiceIdentity(q))).length,0);recent.push(...rows.map(practiceIdentity));}assert.equal(new Set(recent).size,24)});
for(const value of [null,{},[],[null],[[null]],[[undefined]]])test(`invalid or empty groups are safe: ${JSON.stringify(value)}`,()=>assert.deepEqual(adaptivePracticeRound(value),[]));
test('failing optional priority does not break practice',()=>assert.equal(adaptivePracticeRound([pool],8,1,{priority(){throw Error('unavailable')}}).length,8));
test('question arrays are never mutated',()=>{const before=structuredClone(pool);adaptivePracticeRound([pool],8);assert.deepEqual(pool,before)});
test('summary counts questions within skills, never inflated mastery',()=>{const row=learningRows({addition:{Seen:8,IndependentCorrect:3,CorrectAfterRetry:2,LastResolution:{independent:false}}})[0];assert.equal(row.answered,8);assert.equal(row.independent,3);assert.equal(row.assisted,2);assert.equal(row.review,true)});
test('corrupt counts cannot produce Infinity or negative display',()=>{assert.deepEqual(learningRows({bad:{Seen:Infinity}}),[]);const row=learningRows({x:{Seen:4,IndependentCorrect:999,CorrectAfterRetry:99}})[0];assert.equal(row.independent,4);assert.equal(row.assisted,0)});
test('summary escapes unexpected saved labels',()=>assert(!learningSummaryMarkup({'<script>':{Seen:1}}).includes('<script>')));
test('empty history is honestly labeled',()=>assert(learningSummaryMarkup({}).includes('No answered practice')));

function loadEngine(){
 const storage=new Map();const window={};const ctx=vm.createContext({window,console,Date,Intl,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)}});
 vm.runInContext(readFileSync(new URL('../pages/study-games.js',import.meta.url),'utf8'),ctx);
 return window.ABVMStudyGames;
}
const pack=JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url),'utf8')).pack;
const engine=loadEngine(),catalog=engine.buildCatalog(pack),math=catalog.questions.filter(q=>q.subject==='Math'&&q.tier==='star-fallback');
test('Math fallback has forty or more distinct checked items',()=>{assert(math.length>=40);assert.equal(new Set(math.map(practiceIdentity)).size,math.length);assert.equal(engine.validateCatalog(catalog).length,0)});
test('new Math remains explicitly original grade-level fallback',()=>{for(const q of math.filter(q=>q.id.startsWith('grade2-math-variety-'))){assert.equal(q.tier,'star-fallback');assert.match(q.sourceFact,/not a teacher test question/);assert.equal(q.originalEquivalent,true)}});
test('new Math distributes valid answer keys across all choice positions',()=>{
 const added=loadEngine().buildCatalog(pack).questions.filter(q=>q.id.startsWith('grade2-math-variety-'));
 assert.equal(added.length,32);
 const positions=[0,0,0];
 for(const q of added){
  assert.equal(q.choices.length,3,q.id);
  assert.equal(new Set(q.choices).size,3,q.id);
  assert.equal(q.choices.filter(choice=>choice===q.answer).length,1,q.id);
  positions[q.choices.indexOf(q.answer)]++;
 }
 assert(positions.every(count=>count>0&&count<=added.length/2),`Correct-answer positions must all occur without a majority: ${positions}`);
});
test('new Math choice order is deterministic across independent engine loads',()=>{
 const snapshot=()=>Array.from(loadEngine().buildCatalog(pack).questions.filter(q=>q.id.startsWith('grade2-math-variety-')),q=>({id:q.id,choices:Array.from(q.choices)}));
 const first=snapshot();
 assert.equal(first.length,32);
 assert.deepEqual(snapshot(),first);
 assert.deepEqual(snapshot(),first);
});
test('new arithmetic, time, comparison, chart and measurement keys independently recompute',()=>{
 const added=math.filter(q=>q.id.startsWith('grade2-math-variety-'));assert.equal(added.length,32);
 for(const q of added){
  const n=q.prompt.match(/\d+/g).map(Number);let expected;
  switch(q.skill){
   case 'addition-within-100':expected=String(n[0]+n[1]);break;
   case 'subtraction-within-100':case 'data-interpretation':expected=String(n[0]-n[1]);break;
   case 'measurement':expected=(n[0]-n[1])+' centimeters';break;
   case 'two-step-word-problem':expected=String(n[0]+n[1]-n[2]);break;
   case 'place-value':expected=String(Number(String(n[0]).at(-2))*10);break;
   case 'compare-numbers':expected=String(Math.max(...n));break;
   case 'time':{const total=n[0]*60+n[1]+n[2];expected=(Math.floor(total/60)%12||12)+':'+String(total%60).padStart(2,'0');break;}
   default:assert.fail('Unvalidated skill '+q.skill);
  }
  assert.equal(q.answer,expected,q.prompt);assert.equal(q.choices.filter(x=>x===expected).length,1,q.prompt);
 }
});
test('Math rounds stay in subject with no duplicates across four hundred seeds',()=>{for(let seed=0;seed<400;seed++){const round=engine.selectQuestions(catalog,{subjects:['Math'],count:8,seed:String(seed)});assert.equal(round.length,8);assert(round.every(q=>q.subject==='Math'));assert.equal(new Set(round.map(practiceIdentity)).size,8)}});
test('every reviewed schoolwork item has a non-boilerplate instructional cue',()=>{const data=JSON.parse(readFileSync(new URL('../pages/data/schoolwork.json',import.meta.url),'utf8'));const qs=data.lessons.flatMap(l=>l.questions);assert(qs.length>=52);assert(new Set(qs.map(q=>q.hint)).size>=20);for(const q of qs){assert(!q.hint.includes('Review the example in this lesson'));assert(q.hint.length>=35);assert.equal(q.choices.filter(c=>c===q.answer).length,1)}});
test('new modules and stylesheet are present in offline asset manifest',()=>{
 const sw=readFileSync(new URL('../pages/sw.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../pages/app.js',import.meta.url),'utf8');
 const loaded=app.match(/load\("(\.\/study-games\.js\?v=\d+)","ABVMStudyGames"\)/);
 assert(loaded,'the app must load a versioned Study Games engine');
 for(const name of ['study-experience.mjs','study-teaching.css?v=1','study-support.js?v=3',loaded[1]])assert(sw.includes(name),name);
});

// Rotation must survive actual display/answer recording, not just new seeds.
test('three completed Math sessions avoid reusing recently shown questions',()=>{
 const e=loadEngine(),c=e.buildCatalog(pack),prompts=[];
 for(let i=0;i<3;i++){
  const round=e.selectQuestions(c,{subjects:['Math'],count:8,seed:String(i),skillStats:e.loadLearning()});
  assert.equal(round.length,8);
  for(const q of round){e.markQuestionShown(q,c.sourceKey);e.recordLearning(q,true,{attemptCount:1,incorrectCount:0,hintCount:0});prompts.push(q.prompt);}
 }
 assert.equal(new Set(prompts).size,24);
});

test('a sparse current subject bank fills with STAR-style practice only after current material',()=>{
 const e=loadEngine();
 const current={id:'single-current',subject:'Math',skill:'math-subtraction',tier:'material',questionType:'direct',difficulty:2,prompt:'Single current subtraction question',answer:'5',choices:['5','4','6'],variantFingerprint:'single-current'};
 const star=Array.from({length:8},(_,i)=>({id:'thin-star-'+i,subject:'Math',skill:'place-value',tier:'star-fallback',questionType:'direct',difficulty:2,prompt:'Thin fallback '+i,answer:String(i),choices:[String(i),String(i+1),String(i+2)],variantFingerprint:'thin-star-'+i}));
 const catalog={sourceKey:'sparse-current-subject',questions:[current,...star]};
 e.markQuestionShown({id:'prior-reading',subject:'Reading / ELA',skill:'theme',tier:'material',questionType:'direct',difficulty:2,variantFingerprint:'prior-reading'},catalog.sourceKey);
 const first=e.selectQuestions(catalog,{subjects:['Math'],count:8,seed:'first',skillStats:{}});
 assert.equal(first.length,8);
 assert.equal(first[0].id,'single-current');
 assert(first.slice(1).every(q=>q.tier==='star-fallback'));
 e.markQuestionShown(first[0],catalog.sourceKey);
 const second=e.selectQuestions(catalog,{subjects:['Math'],count:8,seed:'second',skillStats:{}});
 assert.equal(second.length,8);
 assert(second.every(q=>q.tier==='star-fallback'));
});

test('subject mode uses fresh current material first, then fresh STAR fallback before repeating',()=>{
 const e=loadEngine();
 const current=Array.from({length:9},(_,i)=>({
  id:'current-math-'+i,subject:'Math',skill:'math-subtraction',tier:'material',
  questionType:['direct','transfer','reasoning'][i%3],difficulty:2,
  prompt:'Current subtraction question '+i,answer:String(i),
  choices:[String(i),String(i+1),String(i+2)],variantFingerprint:'current-math-'+i
 }));
 const star=Array.from({length:32},(_,i)=>({
  id:'star-math-'+i,subject:'Math',skill:'place-value',tier:'star-fallback',
  questionType:['direct','transfer','reasoning'][i%3],difficulty:2,
  prompt:'Fallback math question '+i,answer:String(i),
  choices:[String(i),String(i+1),String(i+2)],variantFingerprint:'star-math-'+i
 }));
 const catalog={sourceKey:'subject-fallback-rotation',questions:[...current,...star]};
 const rounds=[];
 for(let i=0;i<3;i++){
  const round=e.selectQuestions(catalog,{subjects:['Math'],count:8,seed:String(i),skillStats:{}});
  assert.equal(round.length,8);
  rounds.push(round);
  for(const q of round)e.markQuestionShown(q,catalog.sourceKey);
 }
 assert.equal(rounds[0].filter(q=>q.tier==='material').length,8);
 assert.equal(rounds[1].filter(q=>q.tier==='material').length,1);
 assert.equal(rounds[1].filter(q=>q.tier==='star-fallback').length,7);
 assert.equal(rounds[2].filter(q=>q.tier==='star-fallback').length,8);
 const ids=rounds.flat().map(q=>q.id);
 assert.equal(new Set(ids).size,24);
});

test('corrupt optional recent/history state cannot crash non-test selection',()=>{
  for(const learning of [null,[],5,'bad'])for(const recent of [null,{},5])assert.equal(adaptivePracticeRound([pool],8,1,{learning,recent}).length,8);
});
