import test from 'node:test';
import assert from 'node:assert/strict';
import {explicitlyInWeek,sourceStudyNotes,weeklySourceNotes} from '../pages/study-notes-scope.mjs';
const now='2026-10-16T21:00:00Z';
const pack={sourceCapturedAt:now,weekLabel:'Week of October 12, 2026',subjects:[{subject:'Religion',topics:['Chapter 1: Gifts','Chapter 3: Church'],studyNotes:['Faith helps us believe.','Unscoped old note.']},{subject:'Spelling / Handwriting',topics:['Next week: long / short u'],studyNotes:['Final e changes the sound.']}],contentPipeline:{skills:[{id:'faith',label:'Faith',subject:'Religion',studyNotes:['Faith helps us believe.'],sourceLineage:{matchedEvidence:['Chapter 3: Church * Faith is a gift.']}},{id:'u',subject:'Spelling / Handwriting',label:'Long / short u',studyNotes:['Final e changes the sound.'],sourceLineage:{matchedEvidence:['Next week: long / short u']}}]}};
test('fresh crawls and global week labels do not turn cumulative notes into weekly material',()=>{
 assert.deepEqual(weeklySourceNotes(pack,[],now,()=>[]),[]);
 assert.equal(sourceStudyNotes(pack).length,6);
 assert.deepEqual(sourceStudyNotes(pack).find(row=>row.text==='Faith helps us believe.').topics,['Chapter 3: Church']);
});
test('weekly notes select only same-week tests and exact sourced skill notes',()=>{
 const events=[{date:'2026-10-15',label:'Religion Ch. 3'},{date:'2026-10-23',label:'Spelling long / short u'}];
 const rows=weeklySourceNotes(pack,events,now,test=>[{skill:/Religion/.test(test.label)?'faith':'u'}]);
 assert.deepEqual(rows.map(row=>row.text),['Chapter 3: Church','Faith helps us believe.']);
 assert.deepEqual(rows[1].topics,['Chapter 3: Church']);
 assert.deepEqual(weeklySourceNotes(pack,events,'2026-10-26',()=>[{skill:'faith'}]),[]);
});
test('explicit lesson weeks and study dates work across New York week boundary; capture dates do not',()=>{
 assert.equal(explicitlyInWeek({weekOf:'2026-10-12'},now),true);
 assert.equal(explicitlyInWeek({studiedOn:'2026-10-15'},now),true);
 assert.equal(explicitlyInWeek({capturedAt:now,firstSeenAt:now},now),false);
 assert.equal(explicitlyInWeek({weekOf:'2026-10-19'},'2026-10-19T03:59:00Z'),false);
 assert.equal(explicitlyInWeek({weekOf:'2026-10-19'},'2026-10-19T04:00:00Z'),true);
});

test('compact runtime preserves exact topic and teaching associations without raw source evidence',async()=>{
 const {buildRuntimePack}=await import('../scripts/build-runtime-pack.mjs');
 const full={...pack,sourceSufficient:true,contentPipeline:{...pack.contentPipeline,questions:[]},recentReviewPipeline:{questions:[]}};
 const compact=buildRuntimePack({pack:full}).pack;
 const events=[{date:'2026-10-15',label:'Religion Ch. 3'}],match=()=>[{skill:'faith'}];
 assert.deepEqual(sourceStudyNotes(compact),sourceStudyNotes(full));
 assert.deepEqual(weeklySourceNotes(compact,events,now,match),weeklySourceNotes(full,events,now,match));
 assert.equal(compact.contentPipeline.skills[0].sourceLineage,undefined);
});

test('explicit subject study dates include only that subject and expire at the next week',()=>{
 const dated={...pack,subjects:[{subject:'Math',weekOf:'2026-10-12',topics:['Addition'],studyNotes:['Add the parts.']},...pack.subjects]};
 assert.deepEqual(weeklySourceNotes(dated,[],now,()=>[]).map(row=>row.text),['Addition','Add the parts.']);
 assert.deepEqual(weeklySourceNotes(dated,[],'2026-10-19',()=>[]),[]);
});

test('actual shared Religion skills cannot promote another chapter into this week',async()=>{
 const {readFileSync}=await import('node:fs');
 const {questionsForTest}=await import('../pages/study-hub-core.mjs');
 const actual=JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url))).pack;
 const rows=weeklySourceNotes(actual,[{date:'2026-10-15',label:'Religion Chapter 3 test'}],'2026-10-16',event=>questionsForTest(event,actual.contentPipeline.questions));
 const topics=rows.filter(row=>row.kind==='topic');
 assert.deepEqual(topics.map(row=>row.text),['Chapter 3: Jesus Lives in His Church']);
 assert.ok(rows.some(row=>row.text==='Faith is a gift from God that helps us believe.'));
 assert.ok(!rows.some(row=>row.text.includes('Jesus is our Savior;')),'mixed-chapter skill teaching is ambiguous, so stays cumulative');
 assert.ok(rows.every(row=>!row.topics||row.topics.every(topic=>topic.startsWith('Chapter 3:'))));
 const {buildRuntimePack}=await import('../scripts/build-runtime-pack.mjs');
 const compact=buildRuntimePack({pack:actual}).pack;
 assert.deepEqual(weeklySourceNotes(compact,[{date:'2026-10-15',label:'Religion Chapter 3 test'}],'2026-10-16',event=>questionsForTest(event,compact.contentPipeline.questions)),rows);
});
test('conflicting lesson week and studied date fail closed in both weeks',()=>{
 const conflict={weekOf:'2026-10-12',studiedOn:'2026-10-20'};
 assert.equal(explicitlyInWeek(conflict,'2026-10-16'),false);
 assert.equal(explicitlyInWeek(conflict,'2026-10-20'),false);
 assert.equal(explicitlyInWeek({weekOf:'2026-10-12',studiedOn:'2026-10-15'},now),true);
});
