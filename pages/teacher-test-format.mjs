/**
 * Anonymous, structural references from parent-provided teacher assessments.
 *
 * The actual papers, student's work, markings, scores and copyrighted question
 * text are NEVER put in this public module. Examples describe observed formats,
 * not a claim that the teacher will reuse the same format next time.
 */
const reference = Object.freeze({
  religionUnitOne:Object.freeze({
    id:'religion-unit-one-letter-choice',
    kind:'letter-choice',
    optionCount:3,
    referenceCount:20,
    columns:2,
    response:'write-letter',
    origin:'prior-actual-teacher-test',
  }),
  religionChapterOne:Object.freeze({
    id:'religion-chapter-one-word-bank',
    kind:'word-bank',
    referenceCount:10,
    columns:1,
    response:'write-word',
    origin:'prior-actual-teacher-test',
  }),
  spellingDictation:Object.freeze({
    id:'spelling-numbered-dictation',
    kind:'dictation',
    referenceCount:15,
    columns:1,
    response:'write-word',
    bonusObserved:true,
    origin:'prior-actual-teacher-test',
  }),
});

const normalize=value=>String(value??'').replace(/\s+/g,' ').trim().toLowerCase();
const numberBetween=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const formats=new Set(['letter-choice','word-bank','dictation','matching','written-response']);

/**
 * Future reviewed test intakes may pass a format profile on a guide.
 * Only the structural fields below are returned; no private source fields.
 */
function checkedExplicitFormat(value) {
  if(!value || typeof value!=='object' || Array.isArray(value) ||
    value.verifiedFrom!=='actual-teacher-test' || !formats.has(value.kind))
    return null;
  const out={
    id:'verified-parent-test-format',
    kind:value.kind,
    origin:'prior-actual-teacher-test',
    columns:value.columns===2?2:1,
  };
  if(numberBetween(value.optionCount,2,5))out.optionCount=value.optionCount;
  if(numberBetween(value.referenceCount,1,100))out.referenceCount=value.referenceCount;
  out.response=value.kind==='letter-choice'?'write-letter':'write-word';
  return out;
}

/** Actual past assessments govern presentation; current teacher work governs content. */
export function teacherTestReferenceForGuide(guide) {
  const explicit=checkedExplicitFormat(guide?.teacherTestFormat);
  if(explicit)return explicit;
  const label=normalize(guide?.label),subject=normalize(guide?.subject);
  if(subject==='religion' && /\b(?:unit\s*1|(?:chapter|ch\.?)\s*4)\b/.test(label))
    return reference.religionUnitOne;
  if(subject==='religion' && /\b(?:chapter|ch\.?)\s*1\b/.test(label))
    return reference.religionChapterOne;
  if((/spelling/.test(subject) || /spelling/.test(label))&& !/grammar/.test(label))
    return reference.spellingDictation;
  return null;
}

/**
 * Never invent missing source questions or change the lesson content just to
 * match an old layout. Only checked three-option items can use that layout.
 */
export function canRenderTeacherLetterChoice(guide,practice) {
  const profile=teacherTestReferenceForGuide(guide);
  return profile?.kind==='letter-choice' &&
    profile.response==='write-letter' &&
    Array.isArray(practice) && practice.length>0 &&
    practice.every(q=>Array.isArray(q?.choices) &&
      q.choices.length===profile.optionCount &&
      q.choices.every(choice=>typeof choice==='string'&&choice.trim()) &&
      typeof q.prompt==='string'&&q.prompt.trim() &&
      q.choices.includes(q.answer));
}

export function teacherFormatSummary(guide) {
  const profile=teacherTestReferenceForGuide(guide);
  if(!profile)return '';
  const observed=profile.referenceCount
    ? 'A prior example had '+profile.referenceCount+' items. '
    : '';
  if(profile.kind==='letter-choice')
    return 'Teacher-format example: write the letter for one of '+
      profile.optionCount+' choices; a prior example used '+
      profile.columns+' columns. '+observed+
      'This is an observed format, not a guarantee about the next test.';
  if(profile.kind==='word-bank')
    return 'Teacher-format example: choose a word from a word bank and fill a blank. '+
      observed+'Use new, original prompts for practice.';
  if(profile.kind==='dictation')
    return 'Teacher-format example: write dictated words on numbered lines. '+
      observed+'Bonus work was observed previously, but is not promised for a future test.';
  return 'A teacher-format sample is available. Follow its answer format only when the reviewed practice supports it.';
}
