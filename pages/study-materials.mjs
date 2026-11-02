/** Material selection for the existing Games player. This module owns no DOM or answers. */
import {createStudyResourceLoader, validStudyResource} from './study-resources.mjs';
import {questionsForTest,religionChapterScopes} from './study-hub-core.mjs';
import {adaptivePracticeRound, practiceIdentity} from './study-experience.mjs';
import {schoolDay, studyAssessmentDay, weekBounds, nextTests, visibleArchive, weeklyArchive, balancedTestRound} from './study-model.mjs';
import {sourceStudyNotes,weeklySourceNotes,explicitlyInWeek} from './study-notes-scope.mjs';
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
let lastResourcePack = null;
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
// Keep the full verified question set, but interleave skills so a large
// generator family cannot push another current test topic to the last page.
function representativePractice(rows) {
  const buckets = new Map();
  for (const question of rows) {
    if (!buckets.has(question.skill)) buckets.set(question.skill, []);
    buckets.get(question.skill).push(question);
  }
  const ordered = [];
  for (let turn = 0; ordered.length < rows.length; turn++) {
    for (const bucket of buckets.values()) {
      if (bucket[turn]) ordered.push(bucket[turn]);
    }
  }
  return ordered;
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
  if (subject === 'Reading / ELA' && /grammar|predicate|subject\s*&|sentence types|punctuation/.test(lower)) {
    if (/subject|predicate/.test(lower)) return /\b(?:subject|predicate)\b/i.test(value);
    if (/sentence types|punctuation/.test(lower)) return /sentence type|statement|question|command|exclamation|punctuation|end mark/i.test(value);
    return /\b(?:grammar|subject|predicate|sentence type|punctuation)\b/i.test(value);
  }
  if (subject === 'Reading / ELA' && /phonics/.test(lower) && /short[ -]vowels?/.test(lower))
    return /short[ -]vowels?/i.test(value);
  if (subject === 'Math' && /subtraction|subtract|difference|minus/.test(lower))
    return /subtraction|subtract|difference|minus|take away|related addition facts to check subtraction/i.test(value);
  if (subject === 'Math' && /addition|add|sum/.test(lower))
    return /addition|add|sum|total/i.test(value) && !/subtraction-only/i.test(value);
  if (subject === 'Spelling / Handwriting') {
    const focus = lower.match(/short\s+([aeiou])/i)?.[1]?.toLowerCase();
    const mentioned = [...value.matchAll(/\b(?:short|long)\s+([aeiou])\b/gi)].map(match=>match[1].toLowerCase());
    if (focus && mentioned.length && !mentioned.includes(focus)) return false;
    return /spell|handwriting|phonics|vowel|short|long|blend|word|letter/i.test(value);
  }
  if (subject === 'Religion') {
    const chapter = lower.match(/\b(?:chapter|ch\.?)\s*([1-9]\d*)\b/i)?.[1];
    // A named chapter's notes must begin with its own chapter header.
    return chapter ? new RegExp('^\\s*Chapter\\s+' + chapter + '\\s*:','i').test(value) : true;
  }
  return true;
}

function polishedReligionFact(value) {
  let text = compactGuideText(value,320)
    .replace(/\borignial\b|\boirginal\b/gi,'original')
    .replace(/\btendancy\b/gi,'tendency')
    .replace(/\brecieve\b/gi,'receive')
    .replace(/\btht\b/gi,'that')
    .replace(/\bgod\b/gi,'God')
    .replace(/\s*\/\s*/g,' and ')
    .replace(/\s*;\s*/g,'; ')
    .trim();
  if (/^Church members\s*\/|^Church members and Christians/i.test(value))
    text = text.replace(/^Church members and Christians/i,'Church members (Christians)');
  if (/^Pope Leo\s*;\s*Bishop Schlert/i.test(text))
    return 'Church leaders named in class: Pope Leo and Bishop Schlert.';
  if (/^Steps to Baptism:/i.test(text)) {
    return 'Steps to Baptism: the priest welcomes the person; parents and godparents make promises; the Bible is read; water is poured; a white garment is given; a candle is lit.';
  }
  text=text.charAt(0).toUpperCase()+text.slice(1);
  return /[.!?]$/.test(text) ? text : text + '.';
}

function religionChapterFacts(group,test,pack) {
  const chapter=String(test?.label||'').match(/\b(?:chapter|ch\.?)\s*([1-9]\d*)\b/i)?.[1];
  if(!chapter)return [];
  const exact=new RegExp('^\\s*Chapter\\s+'+chapter+'\\s*:','i');
  const skillRows=[...array(pack?.contentPipeline?.skills),...array(pack?.recentReviewPipeline?.skills)];
  const lines=[...new Set([...group,...skillRows]
    .flatMap(row=>array(row?.sourceLineage?.matchedEvidence))
    .filter(row=>meaningfulText(row)&&exact.test(row)).map(row=>row.trim()))];
  const scoped=array(pack?.testGuideFacts?.religionChapters?.[chapter]);
  const facts=[...scoped,...lines.flatMap(line=>line.split(/\s*\*\s*/).slice(1))]
    .map(polishedReligionFact).filter(Boolean);
  const hasDetailedRite=facts.some(row=>/^Steps to Baptism:/i.test(row));
  return uniqueGuideText(facts.filter(row=>!(hasDetailedRite&&/^The Rite \(steps\) of Baptism\.?$/i.test(row))));
}

function readableSkillLabel(skill,questions,skillById) {
  const published=compactGuideText(skillById.get(skill)?.label,120);
  if(published)return published;
  const source=questions.map(row=>compactGuideText(row.sourceFact,120))
    .find(row=>/^Verified Grade 2 skill:\s*/i.test(row));
  if(source)return source.replace(/^Verified Grade 2 skill:\s*/i,'');
  return String(skill||'Test topic').replace(/^(?:religion|math|reading|grammar|spelling)-/,'')
    .split('-').filter(Boolean).map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' ')||'Test topic';
}

function guideReviewTopics(group,practiceRows,pack) {
  const skillRows=[...array(pack.contentPipeline?.skills),...array(pack.recentReviewPipeline?.skills)];
  const skillById=new Map(skillRows.filter(row=>meaningfulText(row?.id)).map(row=>[row.id,row]));
  const skills=[];
  for(const row of group)for(const skill of [row.skill,...array(row.assessedSkillIds)])
    if(meaningfulText(skill)&&!skills.includes(skill))skills.push(skill);
  return skills.map(skill=>{
    const matching=practiceRows.filter(row=>row.skill===skill||array(row.assessedSkillIds).includes(skill));
    const metadata=skillById.get(skill);
    const summary=uniqueGuideText([
      ...array(metadata?.studyNotes),
      ...matching.map(row=>row.explanation),
      ...matching.map(row=>row.answer),
    ]).find(meaningfulText)||'';
    const checks=matching.filter(row=>meaningfulText(row?.prompt)&&meaningfulText(row?.answer)).map(row=>({
      prompt:compactGuideText(row.prompt,320),answer:compactGuideText(row.answer,180),
    }));
    return {
      id:skill,
      label:readableSkillLabel(skill,matching,skillById),
      summary:compactGuideText(summary,320),
      questionCount:matching.length,
      check:checks[0]||null,
      checks,
    };
  });
}

/** Failures stay retryable and cannot prevent the current Games from opening. */
export async function loadStudyMaterials({resourceLoader = sharedResource, refreshResources = false, ...options} = {}) {
  // Independently published schoolwork and archives must never be stuck in
  // a successful prior session cache after a new pack or an explicit retry.
  if (resourceLoader === sharedResource && (refreshResources || options.pack !== lastResourcePack)) {
    resourceLoader.invalidate();
    lastResourcePack = options.pack;
  }
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
  const repair=engine?.correctOriginalQuestion||((q)=>q);
  archive={...archive,questions:array(archive.questions).map(repair)};
  schoolwork={...schoolwork,lessons:array(schoolwork.lessons).map(lesson=>({...lesson,questions:array(lesson.questions).map(repair)}))};
  // The engine deliberately omits audit lineage from questions. Rejoin only
  // the compact, reviewed chapter numbers by stable current-material IDs.
  const scopesById=new Map(array(pack?.contentPipeline?.questions)
    .filter(row=>row?.subject==='Religion'&&typeof row.id==='string')
    .map(row=>[row.id,religionChapterScopes(row)]));
  const canonical = byId(array(catalog.questions)).map(q=>
    q.tier==='material'&&scopesById.has(q.id)
      ? {...q,sourceChapters:scopesById.get(q.id)}
      : q);
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
    return array(schoolwork.lessons).filter(lesson =>
      (!lesson.weekOf || lesson.weekOf <= today) && (!lesson.studiedOn || lesson.studiedOn <= today));
  }
  function datedLessons(time) {
    const {start,end} = weekBounds(time);
    return allLessons(time).filter(lesson =>
      lesson.weekOf === start || (lesson.studiedOn && lesson.studiedOn >= start && lesson.studiedOn <= end));
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
        // A second Math round must not recycle the first eight current items
        // while unused source-backed saved work or original fallback exists.
        // This local history is source-key scoped and never changes a question's
        // original tier, evidence, answer or published curriculum.
        const rotationKey = 'abvm-hub-weekly-rotation:v1';
        const savedRotation = read(storage,rotationKey,{});
        const previous = savedRotation?.sourceKey === scope.sourceKey
          ? array(savedRotation.recent).filter(value => typeof value === 'string')
          : [];
        const recent = new Set(previous);
        // Use every eligible, unshown item across the ordered source stages
        // before any earlier item is repeated. A second pass is bounded and
        // permits repetition only when the source-backed bank is exhausted.
        for (const freshOnly of [true,false]) {
          for (const [stage,group] of scope.groups.entries()) {
            if (questions.length >= 8) break;
            const available = group.filter(q => {
              const identity = practiceIdentity(q);
              return !seen.has(identity) && (!freshOnly || !recent.has(identity));
            });
            if (!available.length) continue;
            const originals = new Map(available.map(q => [q.id,q]));
            // A selection-only copy admits older reviewed tierless work
            // without relabeling the original saved source or answer.
            const selectionCatalog = {...scope.catalog,questions:available.map(q => q.tier ? q : {...q,tier:'material'})};
            const chosen = engine?.selectQuestions
              ? engine.selectQuestions(selectionCatalog,{subjects:mode.subjects, preferredSkills:mode.preferredSkills || [], count:8-questions.length, seed:chosenSeed+'|stage:'+stage+'|'+freshOnly, skillStats:history})
              : adaptive([available],chosenSeed+'|stage:'+stage,history).slice(0,8-questions.length);
            for (const row of chosen) {
              const q = originals.get(row.id);
              if (q && !seen.has(practiceIdentity(q))) { seen.add(practiceIdentity(q)); questions.push(q); }
            }
          }
          if (questions.length >= 8) break;
        }
        if (questions.length) write(storage,rotationKey,{
          sourceKey:scope.sourceKey,
          recent:[...new Set([...previous,...questions.map(practiceIdentity)])].slice(-64),
        });
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
  function currentTestQuestions(test,time) {
    const day = materialDay(time), testWeek = weekBounds(test.date), thisWeek = weekBounds(time);
    // Explicitly match each future test's school week. An undated or older
    // worksheet is saved learning, not proof of this test's current curriculum.
    const matchedLessons = day.lessons.filter(lesson =>
      lesson.weekOf === testWeek.start ||
      (lesson.studiedOn && lesson.studiedOn >= testWeek.start && lesson.studiedOn <= testWeek.end));
    const recent = testWeek.start === thisWeek.start ? day.week.questions : [];
    return questionsForTest(test,unique([
      ...current,...recent,...matchedLessons.flatMap(lesson => array(lesson.questions)),
    ]));
  }
  function testState() {
    const time = instant(), done = completedKeys();
    const tests = nextTests(allEvents.filter(t => !done.has(testKey(t))),time);
    const primary = tests.map(t => currentTestQuestions(t,time));
    const groups = primary;
    const entries = tests.map((t,index) => ({...t, key:testKey(t), index, count:groups[index].length, fallback:false}));
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
    const time = instant(), done = completedKeys(), today = studyAssessmentDay(time);
    const instantMs = new Date(time).getTime(), seen = new Set();
    const tests = allEvents
      .filter(t => includeAssessments || String(t.kind || '').toLowerCase() !== 'assessment')
      .filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.date || '') && t.date >= today)
      .filter(t => !done.has(testKey(t)))
      .filter(t => !t.endsAt || !Number.isFinite(Date.parse(t.endsAt)) || Date.parse(t.endsAt) > instantMs)
      .sort((a,b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))
      .filter(t => { const key=testKey(t); if (seen.has(key)) return false; seen.add(key); return true; });
    const primary = tests.map(t => currentTestQuestions(t,time));
    const groups = primary;
    const entries = tests.map((t,index) => ({
      ...t, key:testKey(t), index, count:groups[index].length,
      fallback:false,
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
  function testGuide(index, {upcoming = false} = {}) {
    const time = instant();
    const state = printableTestState(upcoming), i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= state.tests.length) return null;
    const test = state.tests[i], group = unique(state.groups[i] || []);
    const subject = subjectForTest(test,group);
    const lower = String(test.label || '').toLowerCase();
    const sourceSubjects = array(pack.subjects).filter(row => row?.subject === subject);
    const practiceRows = representativePractice(group);
    const questionFacts = practiceRows.flatMap(row => [row.sourceFact === row.skill ? null : row.sourceFact,row.explanation]).filter(meaningfulText);
    const subjectFacts = sourceSubjects.flatMap(row => [...array(row.topics),...array(row.studyNotes)])
      .filter(text => noteMatchesTest(text,test.label,subject));
    // Only a photo-confirmed week-matched list can outrank general vowel examples.
    // Do not infer a daily assignment date from a parent's weekly photos.
    const verifiedWeekNotes = subject === 'Spelling / Handwriting'
      ? materialDay(time).lessons
        .filter(lesson => lesson.subject === subject && lesson.weekOf === weekBounds(test.date).start)
        .flatMap(lesson => array(lesson.notes))
        .filter(note => /^(?:Photo-confirmed practice words|Verified spelling words|Teacher spelling words|Spelling words|Short i:|Long a:)/i.test(note))
      : [];
    // Keep every source-matched fact in a printable guide; page layout owns pagination.
    const teacherFacts = subject === 'Religion' ? religionChapterFacts(group,test,pack) : [];
    const reviewTopics = guideReviewTopics(group,practiceRows,pack);
    const vocabulary = subject === 'Reading / ELA' && !/grammar|predicate|subject\s*&|phonics/.test(lower)
      ? [...new Map(array(pack.vocabulary).filter(row => row?.subject === subject && meaningfulText(row?.term))
        .map(row => [String(row.term).trim().toLowerCase(),row])).values()].slice(0,8)
      : [];
    // A new teacher-published spelling list can replace old photo lists only if
    // the pack identifies the same school week as this specific test.
    const announcedWeek = String(pack.spellingListProvenance?.weekLabel || pack.teacherPostingWeekLabel || pack.weekLabel || '').match(/week of\s+([a-z]+\s+\d{1,2},?\s+\d{4})/i);
    const teacherWeek = announcedWeek && Number.isFinite(Date.parse(announcedWeek[1] + ' 12:00 GMT'))
      ? new Date(Date.parse(announcedWeek[1] + ' 12:00 GMT')).toISOString().slice(0,10) : '';
    // General guide facts must obey the same source-week gate as the
    // dictation list. Otherwise an old undated teacher list can leak into
    // a newly dated guide even when guide.spellingWords is correctly empty.
    const testWeekMatchesSpellingList = teacherWeek === weekBounds(test.date).start;
    const isTeacherWordList = text =>
      /^(?:Weekly spelling words|Spelling words|Teacher spelling words|Teacher-posted spelling words(?: \(page undated\))?|Verified spelling words|Words for spelling test)\s*:/i.test(text);
    const facts = uniqueGuideText([...verifiedWeekNotes,...questionFacts,
      ...subjectFacts.filter(text => subject !== 'Spelling / Handwriting' || testWeekMatchesSpellingList || !isTeacherWordList(text)),
    ]);
    const teacherLists = subject === 'Spelling / Handwriting' && teacherWeek === weekBounds(test.date).start
      ? sourceSubjects.flatMap(row => [...array(row.studyNotes), ...array(row.topics)])
        .filter(note => /^(?:Weekly spelling words|Spelling words|Teacher spelling words|Teacher-posted spelling words(?: \(page undated\))?|Verified spelling words|Words for spelling test)\s*:/i.test(note))
      : [];
    const wordNote = [...teacherLists,...verifiedWeekNotes].find(note =>
      /^(?:Photo-confirmed practice words in the recorded order|Weekly spelling words|Spelling words|Teacher spelling words|Teacher-posted spelling words(?: \(page undated\))?|Verified spelling words|Words for spelling test)\s*:/i.test(note));
    const spellingWords = wordNote
      ? [...new Set(wordNote.slice(wordNote.indexOf(':') + 1).split(',')
        .map(word => word.replace(/[.\s]+$/,'').trim()).filter(word => /^[a-z][a-z'-]*$/i.test(word)))].slice(0,30)
      : [];
    // Print the actual checked choices, but never mix in private responses,
    // teacher markings or answers on the student's test page.
    // Preserve the complete verified question set for both printable resources.
    // This presentation-only expansion does not change study rounds or refresh.
    const practice = practiceRows.map(row => ({
      prompt:compactGuideText(row.prompt,320),
      answer:compactGuideText(row.answer,140),
      choices:array(row.choices).map(choice => compactGuideText(choice,160)),
      skill:compactGuideText(row.skill,60),
      questionType:compactGuideText(row.questionType,40),
      explanation:compactGuideText(row.explanation,240),
      hint:compactGuideText(row.hint,160),
    }));
    const availableSkills = [...new Set(group.flatMap(row=>[row.skill,...array(row.assessedSkillIds)]).filter(meaningfulText))];
    const representedSkills = [...new Set(practiceRows.map(row => row.skill))];
    const missingSkills = availableSkills.filter(skill => !representedSkills.includes(skill));
    const guideSkills = reviewTopics.map(row=>row.id);
    const missingGuideSkills = availableSkills.filter(skill=>!guideSkills.includes(skill));
    const warnings = [];
    if (missingSkills.length) warnings.push('Some current verified skills are missing from this paper. Check the linked teacher page and use in-app practice.');
    if (pack.sourceCheckedAt && schoolDay(pack.sourceCheckedAt) !== schoolDay(time)) {
      warnings.push('Teacher pages were last checked on '+schoolDay(pack.sourceCheckedAt)+'. Current school topics may have changed; check the linked teacher page for updates.');
    }
    if(subject==='Spelling / Handwriting' && /\bshort\s*\)/i.test(test.label)) {
      warnings.push('The teacher test label does not name the short vowel. Practice here covers only named sounds; no missing spelling words are guessed.');
    }
    const fallback = state.fallback.some(row => row.index === i);
    const hasCuratedSupplement = practiceRows.some(row =>
      row?.sourceMode === 'CURATED_CONTEXT' || row?.supportType === 'independent-publisher-support');
    if (fallback) warnings.push('This practice requires current, matching class material. Earlier Grade 2 topics are not substituted.');
    if (!group.length) warnings.push('No current, matching test questions are available. Review the announced classroom material; unrelated older questions are not substituted.');
    if (subject === 'Spelling / Handwriting') {
      coverageWarnings(instant()).filter(row => row.subject === subject).forEach(row => warnings.push(row.text));
      if (!spellingWords.length) warnings.push('No verified word list matches this test week. Older weeks\' spelling words are not substituted.');
    }
    if (!facts.length) warnings.push('No reviewed test-specific facts are available yet, so this guide does not invent missing material.');
    return {
      key:testKey(test), label:compactGuideText(test.label,120), date:test.date, subject:subject || 'Test review',
      facts, teacherFacts, reviewTopics, vocabulary, practice, spellingWords, fallback, warnings:uniqueGuideText(warnings).slice(0,3),
      sourceHash:pack.sourceHash || null, sourceCheckedAt:pack.sourceCheckedAt || null,
      coverage:{availableSkills,representedSkills,missingSkills,guideSkills,missingGuideSkills},
      sourceLabel:teacherLists.length
        ? (teacherLists.some(note => /page undated/i.test(note))
          ? 'Teacher spelling words verified this week (teacher page undated); original home practice'
          : 'Current school-week teacher spelling words with parent-created practice')
        : verifiedWeekNotes.length
          ? 'Teacher-announced topic with family photo-confirmed homework words; practice is not an official test'
          : hasCuratedSupplement
            ? 'Current published ABVM topic with teacher-style supplemental practice; not school-issued questions'
            : 'Current published ABVM topics and checked original practice',
    };
  }

  function testScope(state,index) {
    const single = Number.isInteger(index) && index >= 0 && index < state.tests.length;
    const groups = index === undefined ? (state.missing.length ? [] : state.groups) : single ? [state.groups[index]] : [];
    const selected = index === undefined ? state.tests : single ? [state.tests[index]] : [];
    const full = byId(groups.flat());
    const key = sourceKey + '|tests:' + selected.map(testKey).join('+') + ':' + bankKey(full);
    return {single,groups,selected,full,key};
  }
  function testPreview(index) {
    const state = printableTestState(true), scope = testScope(state,index);
    if (!scope.single) return null;
    const labels = new Map([...array(pack.contentPipeline?.skills), ...array(pack.recentReviewPipeline?.skills)]
      .filter(row => meaningfulText(row?.id) && meaningfulText(row?.label)).map(row => [row.id,row.label.trim()]));
    const topics = [...new Set(scope.full.flatMap(row => [row.skill,...array(row.assessedSkillIds)]).map(id => labels.get(id)).filter(meaningfulText))].slice(0,2);
    const total = Math.min(8,unique(scope.full).length);
    const saved = read(storage,'abvm-study-games:'+scope.key+':test-ready',null);
    const plays = Number(saved?.plays), best = Number(saved?.best);
    const recorded = total > 0 && Number.isInteger(plays) && plays > 0 && Number.isInteger(best) && best >= 0 && best <= total;
    return {sourceKey:scope.key,topics,total,practice:recorded ? {plays,best,label:'Best practice '+best+' / '+total} : {plays:0,best:null,label:'First practice'}};
  }
  function testRound({index, seed, upcoming = false} = {}) {
    const state = upcoming ? printableTestState(true) : testState();
    const {single,groups,full,key} = testScope(state,index);
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
    const day = materialDay(time), saved = picks.includes('saved'), history = day.visible;
    const sourceNotes = saved ? sourceStudyNotes(pack) : weeklySourceNotes(pack,allEvents,time,test=>currentTestQuestions(test,time));
    const notes=[...sourceNotes,...history.notes.filter(note=>saved||explicitlyInWeek(note,time))].filter(note => meaningfulText(note?.text));
    // Reuse the same independently sourced, chapter-scoped facts as print guides.
    // Never assign unscoped notes to a chapter by position or a keyword guess.
    const explanations=[...new Map(notes.filter(note=>note.subject==='Religion'&&note.kind==='topic').map(note=>[note.text,note])).values()]
      .flatMap(note=>{
        const chapter=note.text.match(/^\s*Chapter\s+([1-9]\d*)\s*:/i)?.[1];
        const paragraphs=chapter?religionChapterFacts([],{label:'Religion Chapter '+chapter},pack):[];
        return paragraphs.length?[{subject:'Religion',topic:note.text,title:'Chapter '+chapter,paragraphs,label:'Class review'}]:[];
      });
    return {
      lessons:saved ? day.lessons : day.lessons.filter(lesson=>explicitlyInWeek(lesson,time)),
      explanations,
      notes,
      vocabulary:[...array(pack.vocabulary),...history.vocabulary].filter(word => meaningfulText(word?.term)&&(saved||explicitlyInWeek(word,time))),
      links:referenceLinks().filter(link=>saved||notes.some(note=>note.subject==='Religion'&&note.kind==='topic'&&new RegExp('^\\s*Chapter\\s+'+link.chapter+'\\s*:','i').test(note.text))), warnings:coverageWarnings(time),
    };
  }
  return {status, banks, forMode, round, tests, printableTests, upcomingTests, testGuide, testPreview, testRound, completeTests, undoTests, restoreTest, notes, loadReferences};
}
