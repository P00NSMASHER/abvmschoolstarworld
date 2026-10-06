import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createStudyMaterials, loadStudyMaterials} from '../pages/study-materials.mjs';
import {printableStudyGuideHtml, resolveVocabularyMeaning} from '../pages/study-games-materials-view.mjs';
import {createStudyResourceLoader} from '../pages/study-resources.mjs';
import {practiceIdentity} from '../pages/study-experience.mjs';

const monday = '2026-10-05T16:00:00Z';
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {values, failWrites:false,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key,value) { if (this.failWrites) throw new Error('Storage full'); values.set(key,String(value)); },
    removeItem(key) { values.delete(key); },
  };
}
function question(id, subject = 'Math', extra = {}) {
  return {id, subject, skill:'addition-within-100', prompt:'Question ' + id + '?',
    answer:'Correct', choices:['First','Second','Correct'], tier:'material',
    difficulty:2, questionType:'direct', explanation:'Checked explanation.', hint:'A useful clue.',
    sourceFact:'Reviewed source fact', provenance:'reviewed-test-fixture', ...extra};
}
const pool = (prefix,count,subject = 'Math',extra = {}) => Array.from({length:count},(_,i) => question(prefix+i,subject,extra));
const catalog = (questions,sourceKey = 'canonical-v1') => ({sourceKey,questions});
const lesson = (id,questions,studiedOn = null) => ({id,title:id,subject:questions[0]?.subject || 'Math',studiedOn,dateStatus:studiedOn ? 'Dated schoolwork' : 'Undated schoolwork',sources:[id+'.jpg'],notes:['Reviewed note.'],questions});
const archiveRow = (row,firstSeenAt,provenance) => ({...row,firstSeenAt,lastSeenAt:firstSeenAt,provenance});
function loadEngine(storage = memory(), review) {
  const window = {ABVMStudyReview:review ? {validReview:() => false,...review} : undefined};
  class FixedDate extends Date { static now() { return Date.parse(monday); } }
  const context = vm.createContext({window, console, Intl, Date:FixedDate, localStorage:storage});
  vm.runInContext(readFileSync(new URL('../pages/study-games.js',import.meta.url),'utf8'),context);
  return window.ABVMStudyGames;
}
const opts = extra => ({now:() => monday,storage:memory(),...extra});
const ids = rows => Array.from(rows,q => q.id);
const freeze = value => {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
};

test('current vocabulary uses dictionary definitions instead of teacher-source placeholders',() => {
  const engine=loadEngine();
  const placeholder='Current Reading Work vocabulary word; the teacher page does not provide a definition.';
  assert.equal(engine.vocabularyDefinition('action'),'something a person or thing does');
  assert.equal(engine.vocabularyDefinition('depend'),'to need or rely on someone or something');
  assert.equal(engine.vocabularyDefinition('nervously'),'in a worried or uneasy way');
  assert.equal(engine.vocabularyDefinition('peered'),'looked closely or carefully');
  assert.equal(engine.vocabularyDefinition('perfectly'),'in exactly the right way or without mistakes');
  assert.equal(engine.vocabularyDefinition('rescue'),'to save someone or something from danger');
  assert.equal(engine.vocabularyDefinition('secret'),'something kept hidden or not told to everyone');
  assert.equal(resolveVocabularyMeaning({term:'depend',meaning:placeholder},engine.vocabularyDefinition),'to need or rely on someone or something');
  assert.equal(resolveVocabularyMeaning({term:'custom',meaning:'A teacher-provided meaning.'},engine.vocabularyDefinition),'A teacher-provided meaning.');
  assert.equal(resolveVocabularyMeaning({term:'unknown',meaning:placeholder},engine.vocabularyDefinition),'');
});


test('printable study guides stay test-specific, bounded, and honest about missing coverage',() => {
  const events = [
    {date:'2026-10-05',label:'Grammar (subject & predicate)'},
    {date:'2026-10-05',label:'Spelling (short i / long i) / Handwriting'},
  ];
  const grammar = pool('grammar-',6,'Reading / ELA',{
    skill:'subject-predicate',
    sourceFact:'The subject tells who or what the sentence is about.',
    explanation:'The predicate tells what the subject does or is.',
  });
  const spelling = pool('short-i-',6,'Spelling / Handwriting',{
    skill:'long-short-i',
    sourceFact:'Short i and long i have different vowel sounds.',
    explanation:'Use the word pattern to decide which i sound you hear.',
  });
  const pack = {
    subjects:[
      {subject:'Reading / ELA',topics:['Story: unrelated reading selection','Grammar: subject & predicate'],studyNotes:['The subject tells who or what the sentence is about; the predicate tells what it does or is.','Dialogue is what characters say.']},
      {subject:'Spelling / Handwriting',topics:['Friday test focus: short a / long a'],studyNotes:['Compare short a words like cat with a_e long-a words like game.']},
    ],
    vocabulary:[{subject:'Reading / ELA',term:'action',meaning:'something a person or thing does'}],
  };
  const model = createStudyMaterials(opts({events,pack,catalog:catalog([...grammar,...spelling])}));
  const grammarGuide = model.testGuide(0);
  assert.equal(grammarGuide.subject,'Reading / ELA');
  assert(grammarGuide.facts.some(row => /subject/i.test(row)));
  assert(!grammarGuide.facts.some(row => /dialogue/i.test(row)));
  assert.equal(grammarGuide.vocabulary.length,0,'grammar guide does not pad the sheet with unrelated reading vocabulary');
  assert(grammarGuide.practice.length <= 4);
  assert(grammarGuide.facts.length <= 6);

  const spellingGuide = model.testGuide(1);
  assert.equal(spellingGuide.subject,'Spelling / Handwriting');
  assert(spellingGuide.practice.every(row => row.skill === 'long-short-i'));
  assert(!spellingGuide.facts.some(row => /short a|long a/i.test(row)),'an old vowel pattern must not leak into the current test guide');
  assert.equal(model.testGuide(99),null);
});

test('printable guide list includes every upcoming test, not only the nearest test date',() => {
  const events = [
    {date:'2026-10-05',label:'Math'},
    {date:'2026-10-07',label:'Reading'},
    {date:'2026-10-09',label:'Grammar (subject & predicate)'},
  ];
  const rows = [
    ...pool('math-guide-',5,'Math'),
    ...pool('reading-guide-',5,'Reading / ELA',{skill:'text-evidence'}),
    ...pool('grammar-guide-',5,'Reading / ELA',{skill:'subject-predicate'}),
  ];
  const model = createStudyMaterials(opts({events,catalog:catalog(rows)}));
  assert.deepEqual(model.tests().tests.map(row=>row.label),['Math'],'practice still prioritizes the nearest test date');
  assert.deepEqual(model.printableTests().tests.map(row=>row.label),[
    'Math','Reading','Grammar (subject & predicate)',
  ]);
  assert.equal(model.testGuide(0).label,'Math');
  assert.equal(model.testGuide(1).label,'Reading');
  assert.equal(model.testGuide(2).label,'Grammar (subject & predicate)');
});

test('printable study guide document is Letter-sized and resolves vocabulary definitions without source placeholders',() => {
  const placeholder='Current Reading Work vocabulary word; the teacher page does not provide a definition.';
  const html = printableStudyGuideHtml({
    label:'Reading',date:'2026-10-07',subject:'Reading / ELA',
    facts:['Use story details to support an answer.'],
    vocabulary:[{term:'depend',meaning:placeholder}],
    practice:[{prompt:'What detail supports the answer?',answer:'The detail from the story.'}],
    warnings:[],sourceLabel:'Reviewed ABVM material',
  },term => term === 'depend' ? 'to need or rely on someone or something' : '');
  assert.match(html,/@page\{size:Letter portrait/);
  assert.match(html,/ONE-PAGE STUDY GUIDE/);
  assert.match(html,/Quick check/);
  assert.match(html,/to need or rely on someone or something/);
  assert.doesNotMatch(html,/teacher page does not provide a definition/);
  assert.match(html,/Automatically generated for this test/);
});

test('weekly and saved banks retain source dates, and never classify undated/future material as current',() => {
  const current = question('teacher','Reading / ELA');
  const lessons = [lesson('today',[question('dated')],'2026-10-05'),lesson('undated',[question('undated')]),
    lesson('old',[question('old')],'2026-10-04'),lesson('future',[question('future')],'2026-10-06')];
  const rows = [
    archiveRow(question('week-archive'),'2026-10-05T05:00:00Z',[{capturedAt:'2026-10-05T05:00:00Z'}]),
    archiveRow(question('sunday-ny'),'2026-10-05T03:00:00Z',[{capturedAt:'2026-10-05T03:00:00Z'}]),
    archiveRow(question('future-archive'),'2026-10-06T05:00:00Z',[{capturedAt:'2026-10-05T05:00:00Z'}]),
    archiveRow(question('future-capture'),'2026-10-04',[{capturedAt:'2026-10-06'}]),
    archiveRow(question('undated-capture'),'2026-10-04',[{}]),
  ];
  const input = freeze({catalog:catalog([current]),schoolwork:{lessons},archive:{questions:rows,notes:[],vocabulary:[]}});
  const before = JSON.stringify(input), model = createStudyMaterials(opts(input));
  assert.deepEqual(ids(model.banks().weekly).sort(),['dated','teacher','week-archive']);
  assert.deepEqual(ids(model.banks().saved).sort(),['dated','future-capture','old','sunday-ny','teacher','undated','undated-capture','week-archive']);
  assert.deepEqual(model.notes('weekly').lessons.map(l => l.id),['today']);
  assert(model.notes('saved').lessons.some(l => l.id === 'undated' && l.studiedOn === null));
  assert.equal(model.banks().weekly.find(q => q.id === 'week-archive'),rows[0]);
  assert.equal(JSON.stringify(input),before);
});

test('This week preserves current, then reviewed, then original STAR subject fallback',() => {
  const current = pool('current-',10), review = pool('review-',10,'Math',{tier:'recent-review'}), star = pool('star-',10,'Math',{tier:'star-fallback'});
  for (const [rows,prefix,fallback] of [[current.concat(review,star),'current-',false],[review.concat(star),'review-',false],[star,'star-',true]]) {
    const model = createStudyMaterials(opts({catalog:catalog(rows),engine:loadEngine()}));
    const scope = model.forMode('math'), round = model.round('math',{seed:12});
    assert.equal(round.questions.length,8);
    assert(round.questions.every(q => q.id.startsWith(prefix)));
    assert.equal(scope.fallback.includes('Math'),fallback);
    assert.equal(scope.count,10);
  }
});

test('shared material caching refreshes dated banks and scoped source identity at New York midnight',() => {
  let now = '2026-10-06T03:59:00Z';
  const schoolwork = {lessons:[lesson('monday',[question('monday')],'2026-10-05'),lesson('tuesday',[question('tuesday')],'2026-10-06')]};
  const model = createStudyMaterials({schoolwork,now:() => now,storage:memory()});
  const first = model.forMode('math',{source:'saved'});
  assert.deepEqual(first.eligibleIds,['monday']);
  assert.equal(first.catalog.questions,model.forMode('words',{source:'saved'}).catalog.questions);
  now = '2026-10-06T04:00:00Z';
  const next = model.forMode('math',{source:'saved'});
  assert.deepEqual(next.eligibleIds,['monday','tuesday']);
  assert.notEqual(next.sourceKey,first.sourceKey);
  assert.deepEqual(ids(first.catalog.questions),['monday'],'an already started round retains its captured bank');
  assert.deepEqual(model.notes('weekly').lessons.map(l => l.id),['monday','tuesday']);
});

test('Quick Mix keeps a missing Math subject playable without replacing current reading work',() => {
  const rows = [...pool('reading-',12,'Reading / ELA'),...pool('fallback-',12,'Math',{tier:'star-fallback'})];
  const model = createStudyMaterials(opts({catalog:catalog(rows),engine:loadEngine()}));
  const round = model.round('quick',{seed:4});
  assert.equal(round.questions.length,8);
  assert(round.questions.some(q => q.subject === 'Math' && q.tier === 'star-fallback'));
  assert(round.questions.some(q => q.subject === 'Reading / ELA' && q.tier === 'material'));
  assert.equal(model.forMode('faith').count,0);
  assert.equal(model.round('faith',{seed:4}).questions.length,0);
});

test('dated current schoolwork is selectable by existing engine without relabeling the source object',() => {
  const row = question('archived-math'); delete row.tier;
  const archive = {questions:[archiveRow(row,'2026-10-05',[{capturedAt:'2026-10-05'}])],notes:[],vocabulary:[]};
  const model = createStudyMaterials(opts({catalog:catalog(pool('fallback-',8,'Math',{tier:'star-fallback'})),archive,engine:loadEngine()}));
  assert.deepEqual(ids(model.round('math',{seed:0}).questions),['archived-math']);
  assert.equal(archive.questions[0].tier,undefined);
  assert.deepEqual(model.round('math',{seed:0}).questions[0].provenance,archive.questions[0].provenance);
});

test('explicit Saved and STAR source choices control all eligible questions and preserve four-choice answers',() => {
  const saved = question('saved-four-choice','Math',{answer:'Fourth',choices:['First','Second','Third','Fourth']});
  const model = createStudyMaterials(opts({catalog:catalog(pool('reading-',8,'Reading / ELA')),schoolwork:{lessons:[lesson('undated',[saved])]}}));
  const savedRound = model.round('math',{source:'saved',seed:3});
  assert.deepEqual(ids(savedRound.questions),[saved.id]);
  assert.equal(savedRound.questions[0],saved);
  assert.deepEqual(savedRound.questions[0].choices,['First','Second','Third','Fourth']);
  const starRound = model.round('math',{source:'star',seed:3});
  assert.equal(starRound.questions.length,8);
  assert(starRound.questions.every(q => q.tier === 'star-fallback' && q.id !== saved.id));
  assert(!model.forMode('math',{source:'saved'}).eligibleIds.some(id => id.startsWith('original-star-')));
  assert.equal(model.forMode('faith',{source:'star'}).count,0);
});

test('four-choice item telemetry records position D, persists it across reload, and keeps three-choice rows intact',() => {
  const storage = memory(), engine = loadEngine(storage);
  const four = question('four-choice','Math',{answer:'Fourth',choices:['First','Second','Third','Fourth']});
  const three = question('three-choice');
  assert(engine.note(four,3));
  assert(engine.note(four,0));
  assert(engine.note(three,2));
  assert.equal(engine.note(three,3),null);
  assert.equal(engine.note(four,4),null);
  assert.equal(engine.note(four,-1),null);
  assert.equal(engine.note(four,1.5),null);
  const reloaded = loadEngine(storage), data = reloaded.loadItemQuality();
  assert.deepEqual(Array.from(data.items[reloaded.itemQualityKey(four)].ChoicePositions),[1,0,0,1]);
  assert.deepEqual(Array.from(data.items[reloaded.itemQualityKey(three)].ChoicePositions),[0,0,1]);
  reloaded.recordLearning(four,true,{attemptCount:1,incorrectCount:0,hintCount:0});
  const resolved = reloaded.loadItemQuality().items[reloaded.itemQualityKey(four)];
  assert.equal(resolved.FirstTryCorrect,1);
  assert.deepEqual(Array.from(resolved.ChoicePositions),[1,0,0,1]);
});

test('four-choice telemetry normalization keeps bounded finite counts without widening the global catalog validator',() => {
  const storage = memory({'abvm-study-item-quality:v1':JSON.stringify({schemaVersion:2,items:{qfixture:{ChoicePositions:[2,-1,'3',5,999]}}})});
  const engine = loadEngine(storage);
  assert.deepEqual(Array.from(engine.loadItemQuality().items.qfixture.ChoicePositions),[2,0,3,5]);
  const pack = JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url),'utf8')).pack;
  const canonical = engine.buildCatalog(pack), original = canonical.questions[0];
  assert.equal(engine.validateCatalog(canonical).length,0);
  const widened = {...canonical,questions:[{...original,choices:[...original.choices,'Fourth distinct choice']},...canonical.questions.slice(1)]};
  assert(engine.validateCatalog(widened).some(issue => issue.id === original.id && /choice/.test(issue.issue)));
});

test('all four game modes select their intended subjects from the selected bank',() => {
  const rows = [...pool('math-',4),...pool('reading-',4,'Reading / ELA'),...pool('spelling-',4,'Spelling / Handwriting'),...pool('religion-',4,'Religion')];
  const model = createStudyMaterials(opts({catalog:catalog(rows)}));
  for (const [mode,subjects] of [['quick',['Math','Reading / ELA','Spelling / Handwriting','Religion']],['math',['Math']],['words',['Reading / ELA','Spelling / Handwriting']],['faith',['Religion']]]) {
    const scope = model.forMode(mode,{source:'saved'}), round = model.round(mode,{source:'saved',seed:5});
    assert.equal(scope.count,rows.filter(q => subjects.includes(q.subject)).length);
    assert(round.questions.every(q => subjects.includes(q.subject)));
    assert.equal(scope.catalog.questions.length,16,'full bank remains available for safe queue lookup');
    assert(round.questions.every(q => scope.eligibleIds.includes(q.id)));
  }
});

test('a requested mix balances source turns, deduplicates overlaps and never silently adds an unselected source',() => {
  const current = pool('weekly-',12), extraSaved = pool('saved-',12);
  const model = createStudyMaterials(opts({catalog:catalog(current),schoolwork:{lessons:[lesson('saved',extraSaved)]},engine:loadEngine()}));
  const round = model.round('math',{source:'mix',sources:['weekly','star'],seed:7});
  assert.equal(round.questions.length,8);
  assert.equal(round.questions.filter(q => q.id.startsWith('weekly-')).length,4);
  assert.equal(round.questions.filter(q => q.tier === 'star-fallback').length,4);
  assert(!round.catalog.questions.some(q => q.id.startsWith('saved-')));
  const overlap = model.round('math',{source:'mix',sources:['weekly','saved'],seed:8});
  assert.equal(overlap.questions.length,8);
  assert.equal(new Set(overlap.questions.map(practiceIdentity)).size,8);
  assert(overlap.questions.every(q => q.tier !== 'star-fallback'));
  assert.deepEqual(model.round('math',{source:'mix',sources:[],seed:1}).questions,[]);
  assert.deepEqual(model.round('math',{source:'unknown',seed:1}).questions,[]);
});

test('saved-source selection retains review priority, unseen work and recent-question rotation',() => {
  const rows = [question('seen','Math',{skill:'seen'}),question('due','Math',{skill:'due'}),...pool('fresh-',22,'Math',{skill:'fresh'})];
  const storage = memory(), history = {seen:{Seen:4},due:{Seen:3}};
  const engine = {reviewPriority:(_history,skill) => skill === 'due' ? 100 : 0};
  const model = createStudyMaterials(opts({catalog:catalog(rows),storage,engine}));
  const first = model.round('math',{source:'saved',seed:1,learning:history});
  assert.equal(first.questions[0].skill,'due');
  assert.equal(first.questions[1].skill,'fresh');
  const recent = new Set(first.questions.map(practiceIdentity));
  const second = model.round('math',{source:'saved',seed:2,learning:history});
  assert(second.questions.every(q => !recent.has(practiceIdentity(q))));
  assert.equal(storage.values.has('abvm-study-learning:v2'),false,'selection never records an answer');
});

test('default weekly history keeps canonical queue IDs, while source keys bind actual explicit bank content',() => {
  const canonicalRows = [...pool('math-',4),...pool('religion-',4,'Religion')];
  const storage = memory(), engine = loadEngine(storage);
  const pending = engine.scheduleComeback(catalog(canonicalRows),canonicalRows[4],{sourceKey:'canonical-v1',remaining:0});
  assert(pending);
  const model = createStudyMaterials(opts({catalog:catalog(canonicalRows),storage,engine}));
  const math = model.forMode('math'), daily = model.forMode('daily');
  assert.equal(math.sourceKey,'canonical-v1');
  assert.deepEqual(ids(math.catalog.questions),ids(canonicalRows));
  const due = engine.dueComeback(math.catalog,math.sourceKey);
  assert.equal(due.question.id,pending.question.id);
  assert(!math.eligibleIds.includes(due.question.id));
  assert(daily.eligibleIds.includes(due.question.id));
  assert.equal(engine.dueComeback(math.catalog,math.sourceKey).row.key,pending.row.key,'ineligible mode does not delete pending work');
  assert.equal(model.forMode('math',{source:'saved'}).sourceKey,model.forMode('faith',{source:'saved'}).sourceKey);
  assert.notEqual(model.forMode('math',{source:'saved'}).sourceKey,math.sourceKey);
  const changed = createStudyMaterials(opts({catalog:catalog(canonicalRows.map(q => q.id === 'math-0' ? {...q,choices:['Correct','First','Second']} : q))}));
  assert.notEqual(changed.forMode('math',{source:'saved'}).sourceKey,model.forMode('math',{source:'saved'}).sourceKey);
  const reordered = createStudyMaterials(opts({catalog:catalog([...canonicalRows].reverse())}));
  assert.equal(reordered.forMode('math',{source:'saved'}).sourceKey,model.forMode('math',{source:'saved'}).sourceKey);
});

test('full scoped catalog retains equivalent IDs while an eight-question selection never repeats the question',() => {
  const first = question('first'), alias = {...first,id:'alias'}, other = pool('other-',10);
  const model = createStudyMaterials(opts({catalog:catalog([first,alias,...other])}));
  const round = model.round('math',{source:'saved',seed:1});
  assert(round.catalog.questions.some(q => q.id === 'first'));
  assert(round.catalog.questions.some(q => q.id === 'alias'));
  assert.equal(round.questions.length,8);
  assert.equal(new Set(round.questions.map(practiceIdentity)).size,8);
  const sibling = loadEngine().supportQuestion(round.catalog,round.questions[0]);
  assert(sibling && round.catalog.questions.some(q => q.id === sibling.id));
});

test('an earlier unrelated due comeback cannot starve later eligible work or lose its own queue entry',() => {
  const storage = memory(), engine = loadEngine(storage);
  const faith = pool('faith-',3,'Religion',{skill:'religion-trinity'}), math = pool('math-',3);
  const full = catalog([...faith,...math]);
  const first = engine.scheduleComeback(full,faith[0],{sourceKey:full.sourceKey,remaining:0});
  const later = engine.scheduleComeback(full,math[0],{sourceKey:full.sourceKey,remaining:0});
  assert.equal(engine.dueComeback(full,full.sourceKey).row.key,first.row.key);
  assert.equal(engine.dueComeback(full,full.sourceKey,{eligibleIds:ids(math)}).row.key,later.row.key);
  assert.equal(engine.dueComeback(full,full.sourceKey,{eligibleIds:[]}),null);
  assert.equal(engine.dueComeback(full,full.sourceKey).row.key,first.row.key);
  assert.equal(JSON.parse(storage.getItem('abvm-study-comebacks:v1')).length,2);
  const old = JSON.parse(storage.getItem('abvm-study-comebacks:v1'));
  storage.setItem('abvm-study-comebacks:v1',JSON.stringify([{sourceKey:full.sourceKey,questionId:'obsolete',skill:'gone',remaining:0,key:'obsolete'},...old]));
  assert.equal(engine.dueComeback(full,full.sourceKey,{eligibleIds:ids(math)}).row.key,later.row.key,'obsolete out-of-scope ID cannot block the selected mode');
  assert.equal(engine.dueComeback(full,full.sourceKey),null,'legacy lookup prunes one missing question as before');
  assert.equal(JSON.parse(storage.getItem('abvm-study-comebacks:v1')).length,2);
  assert.equal(engine.dueComeback(full,full.sourceKey).row.key,first.row.key);
});

test('Daily Practice uses existing due-skill selection and exposes its complete eligible history scope',() => {
  const rows = [...pool('current-',8,'Reading / ELA',{skill:'theme'}),...pool('review-',4,'Reading / ELA',{tier:'recent-review',skill:'sequence'})];
  const engine = loadEngine(memory(),{dueSkills:() => [{id:'sequence'}]});
  const model = createStudyMaterials(opts({catalog:catalog(rows),engine}));
  const round = model.round('daily',{seed:'daily'});
  assert.equal(round.questions[0].skill,'sequence');
  assert.equal(round.modeId,'daily');
  assert.equal(round.sessionSeed,'daily');
  assert.equal(round.questions.length,8);
  assert(round.eligibleIds.includes('review-0'));
});

test('test practice balances complete equal quotas and freezes only mapped test banks',() => {
  const events = [{date:'2026-10-05',label:'Math'},{date:'2026-10-05',label:'Religion Chapter 2'}];
  const model = createStudyMaterials(opts({events,catalog:catalog([...pool('math-',8),...pool('reading-',8,'Reading / ELA')]),schoolwork:{lessons:[lesson('chapter-2',pool('religion-',6,'Religion',{skill:'religion-chapter-2'}))]}}));
  const round = model.testRound({seed:5});
  assert.equal(round.strict,true);
  assert.equal(round.questions.length,8);
  assert.equal(round.questions.filter(q => q.subject === 'Math').length,4);
  assert.equal(round.questions.filter(q => q.subject === 'Religion').length,4);
  assert(round.catalog.questions.every(q => q.subject !== 'Reading / ELA'));
  assert(round.questions.every(q => round.eligibleIds.includes(q.id)));
  assert.deepEqual(model.tests().fallback,[]);
  assert.notEqual(round.sourceKey,model.forMode('quick').sourceKey);
});

test('test fallback matches the announced vowel and missing banks never become a misleading combined round',() => {
  const events = [{date:'2026-10-05',label:'Spelling (short i / long i) / Handwriting'},{date:'2026-10-05',label:'Science'}];
  const model = createStudyMaterials(opts({events,catalog:catalog(pool('short-a-',8,'Spelling / Handwriting',{skill:'long-short-a',sourceFact:'short a / long a'}))}));
  const state = model.tests();
  assert.equal(state.date,'2026-10-05');
  assert.equal(state.supported.length,1);
  assert.equal(state.supported[0].fallback,true);
  assert.equal(state.missing[0].label,'Science');
  assert.deepEqual(model.testRound({seed:1}).questions,[]);
  const supported = model.testRound({index:state.supported[0].index,seed:1});
  assert.equal(supported.questions.length,8);
  assert(supported.questions.every(q => q.skill === 'long-short-i'));
  assert.equal(supported.fallback.length,1);
  assert.deepEqual(model.testRound({index:1,seed:1}).questions,[]);
  assert.deepEqual(model.testRound({index:-1,seed:1}).questions,[]);
});

test('test calendar advances in New York, respects explicit endings and never guesses a missing date',() => {
  let now = '2026-10-06T03:00:00Z';
  const events = [{date:'2026-10-05',label:'Math',endsAt:'2026-10-06T03:30:00Z'},
    {date:'2026-10-06',label:'Reading'}, {label:'Grammar (subject & predicate)'}];
  const model = createStudyMaterials({now:() => now,events,storage:memory()});
  assert.equal(model.tests().date,'2026-10-05');
  now = '2026-10-06T03:30:00Z';
  assert.equal(model.tests().date,'2026-10-06');
  now = '2026-10-07T04:01:00Z';
  assert.equal(model.tests().date,null);
  assert.deepEqual(model.testRound({seed:1}).questions,[]);
  assert.equal(model.completeTests().ok,false);
});

test('completion and Undo preserve exact existing keys; restoration survives reload and handles duplicate events once',() => {
  const initial = ['2026-10-01|Older test','unrelated-existing-key'];
  const storage = memory({'abvm-completed-tests':JSON.stringify(initial)});
  const events = [{date:'2026-10-05',label:'Math'},{date:'2026-10-05',label:'Reading'},{date:'2026-10-05',label:'Math'},{date:'2026-10-07',label:'Grammar'}];
  const make = () => createStudyMaterials(opts({storage,events})), model = make();
  assert.equal(model.completeTests().ok,true);
  assert.equal(model.tests().date,'2026-10-07');
  assert.equal(model.tests().completed.length,2);
  assert.equal(model.tests().canUndo,true);
  assert.equal(model.undoTests().ok,true);
  assert.deepEqual(JSON.parse(storage.getItem('abvm-completed-tests')),initial);
  assert.equal(model.tests().date,'2026-10-05');
  assert.equal(model.completeTests().ok,true);
  const reloaded = make();
  assert.equal(reloaded.tests().canUndo,false);
  assert.equal(reloaded.restoreTest('2026-10-05|Reading').ok,true);
  assert.deepEqual(reloaded.tests().tests.map(t => t.label),['Reading']);
  assert(reloaded.tests().completed.some(t => t.label === 'Math'));
  assert.equal(reloaded.restoreTest('invented').ok,false);
});

test('failed writes do not pretend tests were completed/restored, and a failed Undo remains retryable',() => {
  const storage = memory(), events = [{date:'2026-10-05',label:'Math'}];
  const model = createStudyMaterials(opts({storage,events}));
  storage.failWrites = true;
  assert.equal(model.completeTests().ok,false);
  assert.equal(model.tests().tests.length,1);
  assert.equal(model.tests().canUndo,false);
  storage.failWrites = false;
  assert.equal(model.completeTests().ok,true);
  storage.failWrites = true;
  assert.equal(model.undoTests().ok,false);
  assert.equal(model.tests().canUndo,true);
  assert.equal(model.tests().tests.length,0);
  assert.equal(model.restoreTest('2026-10-05|Math').ok,false);
  assert.equal(model.tests().completed.length,1);
  storage.failWrites = false;
  assert.equal(model.undoTests().ok,true);
  assert.equal(model.tests().tests.length,1);
});

test('corrupt completion state and unavailable optional storage do not break practice or create false completion',() => {
  const events = [{date:'2026-10-05',label:'Math'}];
  for (const raw of ['not json','{}','[null,6]']) {
    const model = createStudyMaterials(opts({events,storage:memory({'abvm-completed-tests':raw})}));
    assert.equal(model.tests().tests.length,1);
  }
  const model = createStudyMaterials(opts({events,storage:{getItem() { throw new Error('Blocked'); },setItem() { throw new Error('Blocked'); }}}));
  assert.equal(model.completeTests().ok,false);
  assert.equal(model.tests().tests.length,1);
  assert.equal(model.round('math',{source:'star'}).questions.length,8);
});

test('notes retain exact valid text and provenance, remove blank optional rows and respect selected sources',() => {
  const note = archiveRow({subject:'Reading / ELA',text:'Saved teacher note.',kind:'topic'},'2026-10-04',[{sourceRef:'reviewed-hash',capturedAt:'2026-10-04'}]);
  const word = archiveRow({subject:'Reading / ELA',term:'aside',meaning:'No source definition posted.'},'2026-10-04',[{sourceRef:'reviewed-hash',capturedAt:'2026-10-04'}]);
  const pack = {sourceHash:'teacher-source',sourceCapturedAt:'2026-10-05T05:00:00Z',subjects:[{subject:'Reading / ELA',topics:['Exact topic.','',null],studyNotes:['  Exact source spaces.  ',42,'   ']}],vocabulary:[{term:'word',meaning:'No definition supplied.'},{term:''},null]};
  const model = createStudyMaterials(opts({pack,archive:{questions:[],notes:[note],vocabulary:[word]}}));
  const weekly = model.notes('weekly'), saved = model.notes('saved');
  assert.deepEqual(weekly.notes.map(n => n.text),['Exact topic.','  Exact source spaces.  ']);
  assert.equal(weekly.notes[0].sourceHash,'teacher-source');
  assert.equal(saved.notes.at(-1),note);
  assert.equal(saved.vocabulary.at(-1),word);
  assert.equal(weekly.vocabulary.length,1);
  assert.deepEqual(model.notes('star'),{lessons:[],notes:[],vocabulary:[],links:[],warnings:[]});
  assert.deepEqual(model.notes('mix',{sources:['star']}),{lessons:[],notes:[],vocabulary:[],links:[],warnings:[]});
  assert.deepEqual(model.notes('mix',{sources:['saved','weekly']}),saved);
});

test('publisher references load only on demand, coalesce, retry and never gate material availability',async () => {
  let calls = 0, available = false;
  const pack = {subjects:[{subject:'Religion',topics:['Chapter 3: Jesus Lives in His Church','Chapter 2: Earlier chapter']}]};
  const religion = {publisher:'Loyola Press',curriculum:'Christ Our Life',chapters:[{chapter:3,url:'https://isr.christourlife.com/col_g2_s3',status:'verified',available:true,chapterMatched:true}]};
  const model = createStudyMaterials(opts({pack,resourceLoader:async name => {
    assert.equal(name,'religion-sources.json'); calls++;
    if (!available) throw new Error('Offline');
    return religion;
  }}));
  assert.equal(calls,0);
  assert.deepEqual(model.notes('weekly').links,[]);
  const failed = await Promise.all([model.loadReferences(),model.loadReferences()]);
  assert.equal(calls,1);
  assert(failed.every(result => result.ok === false));
  assert.equal(model.status.ready,true);
  available = true;
  assert.equal((await model.loadReferences()).ok,true);
  assert.equal(calls,2);
  const links = model.notes('saved').links;
  assert.equal(links.length,1);
  assert.equal(links[0].chapter,3);
  assert.equal(links[0].url,religion.chapters[0].url);
  assert.equal(links[0].publisher,'Loyola Press');
  assert.deepEqual(model.notes('star').links,[]);
  await model.loadReferences();
  assert.equal(calls,2);
});

test('publisher links never substitute a different, unavailable, unverified or unsafe chapter reference',() => {
  const pack = {subjects:[{subject:'Religion',topics:['Chapter 3: Current chapter']}]};
  const base = {chapter:3,url:'https://isr.christourlife.com/col_g2_s3',status:'verified',available:true};
  for (const override of [{chapter:2},{available:false},{status:'pending'},{chapterMatched:false},{stale:true},{url:'javascript:alert(1)'},{url:'https://example.com/col_g2_s3'},{url:'https://isr.christourlife.com/col_g2_s2'}]) {
    const model = createStudyMaterials(opts({pack,religion:{chapters:[{...base,...override}]}}));
    assert.deepEqual(model.notes('weekly').links,[],JSON.stringify(override));
  }
  const noChapter = createStudyMaterials(opts({pack:{subjects:[{subject:'Religion',topics:['Review religion']}]},religion:{chapters:[base]}}));
  assert.deepEqual(noChapter.notes('weekly').links,[]);
});

test('spelling coverage warning preserves the actual upcoming scope and stays with relevant optional notes',() => {
  const events = [{date:'2026-10-05',label:'Reading'},{date:'2026-10-09',label:'Spelling (short i / long i) / Handwriting'}];
  const pack = {subjects:[{subject:'Spelling / Handwriting',topics:['Friday, Oct. 2 test focus: short a / long a']}]};
  const model = createStudyMaterials(opts({events,pack}));
  const warning = model.notes('weekly').warnings[0];
  assert.equal(warning.subject,'Spelling / Handwriting');
  assert.match(warning.text,/short i \/ long i/);
  assert.match(warning.text,/2026-10-09/);
  assert.match(warning.text,/notes alone do not establish test coverage/);
  assert.deepEqual(model.notes('star').warnings,[]);
  const matched = createStudyMaterials(opts({events,pack:{subjects:[{subject:'Spelling / Handwriting',topics:['short i / long i']}]}}));
  assert.deepEqual(matched.notes('weekly').warnings,[]);
  const missing = createStudyMaterials(opts({events:[{label:'Spelling (short i / long i)'}],pack}));
  assert.deepEqual(missing.notes('weekly').warnings,[]);
});

test('resource loading coalesces, retains successful collections, and retries only the failed resource',async () => {
  const calls = new Map(); let archiveReady = false;
  const resourceLoader = createStudyResourceLoader(async url => {
    calls.set(url,(calls.get(url) || 0) + 1);
    if (url.endsWith('study-archive.json') && !archiveReady) return {ok:false};
    return {ok:true,json:async () => url.endsWith('schoolwork.json') ? {lessons:[lesson('saved',[question('saved')])]} : {questions:[],notes:[],vocabulary:[]}};
  });
  const options = opts({resourceLoader,catalog:catalog(pool('current-',8,'Reading / ELA')),engine:loadEngine()});
  const [first,second] = await Promise.all([loadStudyMaterials(options),loadStudyMaterials(options)]);
  assert.deepEqual(first.status.loaded,{schoolwork:true,archive:false});
  assert.equal(first.status.partial,true);
  assert.equal(second.status.errors[0].resource,'study-archive.json');
  assert.equal(first.round('words',{seed:1}).questions.length,8);
  assert(first.banks().saved.some(q => q.id === 'saved'));
  assert.equal(calls.get('./data/schoolwork.json'),1);
  assert.equal(calls.get('./data/study-archive.json'),1);
  archiveReady = true;
  const recovered = await loadStudyMaterials(options);
  assert.equal(recovered.status.ready,true);
  assert.equal(recovered.status.partial,false);
  assert.equal(calls.get('./data/schoolwork.json'),1);
  assert.equal(calls.get('./data/study-archive.json'),2);
});

test('synchronous resource failure also returns a truthful partial model with playable canonical Games',async () => {
  const model = await loadStudyMaterials(opts({catalog:catalog(pool('math-',8)),engine:loadEngine(),resourceLoader() { throw new Error('Network unavailable'); }}));
  assert.equal(model.status.errors.length,2);
  assert.deepEqual(model.status.loaded,{schoolwork:false,archive:false});
  assert.equal(model.round('math',{seed:1}).questions.length,8);
});
