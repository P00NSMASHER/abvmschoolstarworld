import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createStudyMaterials, loadStudyMaterials} from '../pages/study-materials.mjs';
import {createMaterialsView, printableStudyGuideHtml, printableWorksheetHtml, resolveVocabularyMeaning} from '../pages/study-games-materials-view.mjs';
import {createStudyResourceLoader} from '../pages/study-resources.mjs';
import {practiceIdentity} from '../pages/study-experience.mjs';
import {buildGrade2ContentPipeline} from '../scripts/grade2-content-pipeline.mjs';
import {buildRuntimePack} from '../scripts/build-runtime-pack.mjs';
import {notesLibraryData} from '../pages/study-notes-library.mjs';
import {religionChapterScopes} from '../pages/study-hub-core.mjs';

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


test('weekly Math consumes fresh current then reviewed saved questions before repeating',() => {
  const storage=memory(),engine=loadEngine(storage);
  const current=pool('reviewed-current-',9);
  const saved=pool('source-backed-saved-',20,'Math',{tier:undefined});
  const model=createStudyMaterials(opts({
    storage,engine,pack:{sourceHash:'checked-math-week'},
    catalog:catalog(current,'source-key-with-rotating-math'),
    schoolwork:{lessons:[lesson('reviewed-saved-math',saved)]},
  }));
  const rounds=[0,1,2].map(seed=>model.round('math',{seed:String(seed)}).questions);
  assert.deepEqual(rounds.map(rows=>rows.length),[8,8,8]);
  assert.ok(rounds[0].every(q=>q.id.startsWith('reviewed-current-')));
  assert.equal(rounds[1].filter(q=>q.id.startsWith('reviewed-current-')).length,1);
  assert.ok(rounds[1].slice(1).every(q=>q.id.startsWith('source-backed-saved-')));
  const all=rounds.flat();
  assert.equal(new Set(all.map(q=>q.id)).size,24,
    'an available reviewed question should never repeat across three sessions');
  assert.equal(new Set(all.map(practiceIdentity)).size,24);
  for(const row of all.filter(q=>q.id.startsWith('source-backed-saved-'))) {
    assert.equal(row.tier,undefined,'original saved-source labels must not be rewritten');
    assert.equal(row.sourceFact,'Reviewed source fact');
  }
  const rotation=JSON.parse(storage.getItem('abvm-hub-weekly-rotation:v1'));
  assert.equal(rotation.sourceKey,'source-key-with-rotating-math');
  assert.equal(rotation.recent.length,24);
});

test('full current test bank interleaves skills and prints every verified question',() => {
  const rows=[
    ...pool('first-',12,'Reading / ELA',{skill:'text-evidence',sourceFact:'Use details from the story.'}),
    ...pool('chart-',4,'Reading / ELA',{skill:'reading-charts',sourceFact:'Check labels and counts on a chart.'}),
  ];
  const pack={sourceHash:'teacher-pages-test',sourceCheckedAt:monday,subjects:[]};
  const model=createStudyMaterials(opts({pack,events:[{date:'2026-10-05',label:'Reading'}],catalog:catalog(rows)}));
  const guide=model.testGuide(0);
  assert.equal(guide.practice.length,16,'premium printouts cannot drop later current questions');
  assert.deepEqual(guide.practice.slice(0,2).map(q=>q.skill),['text-evidence','reading-charts']);
  assert.deepEqual(guide.coverage.availableSkills,['text-evidence','reading-charts']);
  assert.deepEqual(guide.coverage.missingSkills,[]);
  assert.equal(guide.sourceHash,'teacher-pages-test');
  assert.equal(guide.sourceCheckedAt,monday);
  for (const html of [printableStudyGuideHtml(guide),printableWorksheetHtml(guide)]) {
    assert.match(html,/Question first-11/);
    assert.match(html,/Question chart-3/);
    assert.match(html,/Teacher source checked 2026-10-05/);
  }
});

test('all official undated spelling words reach this-week guide and adult dictation key only',() => {
  const words=['box','side','fox','line','dog','lock','pot','cone','have','home','off','nose','took','poke','rope'];
  const pack={
    sourceHash:'teacher-pages-spelling-checked',sourceCheckedAt:'2026-10-15T11:00:22.453Z',
    weekLabel:'Week of October 12, 2026',
    subjects:[{subject:'Spelling / Handwriting',
      topics:['Friday, Oct. 16 test focus: long o / Short '],
      studyNotes:['Teacher-posted spelling words (page undated): '+words.join(', ')]}],
  };
  const events=[{date:'2026-10-16',label:'Spelling (long o / Short ) / Handwriting',kind:'test'}];
  const options={events,pack,catalog:catalog([]),now:()=> '2026-10-15T14:00:00Z'};
  const guide=createStudyMaterials(opts(options)).testGuide(0);
  assert.deepEqual(guide.spellingWords,words);
  assert.match(guide.sourceLabel,/teacher page undated/);
  const study=printableStudyGuideHtml(guide);
  const worksheet=printableWorksheetHtml(guide);
  for(const word of words)assert.match(study,new RegExp('<strong>'+word+'</strong>'));
  assert.match(worksheet,/Adult Dictation List/);
  const student=worksheet.split('</style></head><body>').at(-1).split('<section class="sheet adult-key">')[0];
  assert.doesNotMatch(student,/<strong>\s*(?:box|cone|rope|home)\s*<\/strong>/i,
    'the student dictation page must contain blank lines, not spelling answers');
  const adult=worksheet.split('<section class="sheet adult-key">')[1];
  for(const word of words)assert.match(adult,new RegExp('<li>'+word+'</li>'));
  assert.match(worksheet,/Teacher source checked 2026-10-15/);
  const previous=createStudyMaterials(opts({...options,pack:{...pack,weekLabel:'Week of October 5, 2026'}})).testGuide(0);
  assert.deepEqual(previous.spellingWords,[],'a teacher page without dated words cannot silently certify a different week');
  const rolledForward=createStudyMaterials(opts({...options,
    now:()=> '2026-10-17T23:00:00Z',
    events:[{date:'2026-10-23',label:'Spelling (long / short u) / Handwriting',kind:'test'}],
    pack:{...pack,weekLabel:'Week of October 19, 2026',teacherPostingWeekLabel:'Week of October 12, 2026'},
  })).testGuide(0);
  assert.deepEqual(rolledForward.spellingWords,[],
    'calendar display rollover cannot recertify an undated list from the teacher posting week');
  const mondayRescan=createStudyMaterials(opts({...options,
    now:()=> '2026-10-19T17:00:00Z',
    events:[{date:'2026-10-23',label:'Spelling (long / short u) / Handwriting',kind:'test'}],
    pack:{...pack,weekLabel:'Week of October 19, 2026',teacherPostingWeekLabel:'Week of October 19, 2026',
      spellingListProvenance:{weekLabel:'Week of October 12, 2026',wordsHash:'unchanged-old-words'}},
  })).testGuide(0);
  assert.deepEqual(mondayRescan.spellingWords,[],
    'a Monday rescan of unchanged undated long-o words must not certify them for the Oct. 23 long/short-u test');
  for (const guide of [rolledForward,mondayRescan]) {
    assert.ok(guide.facts.every(fact=>!/box,\s*side,\s*fox/i.test(fact)),
      'old spelling words must not survive as general guide facts');
    assert.doesNotMatch(printableStudyGuideHtml(guide),/box,\s*side,\s*fox/i,
      'October 23 guide must not contain the earlier undated long-o list');
    assert.doesNotMatch(printableWorksheetHtml(guide),/box,\s*side,\s*fox/i,
      'October 23 worksheet must not contain the earlier undated long-o list');
  }
});

test('live release gate compares actual runtime, homework, premium theme and paper renderers',() => {
  const source=readFileSync(new URL('../scripts/verify-live-lunch.mjs',import.meta.url),'utf8');
  for(const path of ['data/study-pack-runtime.json','data/homework-current.json',
    'test-study-pair.mjs','classroom-test-guide.mjs','premium-paper-theme.mjs'])
    assert.ok(source.includes("'"+path+"'"),path+' must be exact-byte verified on the live site');
});

test('fresh governed curriculum output satisfies the live Study Games difficulty floor',() => {
  const pipeline=buildGrade2ContentPipeline({
    sourceHash:'fresh-governed-curriculum',
    subjects:[
      {subject:'Spelling / Handwriting',topics:['Test focus: short i / long i'],studyNotes:[]},
      {subject:'Math',topics:['Math (subtraction)'],studyNotes:[]},
    ],
    vocabulary:[],
  },{sourceHash:'fresh-governed-curriculum'});

  const governed=pipeline.questions.filter(row=>row.skill==='short-i-long-i'||row.skill==='math-subtraction');
  assert.equal(governed.length,18);
  assert.ok(governed.every(row=>Number.isInteger(row.difficulty)&&row.difficulty>=2&&row.difficulty<=3));

  const engine=loadEngine();
  const built=engine.buildCatalog({sourceHash:'fresh-governed-curriculum',contentPipeline:pipeline});
  const material=built.questions.filter(row=>row.tier==='material'&&(row.skill==='short-i-long-i'||row.skill==='math-subtraction'));
  assert.equal(material.length,18);
  assert.ok(material.every(row=>row.difficulty>=2&&row.difficulty<=3));
});

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


test('printable study guides stay test-specific, complete, and honest about missing coverage',() => {
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
  assert.equal(grammarGuide.practice.length,grammar.length,'keep all current matching practice');
  assert.ok(grammarGuide.facts.length >= 2,'keep the verified source ideas');

  const spellingGuide = model.testGuide(1);
  assert.equal(spellingGuide.subject,'Spelling / Handwriting');
  assert(spellingGuide.practice.every(row => row.skill === 'long-short-i'));
  assert(!spellingGuide.facts.some(row => /short a|long a/i.test(row)),'an old vowel pattern must not leak into the current test guide');
  assert.equal(model.testGuide(99),null);
});


test('test-week spelling guide uses only the photographed matching-week word list',() => {
  const events=[{date:'2026-10-09',label:'Spelling (short i / long i) / Handwriting'}];
  const schoolwork={lessons:[
    {id:'old',subject:'Spelling / Handwriting',weekOf:'2026-09-28',studiedOn:null,
      notes:['Photo-confirmed practice words in the recorded order: cat, can, hat.'],questions:[]},
    {id:'current',subject:'Spelling / Handwriting',weekOf:'2026-10-05',studiedOn:null,
      notes:['Photo-confirmed practice words in the recorded order: did, fin, pick, line, tip, pipe, mix, five, side, cape, hike, made, all, any, says.'],questions:[]},
  ]};
  const model=createStudyMaterials(opts({events,schoolwork,catalog:catalog([]),pack:{subjects:[]}}));
  const guide=model.testGuide(0);
  assert.deepEqual(guide.spellingWords,[
    'did','fin','pick','line','tip','pipe','mix','five','side','cape','hike','made','all','any','says']);
  const printed=printableStudyGuideHtml(guide);
  assert.match(printed,/Spelling Word Study/);
  assert.match(printed,/Cheer-the-letters/);
  assert.match(printed,/Roblox word builder/);
  assert.doesNotMatch(printed,/>cat</);
  assert.doesNotMatch(printed,/Parent Answer Key/);
  assert.doesNotMatch(printed,/class="choices"/);
});
test('unknown spelling lists do not invent words from matching multiple-choice answers',() => {
  const events=[{date:'2026-10-09',label:'Spelling (short i / long i) / Handwriting'}];
  const spelling=pool('unknown-spelling-',3,'Spelling / Handwriting',{skill:'short-i-long-i',answer:'kite',choices:['kite','kit','kitey']});
  const model=createStudyMaterials(opts({events,catalog:catalog(spelling)}));
  const guide=model.testGuide(0);
  assert.deepEqual(guide.spellingWords,[]);
  const html=printableStudyGuideHtml(guide);
  assert.match(html,/No confirmed word list/);
  assert.doesNotMatch(html,/<strong>kite<\/strong>/);
});
test('test-style printable sheets hide answers on the student page and show a separate key',() => {
  const events=[{date:'2026-10-05',label:'Math (subtraction)'}];
  const rows=[
    {id:'math1',subject:'Math',skill:'math-subtraction',prompt:'What is 13 - 5?',answer:'8',choices:['7','8','9'],tier:'material'},
    {id:'math2',subject:'Math',skill:'math-subtraction',prompt:'What is 15 - 3?',answer:'12',choices:['13','11','12'],tier:'material'},
  ];
  const model=createStudyMaterials(opts({events,catalog:catalog(rows)}));
  const guide=model.testGuide(0);
  const html=printableWorksheetHtml(guide);
  assert.match(html,/Math Practice Test/);
  assert.match(html,/math-grid/);
  assert.match(html,/Show your work/);
  assert.match(html,/Parent Answer Key/);
  const student=html.split('<section class="sheet adult-key">')[0];
  assert.doesNotMatch(student,/>8<\/li>/);
  assert.doesNotMatch(student,/>12<\/li>/);
  assert.match(html,/@page\{size:Letter portrait/);
});



test('historical and undated schoolwork cannot enter a newly announced test paper',()=>{
  const events=[{date:'2026-10-09',label:'Grammar (subject & predicate)'}];
  const grammar=pool('new-grammar-',2,'Reading / ELA',{skill:'subject-predicate'});
  const old=pool('old-grammar-',2,'Reading / ELA',{skill:'subject-predicate'});
  const undated=pool('undated-grammar-',2,'Reading / ELA',{skill:'subject-predicate'});
  const schoolwork={lessons:[
    lesson('old',old,'2026-09-29'),
    lesson('unknown',undated),
    lesson('current',grammar,'2026-10-07'),
  ]};
  const model=createStudyMaterials(opts({events,schoolwork,catalog:catalog([]),now:()=>Date.parse('2026-10-08T12:00:00Z')}));
  assert.deepEqual(model.testGuide(0).practice.map(p=>p.prompt),grammar.map(q=>q.prompt));
});

test('new same-week teacher spelling words supersede previous photographic homework words',()=>{
  const events=[{date:'2026-10-09',label:'Spelling (short i / long i) / Handwriting'}];
  const schoolwork={lessons:[{
    id:'photo-spelling',subject:'Spelling / Handwriting',weekOf:'2026-10-05',studiedOn:null,
    notes:['Photo-confirmed practice words in the recorded order: did, fin, pick.'],questions:[],
  }]};
  const teacher={subjects:[{subject:'Spelling / Handwriting',studyNotes:['Spelling words: kite, lime, ride, time.']}],weekLabel:'Week of October 5, 2026'};
  const model=createStudyMaterials(opts({events,schoolwork,pack:teacher}));
  assert.deepEqual(model.testGuide(0).spellingWords,['kite','lime','ride','time']);
  const outdated=createStudyMaterials(opts({events,schoolwork,pack:{...teacher,weekLabel:'Week of September 28, 2026'}}));
  assert.deepEqual(outdated.testGuide(0).spellingWords,['did','fin','pick']);
});
test('explicit subtraction test cannot use additions from the current Math bank',()=>{
  const events=[{date:'2026-10-05',label:'Math (subtraction)'}];
  const rows=[
    question('old-addition','Math',{skill:'math-addition',prompt:'Solve 4 + 5',answer:'9',choices:['8','9','10']}),
    question('new-subtraction','Math',{skill:'math-subtraction',prompt:'Solve 12 - 5',answer:'7',choices:['6','7','8']}),
  ];
  const model=createStudyMaterials(opts({events,catalog:catalog(rows)}));
  const guide=model.testGuide(0),round=model.testRound({seed:1});
  assert.deepEqual(guide.practice.map(row=>row.answer),['7']);
  assert.deepEqual(round.questions.map(row=>row.answer),['7']);
});

test('upcoming test study guides use only announced Math, long-o and short-vowel material', () => {
  const events = [
    {date:'2026-10-15',label:'Math (subtraction)',kind:'test'},
    {date:'2026-10-16',label:'Spelling (long o / Short ) / Handwriting',kind:'test'},
    {date:'2026-10-16',label:'Phonics (short vowels)',kind:'test'},
  ];
  const rows = [
    ...pool('sub-',8,'Math',{skill:'math-subtraction',sourceFact:'Grade 2 subtraction within 20'}),
    ...pool('add-',8,'Math',{skill:'math-addition',sourceFact:'Addition is combining groups'}),
    ...pool('long-o-',8,'Spelling / Handwriting',{skill:'long-o',sourceFact:'Original long o practice'}),
    ...pool('short-i-',8,'Spelling / Handwriting',{skill:'long-short-i',sourceFact:'Last week short i practice'}),
    ...pool('vowels-',8,'Reading / ELA',{skill:'short-vowels',sourceFact:'Original five short vowel sounds'}),
  ];
  const model = createStudyMaterials({
    ...opts(),
    now:()=> '2026-10-14T23:00:00Z',
    events,catalog:catalog(rows),pack:{
      sourceCheckedAt:'2026-10-08T15:00:17Z',
      subjects:[
        {subject:'Math',topics:['Math (subtraction)','Math (addition)'],studyNotes:['Use subtraction facts within 20.','Extra addition exercise only.']},
        {subject:'Spelling / Handwriting',topics:['Last week short i and long i','New long o sound'],studyNotes:['Long o practice words such as home and boat.']},
        {subject:'Reading / ELA',topics:['Phonics: short vowels'],studyNotes:['Short vowels are the sounds in cat, bed, sit, hot, sun.']},
      ],
    },
  });
  const available=model.printableTests().tests;
  function guide(label){const i=available.findIndex(item=>item.label===label);assert(i>=0);return model.testGuide(i);}
  const math=guide('Math (subtraction)');
  assert(math.practice.length);
  assert(math.practice.every(q=>q.skill==='math-subtraction'));
  assert(!math.facts.some(row=>/extra addition exercise only/i.test(row)));
  const spelling=guide('Spelling (long o / Short ) / Handwriting');
  assert(spelling.practice.length);
  assert(spelling.practice.every(q=>q.skill==='long-o'));
  assert(spelling.warnings.some(row=>/does not name the short vowel/i.test(row)));
  assert(spelling.warnings.some(row=>/last checked on 2026-10-08/i.test(row)));
  const phonics=guide('Phonics (short vowels)');
  assert(phonics.practice.length);
  assert(phonics.practice.every(q=>q.skill==='short-vowels'));
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

test('selected guide uses the same assessment-inclusive test identity as Test Prep',() => {
  const events=[{date:'2026-10-05',label:'STAR Testing window',kind:'assessment'},
    {date:'2026-10-07',label:'Math',kind:'test'},
    {date:'2026-10-09',label:'Reading',kind:'test'}];
  const model=createStudyMaterials(opts({events,catalog:catalog([...pool('guide-math-',5),...pool('guide-reading-',5,'Reading / ELA',{skill:'text-evidence'})])}));
  const upcoming=model.upcomingTests().tests;
  assert.equal(upcoming[0].label,'STAR Testing window');
  for(let index=0;index<upcoming.length;index++){
    const guide=model.testGuide(index,{upcoming:true});
    assert.equal(guide.label,upcoming[index].label);
    assert.equal(guide.date,upcoming[index].date);
    if(index===0){assert.equal(guide.practice.length,0);assert.ok(guide.warnings.some(row=>/No current, matching test questions/.test(row)));}
  }
  assert.equal(model.testGuide(0).label,'Math','legacy printable guide indexes still exclude assessment windows');
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
  assert.match(html,/<h1>Study Guide<\/h1>/);
  assert.match(html,/What I need to know/);
  assert.match(html,/How to remember it/);
  assert.match(html,/Say it without looking/);
  assert.match(html,/to need or rely on someone or something/);
  assert.doesNotMatch(html,/teacher page does not provide a definition/);
  assert.doesNotMatch(html,/Parent Answer Key/);
  assert.match(html,/Original home practice/);
});


test('every test has both an instructional study guide and an independent worksheet',()=>{
  const events=[
    {date:'2026-10-05',label:'Math (subtraction)'},
    {date:'2026-10-06',label:'Grammar (subject & predicate)'},
    {date:'2026-10-07',label:'Reading'},
    {date:'2026-10-08',label:'Religion Ch. 3'},
    {date:'2026-10-09',label:'Spelling (short i / long i) / Handwriting'},
    {date:'2026-10-09',label:'Science'},
  ];
  const rows=[
    ...pool('math-current-',3,'Math',{skill:'math-subtraction',prompt:'Solve 15 - 6.',answer:'9',choices:['8','9','10'],explanation:'Subtract six from fifteen to get nine.'}),
    ...pool('grammar-current-',3,'Reading / ELA',{skill:'subject-predicate',sourceFact:'Subject tells who or what the sentence is about.'}),
    ...pool('reading-current-',3,'Reading / ELA',{skill:'text-evidence',sourceFact:'Use text evidence from the passage.'}),
    ...pool('religion-current-',3,'Religion',{skill:'religion-chapter-3',sourceFact:'Chapter 3: Church life and Baptism.'}),
  ];
  const model=createStudyMaterials(opts({events,catalog:catalog(rows)}));
  for(let i=0;i<events.length;i++){
    const guide=model.testGuide(i),study=printableStudyGuideHtml(guide),worksheet=printableWorksheetHtml(guide);
    assert(guide,'the announced test must have study materials');
    assert.match(study,/<main class="sheet/);
    assert.match(worksheet,/<main class="sheet/);
    assert.notEqual(study,worksheet,'the learning guide must not repeat the worksheet');
    assert.match(study,/@page\{size:Letter portrait/);
    assert.match(worksheet,/@page\{size:Letter portrait/);
    assert(study.includes(guide.label.replaceAll('&','&amp;')) || study.includes('Spelling Word Study'));
  }
  const math=model.testGuide(0);
  assert.equal(math.practice[0].explanation,'Subtract six from fifteen to get nine.');
  const learned=printableStudyGuideHtml(math),tested=printableWorksheetHtml(math);
  assert.match(learned,/Subtract six from fifteen to get nine/);
  assert.match(learned,/How to remember it/);
  assert.match(tested,/Math Practice Test/);
  assert.match(tested,/Show your work/);
  assert.doesNotMatch(learned,/Math Practice Test/);
  const scienceIndex=model.printableTests().tests.findIndex(test=>test.label==='Science');
  const science=model.testGuide(scienceIndex);
  assert.equal(science.practice.length,0);
  assert.match(printableStudyGuideHtml(science),/Additional verified facts have not been published yet/);
  assert.match(printableWorksheetHtml(science),/Topic Practice Worksheet/);
  assert.match(printableWorksheetHtml(science),/not a reproduction of the teacher test/);
});
test('spelling worksheet uses blank dictation lines and separates the current word list',()=>{
  const events=[{date:'2026-10-09',label:'Spelling (short i / long i) / Handwriting'}];
  const schoolwork={lessons:[{id:'spelling',subject:'Spelling / Handwriting',weekOf:'2026-10-05',
    notes:['Photo-confirmed practice words in the recorded order: did, fin, pick, line, tip, pipe, mix, five, side, cape, hike, made, all, any, says.'],questions:[]}]};
  const model=createStudyMaterials(opts({events,schoolwork}));
  const guide=model.testGuide(0),study=printableStudyGuideHtml(guide),worksheet=printableWorksheetHtml(guide);
  assert.match(study,/Spelling Word Study/);
  assert.match(study,/Cheer-the-letters/);
  assert.match(worksheet,/Spelling Dictation/);
  assert.equal((worksheet.match(/class="dictation-item"/g)||[]).length,15);
  const student=worksheet.split('<section class="sheet adult-key">')[0];
  assert.doesNotMatch(student,/<li>did<\/li>/);
  assert.doesNotMatch(student,/<strong>did<\/strong>/);
  assert.doesNotMatch(student,/>five</);
  assert.match(worksheet,/Adult Dictation List/);
  assert.match(worksheet,/<li>did<\/li>/);
  assert.match(worksheet,/<li>says<\/li>/);
  const unknown=printableWorksheetHtml({...guide,spellingWords:[],warnings:[]});
  assert.equal((unknown.match(/class="dictation-item"/g)||[]).length,15);
  assert.doesNotMatch(unknown,/Adult Dictation List/);
  assert.match(unknown,/current spelling list is not yet confirmed/);
});
test('printable guide and worksheet escape untrusted teacher labels and practice prompts',()=>{
  const input={label:'Reading <script>bad</script>',subject:'Reading / ELA',date:'2026-10-09',
    facts:['Focus on <img src=x onerror=alert(1)>'],practice:[{
      prompt:'Which is correct? <script>bad</script>',answer:'It is <safe>',choices:['wrong','It is <safe>']
    }],warnings:[]};
  for(const html of [printableStudyGuideHtml(input),printableWorksheetHtml(input)]){
    assert.doesNotMatch(html,/<script>bad<\/script>/);
    assert.doesNotMatch(html,/<img src=x onerror=/);
    assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/);
  }
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
    assert.equal(scope.count,rows.length);
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

test('Mix exhausts current material before using STAR-style material from another subject',() => {
  const rows = [...pool('reading-',12,'Reading / ELA'),...pool('fallback-',12,'Math',{tier:'star-fallback'})];
  const model = createStudyMaterials(opts({catalog:catalog(rows),engine:loadEngine()}));
  const round = model.round('quick',{seed:4});
  assert.equal(round.questions.length,8);
  assert(round.questions.every(q => q.subject === 'Reading / ELA' && q.tier === 'material'));
  assert.equal(model.forMode('faith').count,0);
  assert.equal(model.round('faith',{seed:4}).questions.length,0);
});

test('dated current schoolwork is selectable by existing engine without relabeling the source object',() => {
  const row = question('archived-math'); delete row.tier;
  const archive = {questions:[archiveRow(row,'2026-10-05',[{capturedAt:'2026-10-05'}])],notes:[],vocabulary:[]};
  const model = createStudyMaterials(opts({catalog:catalog(pool('fallback-',8,'Math',{tier:'star-fallback'})),archive,engine:loadEngine()}));
  const firstRound=model.round('math',{seed:0});
  assert.equal(firstRound.questions[0].id,'archived-math');
  assert.equal(archive.questions[0].tier,undefined);
  assert.deepEqual(firstRound.questions[0].provenance,archive.questions[0].provenance,
    'the original reviewed source must remain intact even when later rounds rotate');
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
  const model = createStudyMaterials(opts({events,catalog:catalog([...pool('math-',8),...pool('reading-',8,'Reading / ELA')]),schoolwork:{lessons:[lesson('chapter-2',pool('religion-',6,'Religion',{skill:'religion-chapter-2'}),'2026-10-05')]}}));
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

test('test prep never substitutes older STAR curriculum or unrelated vowel questions',() => {
  const events = [{date:'2026-10-05',label:'Spelling (short i / long i) / Handwriting'},{date:'2026-10-05',label:'Science'}];
  const model = createStudyMaterials(opts({events,catalog:catalog(pool('short-a-',8,'Spelling / Handwriting',{skill:'long-short-a',sourceFact:'short a / long a'}))}));
  const state = model.tests();
  assert.equal(state.date,'2026-10-05');
  assert.equal(state.supported.length,0);
  assert.deepEqual(state.missing.map(row=>row.label),events.map(row=>row.label));
  assert.deepEqual(state.fallback,[]);
  assert.deepEqual(model.testRound({seed:1}).questions,[]);
  assert.deepEqual(model.testRound({index:0,seed:1}).questions,[]);
  assert.deepEqual(model.testRound({index:1,seed:1}).questions,[]);
  assert.deepEqual(model.testRound({index:-1,seed:1}).questions,[]);
});

test('source-backed short-i/long-i practice outranks the STAR fallback for the announced test',() => {
  const events = [{
    date:'2026-10-05',
    label:'Spelling (short i / long i) / Handwriting',
    kind:'test',
  }];
  const current = pool('current-short-i-',9,'Spelling / Handwriting',{
    skill:'short-i-long-i',
    sourceFact:'Verified teacher test focus: short i / long i.',
    explanation:'Use the short-i or long-i vowel pattern in the word.',
  });
  const model = createStudyMaterials(opts({events,catalog:catalog(current)}));
  const state = model.tests();

  assert.equal(state.supported.length,1);
  assert.equal(state.supported[0].fallback,false);
  assert.deepEqual(state.fallback,[]);

  const round = model.testRound({seed:17});
  assert.equal(round.questions.length,8);
  assert(round.questions.every(q => q.skill === 'short-i-long-i'));
  assert.deepEqual(round.fallback,[]);
});

test('test calendar advances in New York, respects explicit endings and never guesses a missing date',() => {
  let now = '2026-10-05T15:00:00Z';
  const events = [{date:'2026-10-05',label:'Math',endsAt:'2026-10-05T15:30:00Z'},
    {date:'2026-10-06',label:'Reading'}, {label:'Grammar (subject & predicate)'}];
  const model = createStudyMaterials({now:() => now,events,storage:memory()});
  assert.equal(model.tests().date,'2026-10-05');
  now = '2026-10-05T15:30:00Z';
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
  assert.deepEqual(weekly.notes,[],'undated teacher pages are cumulative even after a fresh crawl');
  assert.deepEqual(saved.notes.slice(0,2).map(n => n.text),['Exact topic.','  Exact source spaces.  ']);
  assert.equal(saved.notes[0].sourceHash,'teacher-source');
  assert.equal(saved.notes.at(-1),note);
  assert.equal(saved.vocabulary.at(-1),word);
  assert.equal(weekly.vocabulary.length,0);
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


test('Class notes display exact repeats once per subject while preserving governed source rows',() => {
  const shared='Shared exact.';
  const input=freeze({pack:{sourceHash:'current-teacher',sourceCapturedAt:'2026-10-07T03:00:00Z',subjects:[
    {subject:'Religion',topics:['  '+shared+'  '],studyNotes:[shared,'Shared exact!']},
    {subject:'Reading / ELA',topics:[],studyNotes:[shared]},
  ]},schoolwork:{lessons:[{id:'separate-lesson',title:'Separate lesson',subject:'Religion',studiedOn:'2026-10-05',notes:[shared,shared],questions:[]}]},archive:{questions:[],vocabulary:[],notes:[
    archiveRow({id:'religion-archive',subject:'Religion',text:shared,kind:'note'},'2026-10-06',[{sourceRef:'archive-evidence',capturedAt:'2026-10-06'}]),
    archiveRow({id:'math-archive',subject:'Math',text:shared,kind:'note'},'2026-10-06',[{sourceRef:'other-subject-evidence',capturedAt:'2026-10-06'}]),
  ]}});
  const before=structuredClone(input),model=createStudyMaterials({...input,now:()=>new Date('2026-10-07T16:00:00Z'),storage:memory()});
  const original=model.notes('saved');
  assert.equal(original.notes.filter(row=>row.subject==='Religion').length,4);
  const rows=notesLibraryData(original),religion=rows.find(row=>row.subject==='Religion');
  assert.deepEqual(religion.original,['  Shared exact.  ','Shared exact!']);
  for(const subject of ['Reading / ELA','Math'])assert(rows.find(row=>row.subject===subject).original.includes(shared));
  assert.deepEqual(religion.lessons[0].notes,[shared,shared],'separate lesson sequences stay intact');
  assert.deepEqual(model.notes('saved'),original);
  assert.deepEqual(input,before);
  assert.equal(original.notes.find(row=>row.id==='religion-archive'),input.archive.notes[0]);
  assert.deepEqual(model.notes('weekly').notes,[],'a recent capture cannot date undated notes');

});

test("actual October 15 Chapter 3 live Test Prep works with compact runtime and full-pack fallback",()=>{
  const full=JSON.parse(readFileSync(new URL('../pages/data/study-pack.json',import.meta.url),'utf8'));
  const runtime=buildRuntimePack(full);
  const reviewed=full.pack.contentPipeline.questions.filter(row=>religionChapterScopes(row).includes(3));
  const allowed=new Set(reviewed.map(q=>q.id));
  assert.equal(allowed.size,18);
  const excluded=full.pack.contentPipeline.questions.filter(q=>q.subject==='Religion'&&!allowed.has(q.id));
  // A source-backed Chapter 2 vine-and-branches family adds three exercises,
  // but must never leak into the 18 verified Chapter 3 review questions.
  const vine=excluded.filter(q=>q.skill==='religion-vine-branches');
  assert.equal(vine.length,full.pack.contentPipeline.skills.some(s=>s.id==='religion-vine-branches')?3:0);
  assert.ok(vine.every(q=>!religionChapterScopes(q).includes(3)));
  assert.equal(excluded.length,21+vine.length);
  const engine=loadEngine();
  for(const envelope of [runtime,full]){
    const pack=envelope.pack;
    const built=engine.buildCatalog(pack,{sourceKey:'religion-ch3-live-validation'});
    const model=createStudyMaterials({
      pack,catalog:built,storage:memory(),
      now:()=>Date.parse('2026-10-13T20:00:00Z'),
      events:[{date:'2026-10-15',label:'Religion Ch. 3',kind:'test'}],
    });
    const state=model.printableTests();
    const listed=state.supported.find(row=>row.label==='Religion Ch. 3');
    assert.ok(listed,'Chapter 3 must be enabled in Test Prep, not shown as unsupported');
    assert.equal(listed.count,18);
    const round=model.testRound({index:0,upcoming:true,seed:'chapter3-regression'});
    assert.equal(round.questions.length,8);
    assert.ok(round.questions.every(q=>allowed.has(q.id)),'only the reviewed Chapter 3 questions are selectable');
    assert.ok(round.questions.every(q=>q.subject==='Religion'));
    const guide=model.testGuide(0,{upcoming:true});
    assert.equal(guide.label,'Religion Ch. 3');
    assert.equal(guide.practice.length,18,'do not reduce 18 verified Chapter 3 facts to the old 10-question worksheet cap');
    assert.deepEqual(guide.coverage.missingGuideSkills,[],'every tested skill must have a named study-guide section');
    assert.equal(guide.reviewTopics.length,6,'near-duplicate practice questions are grouped into six clear tested concepts');
    assert.equal(guide.reviewTopics.reduce((sum,row)=>sum+row.checks.length,0),18,'every matching practice question remains available inside its concept');
    for(const fact of [
      'Original sin','Faith: gift from God','Sacrament: sacred sign','At Baptism',
      'Church members (Christians)','Jesus is the head of the Church','Pope Leo and Bishop Schlert',
      'the priest welcomes the person','a white garment is given','a candle is lit',
    ])assert.ok(guide.teacherFacts.some(row=>row.includes(fact)),`complete Chapter 3 checklist is missing: ${fact}`);
    const html=printableStudyGuideHtml(guide);
    for(const topic of guide.reviewTopics)assert.match(html,new RegExp('data-guide-skill="'+topic.id+'"'));
    assert.doesNotMatch(html,/>religion-[a-z-]+</,'internal skill IDs must not appear as student-facing labels');
    assert.equal(state.missing.length,0);
  }
});

test("Chapter 3 guide does not mix in Chapter 1 or Chapter 2 subject notes",()=>{
  const row=question('chapter3-guide','Religion',{
    skill:'religion-chapter-3',sourceFact:'Baptism washes away original sin.',
    explanation:'Faith is a gift from God that helps us believe.'
  });
  const model=createStudyMaterials(opts({
    pack:{subjects:[{subject:'Religion',
      topics:['Chapter 1: creation and five senses','Chapter 2: disciples','Chapter 3: original sin and Baptism'],
      studyNotes:['Chapter 1: Trinity review']}]},
    catalog:catalog([row]),events:[{date:'2026-10-07',label:'Religion Ch. 3',kind:'test'}]
  }));
  const guide=model.testGuide(0);
  assert.ok(guide.facts.some(row=>/Chapter 3:/.test(row)));
  assert.ok(guide.facts.every(row=>!/^Chapter [12]:/.test(row)));
  assert.ok(guide.practice.some(item=>item.skill==='religion-chapter-3'));
});

test('premium test packets print every matched current skill with existing ImageGen art and matching answers',() => {
  const events=[{date:'2026-10-15',label:'Math (subtraction)',kind:'test'}];
  const currentRows=Array.from({length:18},(_,index)=>{
    const first=20-index,answer=String(first-1);
    return question('subtract-full-'+index,'Math',{
      skill:'math-subtraction',
      prompt:'What is '+first+' - 1?',
      answer,
      choices:[String(first),answer,String(first-2)],
      sourceFact:'Reviewed subtraction fact '+(index+1)+'.',
      explanation:'Taking away one from '+first+' leaves '+answer+'.',
    });
  });
  const model=createStudyMaterials(opts({
    now:()=> '2026-10-14T12:00:00Z',
    events,catalog:catalog(currentRows),
    pack:{subjects:[{subject:'Math',topics:['Math (subtraction)'],studyNotes:[]}]},
  }));
  const guide=model.testGuide(0),study=printableStudyGuideHtml(guide),sheet=printableWorksheetHtml(guide);
  assert.equal(guide.practice.length,18,'all source-matched questions must reach presentation');
  assert.ok(guide.facts.length >= 18,'all distinct source-matched facts must reach the guide');
  for(const row of guide.practice){
    assert.ok(study.includes(row.prompt),'guide omitted '+row.prompt);
    assert.ok(sheet.includes(row.prompt),'worksheet omitted '+row.prompt);
  }
  const student=sheet.split('<section class="sheet adult-key">')[0];
  assert.equal((student.match(/class="problem /g)||[]).length,18);
  assert.equal((sheet.match(/<li><b>\d+\.<\/b>/g)||[]).length,18);
  assert.doesNotMatch(student,/Parent Answer Key/);
  for(const page of [study,sheet]){
    assert.match(page,/body class="premium-paper paper-math"/);
    assert.match(page,/assets\/illustrations\/math\.webp/);
    assert.match(page,/premium-mini-art/);
    assert.match(page,/print-color-adjust:exact/);
    assert.match(page,/@page\{size:Letter portrait/);
  }
  // Source update and homework logic are not in the presentation layer.
  assert.doesNotMatch(study,/\.github\/workflows\/refresh-current-homework/);
});

test('short-vowel phonics guide excludes unrelated reading notes and vocabulary',()=>{
  const row=question('short-vowel-guide','Reading / ELA',{
    skill:'short-vowels',sourceFact:'short-vowels',
    prompt:'Which word has short a?',answer:'Cat',choices:['Cat','Cake','Rain'],
    explanation:'Cat has the short a sound.',
  });
  const model=createStudyMaterials(opts({
    events:[{date:'2026-10-09',label:'Phonics (short vowels)',kind:'test'}],
    catalog:catalog([row]),
    pack:{subjects:[{subject:'Reading / ELA',topics:[
      'Story: Families Work','Phonics: short vowels (test Friday)',
      'Phonics: long i (i_e) and short i','Word structure: possessives',
    ],studyNotes:['Compare chart values.','Short vowels include a in cat and e in bed.']}],
    vocabulary:[{subject:'Reading / ELA',term:'customers'}]},
  }));
  const guide=model.testGuide(0),html=printableStudyGuideHtml(guide);
  assert.equal(guide.practice.length,1);
  assert.ok(guide.facts.some(text=>text.includes('Short vowels include')));
  assert.ok(guide.facts.some(text=>text.includes('Phonics: short vowels')));
  assert.deepEqual(guide.vocabulary,[]);
  assert.doesNotMatch(html,/Families Work|possessives|chart values|customers|i_e/);
  assert.doesNotMatch(html,/>short-vowels</);
  assert.match(html,/Which word has short a\?/);
  assert.match(html,/Cat has the short a sound/);
});

test('test prep, study guides and worksheets share the 3pm school-day retirement',()=>{
 let now='2026-10-15T18:59:59Z';
 const events=[{date:'2026-10-15',label:'Math'},{date:'2026-10-15',label:'Reading'},{date:'2026-10-16',label:'Spelling'},{date:'2026-10-16',label:'Phonics'}];
 const model=createStudyMaterials({now:()=>now,events,storage:memory()});
 assert.deepEqual(model.tests().tests.map(t=>t.label),['Math','Reading']);
 assert.equal(model.printableTests().tests.length,4);
 assert.equal(model.upcomingTests().tests.length,4);
 now='2026-10-15T19:00:00Z';
 for(const state of [model.tests(),model.printableTests(),model.upcomingTests()]){
  assert.equal(state.tests.length,2);
  assert.ok(state.tests.every(t=>t.date==='2026-10-16'));
 }
 assert.equal(events.length,4);
});

test('notes expose only explicitly sourced chapter explanations in full and compact packs',()=>{
  const pack={sourceSufficient:true,subjects:[{subject:'Religion',topics:['Chapter 3: Church','Chapter 1: Gifts','Chapter 9: Unknown'],studyNotes:['Unscoped class note.']}],
    contentPipeline:{questions:[],skills:[{id:'religion-chapter-3',subject:'Religion',sourceLineage:{matchedEvidence:['Chapter 3: Church * Faith is a gift from God. * A sacrament is a sacred sign.']}},{id:'religion-chapter-1',subject:'Religion',sourceLineage:{matchedEvidence:['Chapter 1: Gifts * We care for creation.']}}]},recentReviewPipeline:{questions:[]}};
  for(const input of [pack,buildRuntimePack({pack}).pack]){
    const data=createStudyMaterials(opts({pack:input})).notes('saved');
    assert.deepEqual(data.explanations.map(row=>row.topic),['Chapter 3: Church','Chapter 1: Gifts']);
    assert.ok(data.explanations[0].paragraphs.some(row=>row.includes('Faith is a gift from God')));
    assert.ok(!data.explanations[0].paragraphs.some(row=>row.includes('creation')));
    assert.ok(!data.explanations.some(row=>row.topic.includes('Chapter 9')));
    assert.equal(data.notes.find(row=>row.kind==='study-note').text,'Unscoped class note.');
  }
});
