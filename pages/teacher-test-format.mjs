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
  religionChapterThree:Object.freeze({
    id:'religion-chapter-three-mixed-quiz',
    kind:'mixed',
    referenceCount:10,
    sections:Object.freeze([
      Object.freeze({kind:'word-bank',count:5}),
      Object.freeze({kind:'picture-select',count:1}),
      Object.freeze({kind:'true-false',count:4}),
    ]),
    columns:1,
    origin:'prior-actual-teacher-test',
  }),
  mathChapterOneB:Object.freeze({
    id:'math-chapter-one-b-post-test',
    kind:'math-structured',
    referenceCount:12,
    columns:2,
    pages:2,
    origin:'prior-actual-teacher-test',
  }),
  mathChapterTwoPost:Object.freeze({
    id:'math-chapter-two-post-test',
    kind:'math-structured',
    referenceCount:18,
    columns:2,
    pages:2,
    response:'write-number-or-short-answer',
    sections:Object.freeze([
      Object.freeze({kind:'number-words-and-place-value'}),
      Object.freeze({kind:'number-patterns-and-even-odd'}),
      Object.freeze({kind:'rounding-number-line'}),
      Object.freeze({kind:'picture-counting-and-word-problems'}),
    ]),
    origin:'prior-actual-teacher-test',
  }),
  shortVowelPhonics:Object.freeze({
    id:'phonics-short-vowel-picture-assessment',
    kind:'picture-assessment',
    referenceCount:30,
    sections:Object.freeze([
      Object.freeze({kind:'picture-three-choice',count:15}),
      Object.freeze({kind:'picture-write-word',count:15}),
    ]),
    columns:3,
    pages:2,
    origin:'prior-actual-teacher-test',
  }),
  nounCapitalization:Object.freeze({
    id:'ela-noun-capitalization-three-bubbles',
    kind:'bubble-choice',
    optionCount:3,
    referenceCount:10,
    columns:2,
    response:'fill-bubble',
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

// Teacher-marked publisher exercises are evidence of practice layout,
// not proof of the format of a future school-issued assessment.
const classroomReference = Object.freeze({
  mathChapterTwo:Object.freeze({
    id:'math-chapter-two-publisher-bubble-practice',
    kind:'bubble-choice',
    optionCount:4,
    referenceCount:16,
    columns:2,
    response:'fill-bubble',
    origin:'prior-teacher-marked-publisher-practice',
  }),
});
const normalize=value=>String(value??'').replace(/\s+/g,' ').trim().toLowerCase();
const numberBetween=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const formats=new Set(['letter-choice','word-bank','dictation','matching','written-response','mixed','math-structured','picture-assessment','bubble-choice']);

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
  out.response=value.kind==='letter-choice'?'write-letter':value.kind==='bubble-choice'?'fill-bubble':'write-word';
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
  if(subject==='religion' && /\b(?:chapter|ch\.?)\s*3\b/.test(label))
    return reference.religionChapterThree;
  if(/reading|ela|grammar/.test(subject) &&
    /\b(?:common\s+(?:and|&)\s+proper\s+nouns?|proper\s+nouns?)\b/.test(label))
    return reference.nounCapitalization;
  if((subject==='math'||/\bmath\b/.test(label)) &&
    /\b(?:chapter|ch\.?)\s*1\s*b\b/.test(label))
    return reference.mathChapterOneB;
  if((subject==='math'||/\bmath\b/.test(label)) &&
    /\b(?:chapter|ch\.?)\s*2\b/.test(label))
    return reference.mathChapterTwoPost;
  if(/\bphonics\b/.test(label) && /\bshort[- ]vowels?\b/.test(label))
    return reference.shortVowelPhonics;
  if((/spelling/.test(subject) || /spelling/.test(label))&& !/grammar/.test(label))
    return /handwriting/.test(label)
      ? {...reference.spellingDictation,id:'spelling-handwriting-two-column-dictation',columns:2}
      : reference.spellingDictation;
  return null;
}

/** Publisher/teacher-marked classwork is not categorized as an actual teacher test. */
export function classroomPracticeReferenceForGuide(guide) {
  const label=normalize(guide?.label),subject=normalize(guide?.subject);
  if((subject==='math'||/\bmath\b/.test(label)) &&
    /\b(?:chapter|ch\.?)\s*2\b/.test(label))
    return classroomReference.mathChapterTwo;
  return null;
}
const checkedChoices=(profile,practice)=>
  Array.isArray(practice) && practice.length>0 &&
  practice.every(q=>Array.isArray(q?.choices) &&
    q.choices.length===profile.optionCount &&
    q.choices.every(choice=>typeof choice==='string'&&choice.trim()) &&
    typeof q.prompt==='string'&&q.prompt.trim() &&
    typeof q.answer==='string'&&q.choices.includes(q.answer));

/** A partial, heterogeneous bank retains every verified item in its original answer form. */
export function checkedBubbleQuestionForGuide(guide,question) {
  const profile=classroomPracticeReferenceForGuide(guide) || teacherTestReferenceForGuide(guide);
  return profile?.kind==='bubble-choice' && profile.response==='fill-bubble' &&
    checkedChoices(profile,[question]) ? profile : null;
}

/** Only fully checked original items get a teacher-like bubble paper. */
export function checkedBubblePaperFormat(guide,practice) {
  const profile=classroomPracticeReferenceForGuide(guide) || teacherTestReferenceForGuide(guide);
  return profile?.kind==='bubble-choice' && profile.response==='fill-bubble' &&
    checkedChoices(profile,practice) ? profile : null;
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
    checkedChoices(profile,practice);
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
  if(profile.kind==='bubble-choice')
    return 'Teacher-format example: mark one of '+profile.optionCount+' answer bubbles in two columns. '+observed+'This is an observed format, not a guarantee about the next test.';
  if(profile.kind==='word-bank')
    return 'Teacher-format example: choose a word from a word bank and fill a blank. '+
      observed+'Use new, original prompts for practice.';
  if(profile.kind==='dictation')
    return 'Teacher-format example: write dictated words on numbered '+(profile.columns===2?'handwriting lines in two columns. ':'lines. ')+
      observed+'Bonus work was observed previously, but is not promised for a future test.';
  if(profile.kind==='mixed')
    return 'Teacher-format example: a prior religion quiz combined five word-bank responses, '+
      'one picture selection and four true/false answers. '+observed+
      'Use an original practice mix only when current lesson evidence supports it.';
  if(profile.kind==='math-structured' && profile.id==='math-chapter-two-post-test')
    return 'Teacher-format example: a prior Chapter 2 post-test used eighteen numbered question groups over two pages in two columns, with number words, place value, rounding on a number line, number patterns, visual counting and short written word problems. This is an observed format, not a prediction of the next test.';
  if(profile.kind==='math-structured')
    return 'Teacher-format example: an earlier math post-test used twelve problems on two pages, '+
      'with two columns, number lines, related facts, visual models and word problems. '+
      'Practice current skills in comparable response spaces, not copied problems.';
  if(profile.kind==='picture-assessment')
    return 'Teacher-format example: a prior short-vowel assessment had fifteen picture-to-word '+
      'three-choice items and fifteen picture-word writing entries on writing lines. '+
      'Use only source-checked, original pictures and vocabulary.';
  return 'A teacher-format sample is available. Follow its answer format only when the reviewed practice supports it.';
}

/** A clearly labeled publisher example, never presented as a teacher test. */
export function classroomPracticeFormatSummary(guide) {
  const profile=classroomPracticeReferenceForGuide(guide);
  if(!profile)return '';
  return 'Previous teacher-marked publisher practice (not a teacher-issued test): '+
    'four-option multiple-choice problems with answer bubbles in two columns. '+
    'A past exercise had '+profile.referenceCount+' questions; the next test format is unverified.';
}
