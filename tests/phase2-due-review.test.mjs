import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createStudyMaterials} from '../pages/study-materials.mjs';
import {practiceIdentity} from '../pages/study-experience.mjs';

const DAY=86400000, NOW=Date.parse('2026-11-08T19:00:00-05:00');
function setup(){
  const local=new Map();
  const storage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)};
  const context={window:{},localStorage:storage};
  for(const name of ['study-review','study-games'])
    vm.runInNewContext(fs.readFileSync(new URL('../pages/'+name+'.js',import.meta.url),'utf8'),context);
  return {review:context.window.ABVMStudyReview,engine:context.window.ABVMStudyGames,local,storage};
}
function question(id,skill,tier='material'){
  return {id,skill,tier,subject:'Math',questionType:'direct',difficulty:2,
    prompt:'Original reviewed question '+id+'?',answer:'Correct '+id,
    choices:['Correct '+id,'Incorrect '+id],variantFingerprint:id,
    explanation:'Reviewed skill example.',hint:'Practice the strategy.'};
}
const current=Array.from({length:16},(_,i)=>question('current-'+i,'math-addition'));
const older=[
  question('prior-a-1','review-a'),question('prior-a-2','review-a'),
  question('prior-b-1','review-b'),question('prior-b-2','review-b'),
  question('prior-future','review-future'),question('prior-new','review-not-yet-practiced'),
];
const schoolwork={lessons:[{id:'prior-reviewed-math',subject:'Math',
  weekOf:'2026-10-26',studiedOn:'2026-10-30',questions:older}]};
function model(engine,storage,events=[]){
  return createStudyMaterials({now:()=>NOW,engine,storage,
    catalog:{sourceKey:'phase2-verified-current',questions:current},
    schoolwork,events});
}
function history(review){
  const completed=review.schedule({}, {correct:true,independent:true,now:NOW-3*DAY});
  const future=review.schedule({}, {correct:true,independent:true,now:NOW});
  return {
    'review-a':{Seen:3,Review:{...completed},IndependentCorrect:2},
    'review-b':{Seen:2,Review:{...completed},IndependentCorrect:1},
    'review-future':{Seen:2,Review:{...future}},
    'review-not-yet-practiced':{},
  };
}
test('two distinct due prior skills return to an ordinary Math round; six slots remain current',()=>{
  const {engine,review,storage,local}=setup();
  const learning=history(review),before=JSON.stringify(learning),m=model(engine,storage);
  assert.equal(engine.reviewDue(learning,'review-a',NOW),true);
  assert.equal(engine.reviewDue(learning,'review-b',NOW),true);
  assert.equal(engine.reviewDue(learning,'review-future',NOW),false);
  assert.equal(engine.reviewDue(learning,'review-not-yet-practiced',NOW),false);
  const round=m.round('math',{seed:'first',learning});
  assert.equal(round.questions.length,8);
  assert.equal(round.questions.slice(0,2).filter(q=>q.id.startsWith('prior-')).length,2);
  assert.equal(round.questions.slice(2).filter(q=>q.id.startsWith('current-')).length,6);
  assert.equal(new Set(round.questions.slice(0,2).map(q=>q.skill)).size,2);
  assert.equal(new Set(round.questions.map(practiceIdentity)).size,8);
  assert.deepEqual(round.questions.filter(q=>q.id.startsWith('prior-')).map(q=>q.skill).sort(),
    ['review-a','review-b']);
  assert.equal(JSON.stringify(learning),before,'selection cannot mutate learner evidence');
  assert.equal(local.has('abvm-study-learning:v2'),false,'no new privacy-sensitive storage lane');
});
test('fresh, future, malformed, or unsupported review state never pulls in old material',()=>{
  const {review}=setup();
  for(const learning of [
    {},{'review-a':{Seen:0}},
    {'review-a':{Review:{version:1,reviewedAt:NOW+5*DAY,dueAt:NOW+6*DAY}}},
    {'review-a':{Seen:1,Review:{version:2,dueAt:NOW-DAY}}},
    {'review-a':{Seen:1,Review:{version:1,reviewedAt:Infinity,dueAt:0}}},
  ]){
    // Each negative case starts a fresh session. Reusing one 16-item current
    // bank over five sessions legitimately exhausts it via existing rotation.
    const {engine,storage}=setup(),m=model(engine,storage);
    const round=m.round('math',{seed:'safe',learning});
    assert.equal(round.questions.length,8);
    assert(round.questions.every(q=>q.id.startsWith('current-')));
  }
});
test('saved review is bounded to two, one per skill; never leaks into strict Test Prep',()=>{
  const {review,engine,storage}=setup(),learning=history(review);
  const m=model(engine,storage,[{date:'2026-11-11',label:'Math addition',kind:'test'}]);
  const strict=m.testRound({index:0,upcoming:true,seed:'exam'});
  assert(strict.questions.every(q=>q.id.startsWith('current-')));
  assert.equal(strict.strict,true);
  const subject=m.round('math',{seed:'return',learning});
  assert.equal(subject.questions.filter(q=>q.id.startsWith('prior-')).length,2);
  const other=m.round('reading',{seed:'other',learning});
  assert(other.questions.every(q=>q.subject==='Reading / ELA'));
});
test('existing SM-2 schedules, identity, local persistence keys and due dates remain unchanged',()=>{
  const {review,engine,storage}=setup(),learning=history(review);
  const before=JSON.stringify(learning);
  assert.equal(review.validReview(learning['review-a'],NOW).version,1);
  assert.equal(engine.reviewDue(learning,'review-a',NOW),review.isDue(learning['review-a'],NOW));
  model(engine,storage).round('math',{seed:'unchanged',learning});
  assert.equal(JSON.stringify(learning),before);
});
