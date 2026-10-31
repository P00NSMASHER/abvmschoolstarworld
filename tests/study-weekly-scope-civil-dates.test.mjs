import test from 'node:test';
import assert from 'node:assert/strict';
import {explicitlyInWeek,weeklySourceNotes} from '../pages/study-notes-scope.mjs';

const friday='2026-02-27';
const pack={
  sourceHash:'synthetic-fixture',
  subjects:[{subject:'Math',topics:['Addition'],studyNotes:['Add the parts.']}],
  contentPipeline:{skills:[{
    id:'add',subject:'Math',label:'Addition',noteTopics:['Addition'],
    studyNotes:['Add the parts.'],
  }]},
};
const matchingQuestions=()=>[{skill:'add'}];

test('impossible lesson dates cannot masquerade as verified weekly school notes',()=>{
  assert.equal(explicitlyInWeek({studiedOn:'2026-02-29'},friday),false);
  assert.equal(explicitlyInWeek({studiedOn:'2026-02-30'},friday),false);
  assert.equal(explicitlyInWeek({weekOf:'2026-02-23',studiedOn:'2026-02-30'},friday),false);
  assert.equal(explicitlyInWeek({weekOf:'2026-02-23',studiedOn:'2026-02-27'},friday),true);
  assert.equal(explicitlyInWeek({studiedOn:'2026-03-01'},friday),true);
});

test('malformed or normalized-away test dates cannot promote unrelated material into this week',()=>{
  const bogus=[null,{}, {date:'2026-02-29',label:'Invented math test'},
    {date:'2026-02-30',label:'Invented math test'}];
  assert.deepEqual(weeklySourceNotes(pack,bogus,friday,matchingQuestions),[]);
  const real=[...bogus,{date:'2026-02-27',label:'Verified math test'}];
  assert.deepEqual(weeklySourceNotes(pack,real,friday,matchingQuestions).map(row=>row.text),
    ['Addition','Add the parts.']);
});

test('malformed source rows cannot forge weekly topic matches or hide verified lessons',()=>{
  const dirty={...pack,
    subjects:[null, 'invalid', [], {}, ...pack.subjects],
    contentPipeline:{skills:[null, [], {}, {subject:'Math',label:'Phantom topic',studyNotes:['Phantom lesson.']},...pack.contentPipeline.skills]},
  };
  const verified=[{date:'2026-02-27',label:'Verified math test'}];
  const malformedQuestionMatches=()=>[null,false,{}, {skill:null}, {assessedSkillIds:[undefined,0,'']}, {skill:'add'}];
  assert.deepEqual(
    weeklySourceNotes(dirty,verified,friday,malformedQuestionMatches).map(row=>row.text),
    ['Addition','Add the parts.'],
  );
  // An undefined question skill must never select an undefined-ID source skill.
  assert.deepEqual(weeklySourceNotes(dirty,verified,friday,()=>[null,{}, {skill:null}]),[]);
});
