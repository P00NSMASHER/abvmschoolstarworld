/** Material selection for the existing Games player. This module owns no DOM or answers. */
import {createStudyResourceLoader, validStudyResource} from './study-resources.mjs';
import {questionsForTest} from './study-hub-core.mjs';
import {adaptivePracticeRound, practiceIdentity} from './study-experience.mjs';
import {schoolDay, weekBounds, nextTests, visibleArchive, weeklyArchive, balancedTestRound} from './study-model.mjs';
import {buildStarBank} from './star-practice.mjs';

const names = {weekly:'This week', saved:'Saved learning', star:'STAR practice', mix:'Study mix'};
const modes = {
  // Legacy IDs remain engine-compatible for saved sessions and offline caches.
  quick:{title:'Mix', subjects:[]},
  words:{title:'Reading / ELA', subjects:['Reading / ELA','Spelling / Handwriting']},
  faith:{title:'Religion', subjects:['Religion']},
  reading:{title:'Reading / ELA', subjects:['Reading / ELA']},
  spelling:{title:'Spelling / Handwriting', subjects:['Spelling / Handwriting']},
  math:{title:'Math', subjects:['Math']},
  religion:{title:'Religion', subjects:['Religion']},
  mix:{title:'Mix', subjects:[]},
  daily:{title:'Daily Practice', subjects:[]},
};
const emptyArchive = () => ({questions:[], notes:[], vocabulary:[]});
const sharedResource = createStudyResourceLoader((...args) => fetch(...args));
const array = value => Array.isArray(value) ? value : [];
const meaningfulText = value => typeof value === 'string' && value.trim().length > 0;
const safeQuestion = q => q && typeof q.id === 'string' && q.id &&
  typeof q.subject === 'string' && typeof q.skill === 'string' &&
  typeof q.prompt === 'string' && typeof q.answer === 'string' &&
  Array.isArray(q.choices) && q.choices.length > 1 &&
  q.choices.every(choice => typeof choice === 'string') &&
  new Set(q.choices).size === q.choices.length && q.choices.includes(q.answer);
// A full catalog keeps alternate IDs for pending support/history. Selection alone
// deduplicates equivalent questions; it never changes an ID or an answer choice.
function byId(rows) {
  const seen = new Set();
  return rows.filter(q => safeQuestion(q) && !seen.has(q.id) && seen.add(q.id));
}
function unique(rows) {
  const seen = new Set();
  return byId(rows).filter(q => !seen.has(practiceIdentity(q)) && seen.add(practiceIdentity(q)));
}
function defaultStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}
function read(storage, key, fallback) {
  try { return JSON.parse(storage?.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(storage, key, value) {
  try {
    if (typeof storage?.setItem !== 'function') return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}
function normalizedStar(q) {
  const skill = {
    Addition:'addition-within-100', Subtraction:'subtraction-within-100',
    'Place value':'place-value', 'Compare numbers':'compare-numbers', Time:'time',
    Measurement:'measurement', Data:'data-interpretation', Inference:'inference',
    Evidence:'text-evidence', Purpose:'author-purpose', 'Cause and effect':'cause-effect',
    Vocabulary:'vocabulary-in-context',
  }[q.skill] || q.skill.toLowerCase().replace(/ /g, '-');
  return skill === q.skill ? q : {...q, skill};
}
// This is a routing/rotation key, not a source validation hash. Bind it to the
// actual bank, including choice order and source metadata, not just a menu label.
function bankKey(rows) {
  const value = JSON.stringify([...rows].sort((a,b) => a.id.localeCompare(b.id)));
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function selectedSources(source, sources) {
  if (source !== 'mix') return Object.hasOwn(names, source) ? [source] : [];
  return ['weekly','saved','star'].filter(key => array(sources ?? ['weekly']).includes(key));
}
function matchesMode(q, modeId) {
  const mode = modes[modeId];
  return !!mode && (!mode.subjects.length || mode.subjects.includes(q.subject));
}
function weeklyEligible(rows, modeId) {
  const pool = rows.filter(q => matchesMode(q, modeId));
  // Daily review may revisit an existing canonical question in any tier.
  if (modeId === 'daily') return unique(pool);
  const current = pool.filter(q => q.tier === 'material');
  const review = pool.filter(q => q.tier === 'recent-review');
  const star = pool.filter(q => q.tier === 'star-fallback' && ['Math','Reading / ELA'].includes(q.subject));
  return unique([...current, ...review, ...star]);
}

function subjectForTest(test, group = []) {
  const label = String(test?.label || '').toLowerCase();
  if (/spelling|handwriting/.test(label)) return 'Spelling / Handwriting';
  if (/grammar|predicate|subject\s*&/.test(label) || /\breading\b|\bela\b/.test(label)) return 'Reading / ELA';
  if (/religion|faith/.test(label)) return 'Religion';
  if (/\bmath\b|addition|subtraction/.test(label)) return 'Math';
  const counts = new Map();
  array(group).forEach(row => {
    if (!meaningfulText(row?.subject)) return;
    counts.set(row.subject,(counts.get(row.subject)||0)+1);
  });
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || '';
}
function compactGuideText(value, limit = 180) {
  const text = String(value ?? '').replace(/\s+/g,' ').trim();
  return text.length <= limit ? text : text.slice(0,Math.max(1,limit-1)).trimEnd() + '…';
}
function uniqueGuideText(rows) {
  const seen = new Set(), out = [];
  for (const row of rows) {
    const text = compactGuideText(row);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key); out.push(text);
  }
  return out;
}
function noteMatchesTest(text, label, subject) {
  const value = compactGuideText(text,240), lower = String(label || '').toLowerCase();
  if (!value) return false;
  if (subject === 'Reading / ELA' && /grammar|predicate|subject\s*&/.test(lower)) return /\b(?:grammar|subject|predicate)\b/i.test(value);
  if (subject === 'Spelling / Handwriting') {
    const focus = lower.match(/short\s+([aeiou])/i)?.[1]?.toLowerCase();
    const mentioned = [...value.matchAll(/\b(?:short|long)\s+([aeiou])\b/gi)].map(match=>match[1].toLowerCase());
    if (focus && mentioned.length && !mentioned.includes(focus)) return false;
    return /spell|handwriting|phonics|vowel|short|long|blend|word|letter/i.test(value);
  }
  if (subject === 'Religion') {
    const chapter = lower.match(/chapter\s*(\d+)/i)?.[1];
    return chapter ? new RegExp('\\bchapter\\s*' + chapter + '\\b','i').test(value) : true;
  }
  return true;
}

/** Failures stay retryable and cannot prevent the current Games from opening. */
export async function loadStudyMaterials({resourceLoader = sharedResource, ...options} = {}) {
  const resources = ['schoolwork.json','study-archive.json'];
  const results = await Promise.allSettled(resources.map(name => Promise.resolve().then(() => resourceLoader(name))));
  const errors = results.flatMap((result,index) => result.status === 'rejected'
    ? [{resource:resources[index], message:result.reason?.message || 'Study materials could not load.'}] : []);
  return createStudyMaterials({
    ...options,
    resourceLoader,
    schoolwork:results[0].status === 'fulfilled' ? results[0].value : {lessons:[]},
    archive:results[1].status === 'fulfilled' ? results[1].value : emptyArchive(),
    status:{ready:!errors.length, partial:!!errors.length, errors,
      loaded:{schoolwork:results[0].status === 'fulfilled', archive:results[1].status === 'fulfilled'}},
  });
}

/** Pure bank construction; only explicit round/test actions write local state. */
export function createStudyMaterials({
  pack = {}, catalog = {questions:[]}, schoolwork = {lessons:[]}, archive = emptyArchive(),
  events = [], engine, storage = defaultStorage(), now = () => Date.now(),
  religion, resourceLoader = sharedResource,
  status = {ready:true, partial:false, errors:[], loaded:{schoolwork:true, archive:true}},
} = {}) {
  const instant = () => typeof now === 'function' ? now() : now;
  const canonical = byId(array(catalog.questions));
  const current = canonical.filter(q => q.tier === 'material');
  const star = byId([...canonical.filter(q => q.tier === 'star-fallback'), ...buildStarBank().map(normalizedStar)]);
  const sourceKey = String(catalog.sourceKey || pack.sourceHash || 'abvm-current');
  const allEvents = array(events).filter(t => t && typeof t.label === 'string').map(t => ({...t}));
  const testKey = t => t.date + '|' + t.label;
  let completionUndo = null, message = '';
  let dayCache;
  let references = validStudyResource('religion-sources.json',religion) ? religion : null;
  let referencePending;

  function allLessons(time) {
    const today = schoolDay(time);
    return array(schoolwork.lessons).filter(lesson => !lesson.studiedOn || lesson.studiedOn <= today);
  }
  function datedLessons(time) {
    const {start,end} = weekBounds(time);
    return allLessons(time).filter(lesson => lesson.studiedOn && lesson.studiedOn >= start && lesson.studiedOn <= end);
  }
  function weekArchive(time) {
    // An absent capture date must never default to today's date. Use the shared
    // calendar filter on a safe view, then return the unmodified source objects.
    const originals = new Map();
    const safe = Object.fromEntries(['questions','notes','vocabulary'].map(key => [key, array(archive[key]).map(row => {
      const copy = {...row, provenance:array(row.provenance).filter(p => typeof p?.capturedAt === 'string' && Number.isFinite(Date.parse(p.capturedAt)))};
      originals.set(copy, row);
      return copy;
    })]));
    return Object.fromEntries(Object.entries(weeklyArchive(safe,time)).map(([key,rows]) => [key,rows.map(row => originals.get(row))]));
  }
  function materialDay(time = instant()) {
    const day = schoolDay(time);
    if (dayCache?.day === day) return dayCache;
    const visible = visibleArchive(archive,time), week = weekArchive(time);
    const lessons = allLessons(time), dated = datedLessons(time);
    const raw = {
      weekly:byId([...current, ...week.questions, ...dated.flatMap(l => array(l.questions))]),
      saved:byId([...visible.questions, ...lessons.flatMap(l => array(l.questions)), ...current]),
      star,
    };
    // Four tiles, notes and tests share immutable content until the school day
    // changes. Event endsAt and local completion are intentionally not cached.
    dayCache = {day,visible,week,lessons,dated,raw,scopes:new Map()};
    return dayCache;
  }
  function rawBanks(time = instant()) {
    return materialDay(time).raw;
  }
  function banks() {
    return Object.fromEntries(Object.entries(rawBanks()).map(([key,rows]) => [key,unique(rows)]));
  }
  function forMode(modeId, {source = 'weekly', sources} = {}) {
    const day = materialDay(), raw = day.raw, picks = selectedSources(source,sources);
    // Keep the canonical key and every canonical ID so old pending Comebacks
    // survive. The player checks eligibleIds before displaying a queued item.
    const cacheKey = source + '|' + picks.join('+');
    if (!day.scopes.has(cacheKey)) {
      const full = source === 'weekly'
        ? byId([...canonical, ...raw.weekly.map(q => q.tier ? q : {...q,tier:'material'}), ...raw.saved])
        : byId(picks.flatMap(key => raw[key] || []));
      const key = source === 'weekly' ? sourceKey : sourceKey + '|materials:' + picks.join('+') + ':' + bankKey(full);
      day.scopes.set(cacheKey,{full,key});
    }
    const {full,key} = day.scopes.get(cacheKey);
    const currentIds = new Set([...canonical.filter(q => q.tier === 'material'), ...raw.weekly].map(q => q.id));
    const savedIds = new Set(raw.saved.map(q => q.id));
    // Source stages are selection metadata only. Archived question objects keep
    // their original tier, dates, evidence, IDs, and answer choices intact.
    const groups = source === 'weekly' && modeId !== 'daily'
      ? [
          full.filter(q => currentIds.has(q.id) && q.tier !== 'star-fallback'),
          full.filter(q => !currentIds.has(q.id) && q.tier === 'recent-review'),
          full.filter(q => !currentIds.has(q.id) && q.tier !== 'recent-review' && q.tier !== 'star-fallback' && savedIds.has(q.id)),
          full.filter(q => q.tier === 'star-fallback' && ['Math','Reading / ELA'].includes(q.subject)),
        ].map(rows => unique(rows.filter(q => matchesMode(q,modeId))))
      : source === 'weekly' ? [weeklyEligible(full,modeId)]
      : picks.map(key => unique((raw[key] || []).filter(q => matchesMode(q,modeId))));
    const eligible = unique(groups.flat());
    const fallback = source === 'weekly' ? [...new Set(eligible.filter(q => q.tier === 'star-fallback')
      .filter(q => !eligible.some(other => other.subject === q.subject && other.tier !== 'star-fallback')).map(q => q.subject))] : [];
    return {
      catalog:{...catalog, sourceKey:key, questions:full}, groups, count:eligible.length,
      sourceKey:key, label:names[source] || 'Study materials', fallback,
      eligibleIds:eligible.map(q => q.id), source, sources:picks,
    };
  }
  function learningState(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    try { return engine?.loadLearning?.() || {}; } catch { return {}; }
  }
  function sessionSeed(key, modeId, seed) {
    if (seed !== undefined) return String(seed);
    try { if (engine?.nextSessionSeed) return String(engine.nextSessionSeed(key,modeId)); } catch {}
    const old = Number(read(storage,'abvm-hub-round',0));
    const next = (Number.isFinite(old) ? old : 0) + 1;
    write(storage,'abvm-hub-round',next);
    return String(next);
  }
  function adaptive(groups, seed, learning) {
    return adaptivePracticeRound(groups,8,seed,{
      learning, priority:skill => engine?.reviewPriority?.(learning,skill,instant()) || 0,
      recent:array(read(storage,'abvm-hub-recent:v1',[])),
    });
  }
  function round(modeId, {seed, learning, ...selection} = {}) {
    const scope = forMode(modeId,selection), mode = modes[modeId];
    const chosenSeed = sessionSeed(scope.sourceKey,modeId,seed), history = learningState(learning);
    let questions = [];
    if (mode && scope.count) {
      if (scope.source === 'weekly' && modeId === 'daily' && engine?.selectDailyQuestions) {
        questions = engine.selectDailyQuestions(scope.catalog,{count:8, seed:chosenSeed, skillStats:history, pack, now:instant()});
      } else if (scope.source === 'weekly' && modeId !== 'daily') {
        const seen = new Set();
        for (const [stage,group] of scope.groups.entries()) {
          if (questions.length >= 8) break;
          const available = group.filter(q => !seen.has(practiceIdentity(q)));
          const originals = new Map(available.map(q => [q.id,q]));
          // The engine ranks known tiers. A selection-only copy lets older
          // reviewed records without a tier participate without relabeling data.
          const selectionCatalog = {...scope.catalog,questions:available.map(q => q.tier ? q : {...q,tier:'material'})};
          const chosen = engine?.selectQuestions
            ? engine.selectQuestions(selectionCatalog,{subjects:mode.subjects, preferredSkills:mode.preferredSkills || [], count:8-questions.length, seed:chosenSeed+'|stage:'+stage, skillStats:history})
            : adaptive([available],chosenSeed+'|stage:'+stage,history).slice(0,8-questions.length);
          for (const row of chosen) {
            const q = originals.get(row.id);
            if (q && !seen.has(practiceIdentity(q))) { seen.add(practiceIdentity(q)); questions.push(q); }
          }
        }
      } else {
        // Passing a mixed union through selectQuestions would discard selected
        // STAR/saved sources when current material exists. Preserve source turns.
        questions = adaptive(scope.groups,chosenSeed,history);
      }
    }
    questions = unique(array(questions)).slice(0,8);
    if (questions.length && scope.source !== 'weekly') {
      write(storage,'abvm-hub-recent:v1',[...array(read(storage,'abvm-hub-recent:v1',[])),...questions.map(practiceIdentity)].slice(-64));
    }
    return {...scope, questions, sessionSeed:chosenSeed, title:mode?.title || 'Study practice', modeId, strict:false};
  }
  function completedKeys() {
    return new Set(array(read(storage,'abvm-completed-tests',[])).filter(key => typeof key === 'string'));
  }
  function testState() {
    const time = instant(), done = completedKeys();
    const tests = nextTests(allEvents.filter(t => !done.has(testKey(t))),time);
    const day = materialDay(time), weekly = day.raw.weekly;
    const primary = tests.map(t => questionsForTest(t,unique([
      ...weekly,
      ...(/chapter\s*\d+|grammar|predicate/i.test(t.label) ? day.lessons.flatMap(l => array(l.questions)) : []),
    ])));
    const groups = tests.map((t,i) => primary[i].length ? primary[i] : unique(questionsForTest(t,star)));
    const entries = tests.map((t,index) => ({...t, key:testKey(t), index, count:groups[index].length, fallback:!primary[index].length && !!groups[index].length}));
    const seen = new Set();
    const completed = allEvents.filter(t => done.has(testKey(t)) && /^\d{4}-\d{2}-\d{2}$/.test(t.date || '') && t.date >= schoolDay(time))
      .filter(t => !seen.has(testKey(t)) && seen.add(testKey(t))).map(t => ({...t,key:testKey(t)}));
    return {
      date:tests[0]?.date || null, tests, groups,
      supported:entries.filter(t => t.count), missing:entries.filter(t => !t.count),
      fallback:entries.filter(t => t.fallback), completed,
      canUndo:!!completionUndo, message,
    };
  }
  function tests() {
    const {groups, ...state} = testState();
    return state;
  }

  function printableTestState(includeAssessments = false) {
    const time = instant(), done = completedKeys(), today = schoolDay(time);
    const instantMs = new Date(time).getTime(), seen = new Set();
    const tests = allEvents
      .filter(t => includeAssessments || String(t.kind || '').toLowerCase() !== 'assessment')
      .filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.date || '') && t.date >= today)
      .filter(t => !done.has(testKey(t)))
      .filter(t => !t.endsAt || !Number.isFinite(Date.parse(t.endsAt)) || Date.parse(t.endsAt) > instantMs)
      .sort((a,b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))
      .filter(t => { const key=testKey(t); if (seen.has(key)) return false; seen.add(key); return true; });
    const day = materialDay(time), weekly = day.raw.weekly;
    const primary = tests.map(t => questionsForTest(t,unique([
      ...weekly,
      ...(/chapter\s*\d+|grammar|predicate/i.test(t.label) ? day.lessons.flatMap(l => array(l.questions)) : []),
    ])));
    const groups = tests.map((t,i) => primary[i].length ? primary[i] : unique(questionsForTest(t,star)));
    const entries = tests.map((t,index) => ({
      ...t, key:testKey(t), index, count:groups[index].length,
      fallback:!primary[index].length && !!groups[index].length,
    }));
    return {
      tests, groups,
      supported:entries.filter(t => t.count),
      missing:entries.filter(t => !t.count),
      fallback:entries.filter(t => t.fallback),
    };
  }
  function printableTests() {
    const {groups, ...state} = printableTestState();
    return state;
  }
  function upcomingTests() {
    const {groups, ...state} = printableTestState(true);
    return {...state,canUndo:!!completionUndo,message};
  }
  function testGuide(index) {
    const state = printableTestState(), i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= state.tests.length) return null;
    const test = state.tests[i], group = unique(state.groups[i] || []);
    const subject = subjectForTest(test,group);
    const lower = String(test.label || '').toLowerCase();
    const sourceSubjects = array(pack.subjects).filter(row => row?.subject === subject);
    const questionFacts = group.flatMap(row => [row.sourceFact,row.explanation]).filter(meaningfulText);
    const subjectFacts = sourceSubjects.flatMap(row => [...array(row.topics),...array(row.studyNotes)])
      .filter(text => noteMatchesTest(text,test.label,subject));
    const facts = uniqueGuideText([...questionFacts,...subjectFacts]).slice(0,6);
    const vocabulary = subject === 'Reading / ELA' && !/grammar|predicate|subject\s*&/.test(lower)
      ? [...new Map(array(pack.vocabulary).filter(row => row?.subject === subject && meaningfulText(row?.term))
        .map(row => [String(row.term).trim().toLowerCase(),row])).values()].slice(0,8)
      : [];
    const practice = group.slice(0,4).map(row => ({
      prompt:compactGuideText(row.prompt,160),
      answer:compactGuideText(row.answer,90),
      skill:compactGuideText(row.skill,60),
    }));
    const warnings = [];
    const fallback = state.fallback.some(row => row.index === i);
    if (fallback) warnings.push('No reviewed test-specific question bank is available yet. This sheet uses original Grade 2 skill practice and labels it clearly.');
    if (!group.length) warnings.push('No reviewed practice questions match this test yet. Use the teacher materials sent home together with the verified notes below.');
    if (subject === 'Spelling / Handwriting') {
      coverageWarnings(instant()).filter(row => row.subject === subject).forEach(row => warnings.push(row.text));
    }
    if (!facts.length) warnings.push('No reviewed test-specific facts are available yet, so this guide does not invent missing material.');
    return {
      key:testKey(test), label:compactGuideText(test.label,120), date:test.date, subject:subject || 'Test review',
      facts, vocabulary, practice, fallback, warnings:uniqueGuideText(warnings).slice(0,3),
      sourceLabel:'Current ABVM teacher notes, reviewed schoolwork, and checked practice material',
    };
  }

  function testRound({index, seed, upcoming = false} = {}) {
    const state = upcoming ? printableTestState(true) : testState();
    const single = Number.isInteger(index) && index >= 0 && index < state.tests.length;
    const groups = index === undefined ? (state.missing.length ? [] : state.groups) : single ? [state.groups[index]] : [];
    const selected = index === undefined ? state.tests : single ? [state.tests[index]] : [];
    const full = byId(groups.flat());
    const key = sourceKey + '|tests:' + selected.map(testKey).join('+') + ':' + bankKey(full);
    const chosenSeed = sessionSeed(key,'test-ready',seed);
    return {
      questions:balancedTestRound(groups,8,chosenSeed), catalog:{...catalog,sourceKey:key,questions:full},
      groups, count:unique(full).length, eligibleIds:full.map(q => q.id), sourceKey:key,
      sessionSeed:chosenSeed, title:single ? state.tests[index].label + ' practice' : 'Test practice',
      modeId:'test-ready', strict:true,
      fallback:state.fallback.filter(t => index === undefined || t.index === index),
    };
  }
  function result(ok, text) {
    message = text;
    return {ok, message, canUndo:!!completionUndo};
  }
  function completeTests() {
    const currentTests = testState().tests;
    if (!currentTests.length) return result(false,'No upcoming test is listed.');
    const before = [...completedKeys()], after = new Set(before);
    currentTests.forEach(t => after.add(testKey(t)));
    if (!write(storage,'abvm-completed-tests',[...after])) {
      return result(false,'Could not save that change. Your tests are still listed.');
    }
    completionUndo = {before};
    return result(true,(currentTests.length > 1 ? 'Tests marked finished: ' : 'Test marked finished: ') + currentTests.map(t => t.label).join(', ') + '.');
  }
  function undoTests() {
    if (!completionUndo) return result(false,'There is no test change to undo.');
    if (!write(storage,'abvm-completed-tests',completionUndo.before)) return result(false,'Could not restore the test list. Please try again.');
    completionUndo = null;
    return result(true,'Your test list has been restored.');
  }
  function restoreTest(key) {
    const test = testState().completed.find(t => t.key === key);
    if (!test) return result(false,'That test is not hidden on this device.');
    const done = completedKeys();
    done.delete(key);
    if (!write(storage,'abvm-completed-tests',[...done])) return result(false,'Could not restore that test. Please try again.');
    completionUndo = null;
    return result(true,test.label + ' restored.');
  }
  async function loadReferences() {
    if (references) return {ok:true};
    if (!referencePending) {
      referencePending = Promise.resolve().then(() => resourceLoader('religion-sources.json'))
        .then(value => {
          if (!validStudyResource('religion-sources.json',value)) throw new Error('Reference could not be validated.');
          references = value;
          return {ok:true};
        }).catch(() => ({ok:false})).finally(() => { referencePending = null; });
    }
    return referencePending;
  }
  function referenceLinks() {
    const topics = array(array(pack.subjects).find(s => s?.subject === 'Religion')?.topics);
    const chapter = Number(topics.join(' ').match(/Chapter\s+(\d+)/i)?.[1]);
    const chapters = Array.isArray(references?.chapters) ? references.chapters : Object.values(references?.chapters || {});
    const verified = chapters.find(row => row?.chapter === chapter && row.available === true && row.status === 'verified' && row.chapterMatched !== false && row.stale !== true);
    if (!verified) return [];
    // Only the verified publisher location is a reference; never interpret an
    // arbitrary URL or a different chapter as authoritative current material.
    try {
      const url = new URL(verified.url);
      if (url.protocol !== 'https:' || url.hostname !== 'isr.christourlife.com' || !new RegExp('^/col_g2_s' + chapter + '/?$').test(url.pathname)) return [];
    } catch { return []; }
    return [{subject:'Religion',chapter,url:verified.url,label:'Chapter ' + chapter + ' online review',
      publisher:references.publisher,curriculum:references.curriculum,checkedAt:verified.checkedAt}];
  }
  function coverageWarnings(time) {
    const done = completedKeys();
    const spellingTest = nextTests(allEvents.filter(t => /spelling/i.test(t.label) && !done.has(testKey(t))),time)[0];
    const spellingNotes = array(pack.subjects).find(s => /spelling/i.test(s?.subject || ''));
    const listed = spellingTest?.label.match(/short\s+([aeiou])/i)?.[1]?.toLowerCase();
    const saved = array(spellingNotes?.topics).join(' ').match(/short\s+([aeiou])/i)?.[1]?.toLowerCase();
    if (!listed || !saved || listed === saved) return [];
    return [{subject:spellingNotes.subject,text:'Upcoming test: ' + spellingTest.label + ' (' + spellingTest.date + '). These saved notes cover an earlier vowel pattern. Check the current teacher list; these notes alone do not establish test coverage.'}];
  }
  function notes(source = 'weekly', {sources} = {}) {
    const picks = selectedSources(source,sources), time = instant();
    if (!picks.some(key => key === 'weekly' || key === 'saved')) return {lessons:[],notes:[],vocabulary:[],links:[],warnings:[]};
    const day = materialDay(time), saved = picks.includes('saved'), history = saved ? day.visible : day.week;
    const sourceNotes = array(pack.subjects).flatMap(subject => [
      ...array(subject.topics).filter(meaningfulText).map(text => ({subject:subject.subject,text,kind:'topic'})),
      ...array(subject.studyNotes).filter(meaningfulText).map(text => ({subject:subject.subject,text,kind:'study-note'})),
    ]).map(note => ({...note,sourceHash:pack.sourceHash,sourceCapturedAt:pack.sourceCapturedAt}));
    return {
      lessons:saved ? day.lessons : day.dated,
      notes:[...sourceNotes,...history.notes].filter(note => meaningfulText(note?.text)),
      vocabulary:[...array(pack.vocabulary),...history.vocabulary].filter(word => meaningfulText(word?.term)),
      links:referenceLinks(), warnings:coverageWarnings(time),
    };
  }
  return {status, banks, forMode, round, tests, printableTests, upcomingTests, testGuide, testRound, completeTests, undoTests, restoreTest, notes, loadReferences};
}
