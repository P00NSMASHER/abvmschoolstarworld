import test from 'node:test';
import assert from 'node:assert/strict';
import {
  teacherTestReferenceForGuide, classroomPracticeReferenceForGuide,
  checkedBubblePaperFormat, classroomPracticeFormatSummary
} from '../pages/teacher-test-format.mjs';
import {renderTestStudyGuide,renderTestWorksheet} from '../pages/test-study-pair.mjs';
import {createStudyMaterials,testRetryPriority} from '../pages/study-materials.mjs';

const question=(id,choices,skill='common-proper-nouns')=>({
  id:'original-synthetic-'+id,subject:'Reading / ELA',skill,
  prompt:'Which original sentence has the right capital letter '+id+'?',
  choices,answer:choices[1],
  explanation:'Synthetic explanation kept on the parent page.',
  sourceFact:'Original verified lesson topic.',
});
const nounGuide=practice=>({
  label:'Grammar (Common & Proper Nouns)',subject:'Reading / ELA',date:'2026-11-04',
  practice,facts:['Proper nouns identify particular names.'],warnings:[],
  sourceLabel:'Original practice aligned with class skills',
});
const mathGuide=practice=>({
  label:'Math (Ch. 2)',subject:'Math',date:'2026-11-04',
  practice,facts:['Place value: hundreds, tens and ones.'],warnings:[],
  sourceLabel:'Original grade 2 place-value practice',
});

test('genuine noun assessment selects only verified three-bubble format and prints every original item',()=>{
  const practice=Array.from({length:10},(_,i)=>question(i+1,['Use lowercase','Capitalize the name','Keep both lowercase']));
  const guide=nounGuide(practice);
  assert.equal(teacherTestReferenceForGuide(guide)?.origin,'prior-actual-teacher-test');
  assert.equal(checkedBubblePaperFormat(guide,practice)?.optionCount,3);
  const html=renderTestWorksheet(guide);
  const student=html.split('<section class="sheet adult-key">')[0];
  const adult=html.split('<section class="sheet adult-key">')[1];
  assert.match(student,/student-test teacher-bubble-choice/);
  assert.match(student,/teacher-bubble-choice-problems/);
  assert.match(student,/Fill in one bubble/);
  assert.equal((student.match(/class="problem teacher-bubble-choice-item"/g)||[]).length,10);
  assert.equal((student.match(/class="teacher-bubble-mark"/g)||[]).length,30);
  assert.match(html,/teacher-bubble-choice-problems\{columns:2/);
  for(const q of practice)assert.ok(student.includes(q.prompt));
  assert.doesNotMatch(student,/Synthetic explanation kept on the parent page/);
  assert.match(adult,/Synthetic explanation kept on the parent page/);
  assert.match(adult,/Parent Answer Key/);
  assert.match(student,/future format is not guaranteed/);
});

test('math Chapter 2 publisher practice uses four bubbles while remaining explicitly non-test evidence',()=>{
  const practice=Array.from({length:16},(_,i)=>({
    ...question(i+1,['hundreds','tens','ones','thousands'],'place-value'),
    subject:'Math',answer:'tens',prompt:'Which place does the digit occupy in new number '+(i+1)+'?',
  }));
  const guide=mathGuide(practice);
  assert.equal(teacherTestReferenceForGuide(guide),null,'publisher practice is not a teacher-issued test');
  const profile=classroomPracticeReferenceForGuide(guide);
  assert.equal(profile?.origin,'prior-teacher-marked-publisher-practice');
  assert.equal(checkedBubblePaperFormat(guide,practice)?.optionCount,4);
  const student=renderTestWorksheet(guide).split('<section class="sheet adult-key">')[0];
  assert.match(student,/student-test teacher-bubble-choice/);
  assert.equal((student.match(/class="problem teacher-bubble-choice-item"/g)||[]).length,16);
  assert.equal((student.match(/class="teacher-bubble-mark"/g)||[]).length,64);
  assert.match(student,/next test format is unverified/);
  const notes=renderTestStudyGuide(guide);
  assert.match(notes,/Previous publisher practice format \(not a teacher-issued test\)/);
  assert.match(notes,/next test format is unverified/);
  assert.match(classroomPracticeFormatSummary(guide),/not a teacher-issued test/);
});

test('mixed source-backed questions use only eligible bubble formats and preserve generic responses',()=>{
  const rows=[question(1,['one','two','three']),{
    ...question(2,['one','two','three']),answer:'not a checked answer',
  }];
  const guide=nounGuide(rows),student=renderTestWorksheet(guide).split('<section class="sheet adult-key">')[0];
  assert.equal(checkedBubblePaperFormat(guide,rows),null);
  assert.equal((student.match(/class="problem teacher-bubble-choice-item"/g)||[]).length,1);
  assert.equal((student.match(/class="problem pick-problem"/g)||[]).length,1);
  assert.match(student,/1 of 2 items use the observed bubble layout/);
  assert.ok(rows.every(q=>student.includes(q.prompt)));
  assert.equal(teacherTestReferenceForGuide({...guide,label:'Reading Text Set 4'}),null);
  assert.equal(classroomPracticeReferenceForGuide({...guide,label:'Math Chapter 1B',subject:'Math'}),null);
});

test('Math worksheet preserves mixed three/four-option original questions without fabricating a fourth answer',()=>{
  const practice=[
    {id:'four',subject:'Math',skill:'place-value',prompt:'Four-choice synthetic math problem?',
      choices:['1','2','3','4'],answer:'2',explanation:'Synthetic source explanation.'},
    {id:'three',subject:'Math',skill:'place-value',prompt:'Three-choice synthetic math problem?',
      choices:['5','6','7'],answer:'6',explanation:'Synthetic source explanation.'},
  ];
  const guide=mathGuide(practice),student=renderTestWorksheet(guide).split('<section class="sheet adult-key">')[0];
  assert.equal((student.match(/class="problem teacher-bubble-choice-item"/g)||[]).length,1);
  assert.equal((student.match(/class="problem pick-problem"/g)||[]).length,1);
  assert.equal((student.match(/class="teacher-bubble-mark"/g)||[]).length,4);
  assert.ok(practice.every(q=>student.includes(q.prompt)));
  assert.match(student,/1 of 2 items use the observed bubble layout/);
  assert.doesNotMatch(student,/Synthetic source explanation/);
});

test('private learning priority only selects unresolved skill evidence',()=>{
  assert.equal(testRetryPriority(null),0);
  assert.equal(testRetryPriority({Seen:0,ConsecutiveWrong:9}),0);
  assert.equal(testRetryPriority({Seen:2,LastResolution:{correct:true,independent:true},Wrong:4}),0);
  assert.equal(testRetryPriority({Seen:1,LastResolution:{correct:false,independent:false}}),5);
  assert.equal(testRetryPriority({Seen:2,LastResolution:{correct:true,independent:false}}),4);
  assert.equal(testRetryPriority({Seen:2,CorrectAfterRetry:1,LastSeenAt:100,LastIndependentCorrectAt:0}),2);
});

test('test-specific retry includes only matched weak skills, never unrelated subjects or independently mastered skills',()=>{
  const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
  const evidence={
    'place-value':{Seen:2,LastResolution:{correct:false,independent:false},ConsecutiveWrong:1},
    'expanded-form':{Seen:3,LastResolution:{correct:true,independent:true},Wrong:4},
    'number-words':{Seen:1,LastResolution:{correct:true,independent:false},CorrectAfterRetry:1},
    'unrelated-reading':{Seen:1,LastResolution:{correct:false,independent:false}},
  };
  const q=(id,skill,subject='Math')=>({
    id,skill,subject,tier:'material',questionType:'direct',difficulty:2,
    prompt:'Synthetic checked question '+id+'?',answer:'B',choices:['A','B','C'],
    sourceFact:'Original checked classroom practice',explanation:'Reviewed skill.',
  });
  const questions=[
    q('weak-math-1','place-value'),q('weak-math-2','place-value'),
    q('recovered-math','number-words'),q('strong-math','expanded-form'),
    q('unrelated-reading','unrelated-reading','Reading / ELA'),
  ];
  const model=createStudyMaterials({
    now:()=> '2026-11-04T16:00:00Z', storage,pack:{sourceHash:'verified-math-v2',subjects:[]},
    events:[{date:'2026-11-04',label:'Math (Ch. 2)'}],
    catalog:{sourceKey:'verified-v2',questions},
    engine:{loadLearning:()=>evidence,nextSessionSeed:()=> 'fixed-seed'},
  });
  const preview=model.testPreview(0);
  assert.equal(preview?.retryCount,3);
  const full=model.testRound({index:0,upcoming:true,seed:'full'});
  assert.equal(full.strict,true);
  const retry=model.testRound({index:0,upcoming:true,retryMissed:true,seed:'retry'});
  assert.equal(retry.modeId,'test-retry');
  assert.equal(retry.strict,false);
  assert.equal(retry.questions.length,3);
  assert.ok(retry.questions.every(x=>['place-value','number-words'].includes(x.skill)));
  assert.deepEqual(new Set(retry.questions.map(x=>x.id)),new Set(['weak-math-1','weak-math-2','recovered-math']));
  assert.ok(retry.catalog.questions.every(x=>x.subject==='Math'));
  assert.equal(retry.eligibleIds.length,3);
  assert.match(retry.sourceKey,/\|retry$/);
  const empty=createStudyMaterials({
    now:()=> '2026-11-04T16:00:00Z',storage,pack:{sourceHash:'verified-math-v2',subjects:[]},
    events:[{date:'2026-11-04',label:'Math (Ch. 2)'}],
    catalog:{sourceKey:'verified-v2',questions},engine:{loadLearning:()=>({}),nextSessionSeed:()=> 'fixed-seed'},
  });
  assert.equal(empty.testPreview(0)?.retryCount,0);
  assert.deepEqual(empty.testRound({index:0,upcoming:true,retryMissed:true}).questions,[]);
});
