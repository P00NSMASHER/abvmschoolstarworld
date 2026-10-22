import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildGrade2ContentPipeline, validateGrade2ContentPipeline} from '../scripts/grade2-content-pipeline.mjs';

const envelope=JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url),'utf8'));
const checkedAt=envelope.sourceLastCheckedAt;
const reading=envelope.pack.subjects.find(row=>row.subject==='Reading / ELA');
const religion=envelope.pack.subjects.find(row=>row.subject==='Religion');
const teacherSourcePages=[
 {title:'Reading Work',url:'https://sites.google.com/view/abvmgr2/reading-work',checkedAt,contentHash:'reading-work-verification-hash',
  lines:[...reading.topics.map(topic=>topic.replace(/^Vocabulary:/i,'Vocab Words:')),...reading.studyNotes]},
 {title:'Religion',url:'https://sites.google.com/view/abvmgr2/religion',checkedAt,contentHash:'religion-verification-hash',
  lines:[...religion.topics,...religion.studyNotes]},
 {title:'Tests',url:'https://sites.google.com/view/abvmgr2/tests',checkedAt,contentHash:'tests-verification-hash',
  lines:['Tuesday Oct. 27: Math (place value, expanded form)','Thursday Oct. 29: Grammar (common & proper nouns)','Friday Oct. 23: Spelling (long/short u)/Handwriting']},
 {title:'Weekly Spelling List',url:'https://sites.google.com/view/abvmgr2/weekly-spelling-list',checkedAt,contentHash:'spelling-verification-hash',
  lines:['Skill: short and long u']},
];
const generate=(pack,sourcePages=teacherSourcePages)=>buildGrade2ContentPipeline(pack,{
 generatedAt:checkedAt,sourceHash:pack.sourceHash,sourcePages,requirePageExactLineage:true,
});
const skill=(bank,id)=>bank.skills.find(x=>x.id===id);
const items=(bank,id)=>bank.questions.filter(x=>x.skill===id);

// These expectations are the safe learning outcomes of source-backed improvement,
// rather than claims about unseen teacher word meanings or copyrighted story passages.
test('current teacher high-frequency words have contextual, source-limited practice for every word',()=>{
 const pack=structuredClone(envelope.pack),p=generate(pack);
 const words=reading.topics.find(x=>/^Sight words:/i.test(x)).split(':')[1].split(',').map(x=>x.trim().toLowerCase());
 const q=items(p,'high-frequency-word-use');
 assert.equal(q.length,words.length);
 assert.equal(new Set(q.map(x=>x.answer)).size,words.length);
 assert.ok(q.every(x=>words.includes(x.answer)));
 assert.ok(q.every(x=>x.choices.every(y=>words.includes(y.toLowerCase()))));
 assert.ok(q.every(x=>x.sourceMode==='CURATED_CONTEXT'));
 assert.ok(q.every(x=>x.evidenceContract.doesNotClaim.includes('isolated-print-recognition')));
 assert.ok(p.coverage.some(x=>x.topic==='Sight / high-frequency words'&&x.status==='COVERED'));
 assert.equal(p.coverage.some(x=>x.topic==='Sight / high-frequency words'&&x.status==='SOURCE_INSUFFICIENT'),false);
});

test('authors opinion questions exercise original fact/opinion distinctions with three reasoning levels',()=>{
 const p=generate(structuredClone(envelope.pack)),q=items(p,'author-opinion');
 assert.equal(q.length,8);
 assert.deepEqual([...new Set(q.map(x=>x.questionType))].sort(),['direct','reasoning','transfer']);
 assert.ok(q.every(x=>x.sourceMode==='CURATED_CONTEXT'));
 assert.ok(q.every(x=>x.sourceLineage.quality==='page-exact'));
 assert.ok(q.every(x=>x.sourceLineage.sourceTitle==='Reading Work'));
 assert.ok(q.every(x=>x.explanation&&x.hint&&x.choiceDiagnostics));
 assert.ok(q.every(x=>!/(?:Families Work|Can Kids Help at Home)/i.test(x.prompt)));
 assert.equal(p.coverage.some(x=>x.topic==="author's opinion"&&x.status==='GENERATOR_UNSUPPORTED'),false);
 assert.equal(validateGrade2ContentPipeline(p).length,0);
});

test('unsupported author skill withdraws automatically when current teacher source withdraws it',()=>{
 const pack=structuredClone(envelope.pack);
 pack.subjects.find(x=>x.subject==='Reading / ELA').studyNotes=
  pack.subjects.find(x=>x.subject==='Reading / ELA').studyNotes.filter(x=>!/author.s opinion/i.test(x));
 const p=generate(pack);
 assert.equal(skill(p,'author-opinion'),undefined);
 assert.equal(items(p,'author-opinion').length,0);
});

test('each teacher-listed vocabulary term gets original word-use context without claiming teacher definitions',()=>{
 const pack=structuredClone(envelope.pack),p=generate(pack);
 const words=pack.vocabulary.map(x=>x.term);
 const q=items(p,'vocabulary-word-use');
 assert.equal(q.length,words.length);
 assert.deepEqual([...new Set(q.map(x=>x.answer))].sort(),[...words].sort());
 assert.ok(q.every(x=>x.sourceMode==='CURATED_CONTEXT'));
 assert.ok(q.every(x=>x.choices.every(choice=>words.includes(choice.toLowerCase()))));
 assert.ok(q.every(x=>x.sourceLineage.quality==='page-exact'&&x.sourceLineage.sourceTitle==='Reading Work'));
 assert.ok(q.every(x=>!/(?:teacher defines|teacher's definition|verified vocabulary definition)/i.test(x.sourceFact+' '+x.explanation+' '+x.prompt)));
 assert.ok(q.every(x=>x.evidenceContract.doesNotClaim.includes('teacher-provided-definitions')));
 const definitions=items(p,'vocabulary-in-context');
 assert.equal(definitions.length,words.length,'every teacher-listed word has an original, source-limited definition lesson');
 assert.ok(definitions.every(x=>x.sourceMode==='CURATED_CONTEXT'&&x.supportType==='original-grade2-vocabulary-teaching'));
 assert.ok(definitions.every(x=>x.evidenceContract.doesNotClaim.includes('teacher-provided-definitions')));
 assert.ok(definitions.every(x=>x.sourceLineage.quality==='page-exact'&&x.sourceLineage.sourceTitle==='Reading Work'));
 assert.ok(p.coverage.some(x=>x.topic==='Reading / ELA vocabulary definitions'&&x.status==='COVERED'&&x.supplementalTerms.length===words.length));
 assert.equal(p.coverage.some(x=>x.topic==='Reading / ELA vocabulary definitions'&&x.status==='SOURCE_INSUFFICIENT'),false);
 assert.ok(p.coverage.some(x=>x.topic==='Teacher vocabulary in original contexts'&&x.status==='COVERED'));
});

test('vocabulary practice follows live terms; absent or insufficient context stays explicitly uncovered',()=>{
 const pack=structuredClone(envelope.pack);
 pack.vocabulary=[{subject:'Reading / ELA',term:'unlistednewword',meaning:'Current Reading Work vocabulary word; the teacher page does not provide a definition.'}];
 pack.subjects.find(x=>x.subject==='Reading / ELA').topics=pack.subjects.find(x=>x.subject==='Reading / ELA').topics.map(x=>
  x.startsWith('Vocabulary:')?'Vocabulary: unlistednewword':x);
 const p=generate(pack);
 assert.equal(items(p,'vocabulary-word-use').length,0);
 assert.ok(p.coverage.some(x=>x.topic==='Teacher vocabulary in original contexts'&&x.status==='SOURCE_INSUFFICIENT'));
 assert.equal(items(p,'vocabulary-in-context').length,0);
});

test('Grade 2 vine and branches practice is distinguishable from teacher evidence and tied to named source',()=>{
 const p=generate(structuredClone(envelope.pack)),q=items(p,'religion-vine-branches');
 assert.equal(q.length,3);
 assert.deepEqual([...new Set(q.map(x=>x.questionType))].sort(),['direct','reasoning','transfer']);
 assert.ok(q.every(x=>x.sourceMode==='CURATED_CONTEXT'));
 assert.ok(q.every(x=>x.sourceLineage.quality==='page-exact'&&x.sourceLineage.sourceTitle==='Religion'));
 assert.ok(q.every(x=>x.supplementalReference?.url==='https://bible.usccb.org/bible/john/15'));
 assert.ok(q.every(x=>x.supplementalReference?.textbookUrl?.includes('christ-our-life-2024-se-gr2')));
 assert.ok(q.every(x=>x.evidenceContract.doesNotClaim.includes('teacher-exact-lesson-questions')));
 assert.ok(p.coverage.some(x=>x.topic==='Parable of the vine and the branches'&&x.status==='COVERED'));
 assert.equal(p.coverage.some(x=>x.topic==='Parable of the vine and the branches'&&x.status==='SOURCE_INSUFFICIENT'),false);
});

test('vine and branches enrichment disappears when no longer identified in the current Religion source',()=>{
 const pack=structuredClone(envelope.pack);
 pack.subjects.find(x=>x.subject==='Religion').studyNotes=
  pack.subjects.find(x=>x.subject==='Religion').studyNotes.filter(x=>!/vine and (?:the )?branches/i.test(x));
 const p=generate(pack);
 assert.equal(skill(p,'religion-vine-branches'),undefined);
 assert.equal(items(p,'religion-vine-branches').length,0);
});
