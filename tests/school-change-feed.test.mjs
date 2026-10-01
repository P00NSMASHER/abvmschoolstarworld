import assert from 'node:assert/strict';
import test from 'node:test';
import {buildSchoolChangeFeed,validateSchoolChangeFeed} from '../scripts/school-change-feed.mjs';

const skill=(id,subject,label)=>({id,subject,label});
test('school change feed explains new/removed skills, events, lunch, and unchanged Religion',()=>{
  const previousPack={
    sourceHash:'old',
    contentPipeline:{skills:[
      skill('sentence-types','Reading / ELA','Sentence types'),
      skill('religion-trinity','Religion','The Trinity')
    ]},
    importantDates:[],
    lunchMenu:[{date:'2026-10-01',meal:'Pizza'}]
  };
  const currentPack={
    sourceHash:'new',
    contentPipeline:{skills:[
      skill('subject-predicate','Reading / ELA','Subject and predicate'),
      skill('religion-trinity','Religion','The Trinity')
    ]},
    recentReviewPipeline:{skills:[skill('sentence-types','Reading / ELA','Sentence types')]},
    importantDates:[
      {date:'Friday, Oct. 9',label:'Grammar (subject & predicate)',kind:'test',source:'teacher-tests'},
      {date:'Friday, Oct. 16',label:'Picture Day',kind:'school event',source:'teacher-home'}
    ],
    lunchMenu:[{date:'2026-10-01',meal:'Chicken'}]
  };
  const feed=buildSchoolChangeFeed({previousPack,currentPack,generatedAt:'2026-10-01T14:00:00.000Z',sourceHash:'new'});
  assert.deepEqual(validateSchoolChangeFeed(feed),[]);
  const text=feed.items.map(row=>row.text).join('\n');
  assert.match(text,/New: Reading \/ ELA — Subject and predicate.*Oct\. 9/i);
  assert.match(text,/Moved to recent review: Reading \/ ELA — Sentence types/i);
  assert.match(text,/Added school event: Picture Day/i);
  assert.match(text,/Lunch menu updated/i);
  assert.match(text,/No changes to Religion/i);
});

test('unchanged pack produces calm subject-level no-change messages',()=>{
  const pack={
    sourceHash:'same',
    contentPipeline:{skills:[skill('theme','Reading / ELA','Theme'),skill('religion-trinity','Religion','The Trinity')]},
    importantDates:[],
    lunchMenu:[]
  };
  const feed=buildSchoolChangeFeed({previousPack:pack,currentPack:structuredClone(pack),generatedAt:'2026-10-01T14:00:00.000Z',sourceHash:'same'});
  assert.equal(feed.changed,false);
  assert.ok(feed.items.some(row=>row.text==='No changes to Religion.'));
  assert.deepEqual(validateSchoolChangeFeed(feed),[]);
});

test('removed skills are not mislabeled as recent review when continuity did not retain them',()=>{
  const previousPack={
    sourceHash:'old',
    contentPipeline:{skills:[skill('sentence-types','Reading / ELA','Sentence types')]},
    importantDates:[],
    lunchMenu:[]
  };
  const currentPack={
    sourceHash:'new',
    contentPipeline:{skills:[]},
    recentReviewPipeline:{skills:[]},
    importantDates:[],
    lunchMenu:[]
  };
  const feed=buildSchoolChangeFeed({previousPack,currentPack,generatedAt:'2026-10-01T14:00:00.000Z',sourceHash:'new'});
  assert.deepEqual(validateSchoolChangeFeed(feed),[]);
  const text=feed.items.map(row=>row.text).join('\n');
  assert.match(text,/Removed from current week: Reading \/ ELA — Sentence types/i);
  assert.doesNotMatch(text,/Moved to recent review: Reading \/ ELA — Sentence types/i);
});
