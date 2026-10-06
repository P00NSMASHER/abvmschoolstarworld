import { SHORT_I_LONG_I_FAMILY } from './curriculum-families/short-i-long-i.mjs';

const FAMILY_REGISTRY = Object.freeze([
  Object.freeze({
    id: 'subject-predicate',
    subject: 'Reading / ELA',
    label: 'Subject and predicate',
    patternSource: 'subject\\s*(?:&|and)\\s*predicate|subject\\s*\\/\\s*predicate',
    patternFlags: 'i',
    standards: Object.freeze(['CCSS.L.2.1']),
    domain: 'Language',
    studyNotes: Object.freeze([
      'The subject tells who or what the sentence is about; the predicate tells what the subject does or is.',
    ]),
    sourcePriority: Object.freeze(['Tests', 'Reading Work']),
    featureFlag: 'curriculum-family:subject-predicate-v1',
    rolloutStatus: 'APPROVED',
    enabledByDefault: true,
    minimumSemanticVariants: 8,
    requiredQuestionTypes: Object.freeze(['direct', 'transfer', 'reasoning']),
    teachCard: Object.freeze([
      'Find who or what the sentence is about, then what that subject does or is.',
      'In “The dog barked loudly,” The dog is the subject and barked loudly is the predicate.',
    ]),
    assessmentPatterns: Object.freeze([
      'subject\\s*(?:&|and)\\s*predicate',
      'subject\\s*\\/\\s*predicate',
    ]),
    baseQuestion: Object.freeze({
      questionType: 'direct',
      prompt: 'In the sentence “The brown puppy chased the ball,” which words are the subject?',
      choices: Object.freeze(['The brown puppy', 'chased the ball', 'the ball']),
      answer: 'The brown puppy',
      explanation: 'The subject names who or what the sentence is about: the brown puppy.',
      hint: 'Find who or what is doing the action.',
      dok: 1,
      difficulty: 2,
    }),
    supplementalQuestions: Object.freeze([
      Object.freeze({
        questionType: 'transfer',
        prompt: 'In the sentence “The birds sing in the tree,” which words are the predicate?',
        choices: Object.freeze(['sing in the tree', 'The birds', 'the tree']),
        answer: 'sing in the tree',
        explanation: 'The predicate tells what the subject does: the birds sing in the tree.',
        hint: 'First find the subject, then choose the words that tell what it does.',
        dok: 2,
        difficulty: 2,
      }),
      Object.freeze({
        questionType: 'reasoning',
        prompt: 'Which explanation correctly separates the subject and predicate in “Mia opened the window”?',
        choices: Object.freeze([
          'Mia is the subject; opened the window is the predicate.',
          'Opened is the subject; Mia is the predicate.',
          'The window is the subject; Mia opened is the predicate.',
        ]),
        answer: 'Mia is the subject; opened the window is the predicate.',
        explanation: 'Mia names who the sentence is about, and opened the window tells what Mia did.',
        hint: 'The subject names who or what; the predicate tells what that subject does or is.',
        dok: 3,
        difficulty: 3,
      }),
      Object.freeze({
        questionType: 'direct',
        prompt: 'In “My little brother builds a tower,” which words are the subject?',
        choices: Object.freeze(['My little brother', 'builds a tower', 'a tower']),
        answer: 'My little brother',
        explanation: 'The subject tells who the sentence is about.',
        hint: 'Ask who is doing the action.',
        dok: 1,
        difficulty: 2,
      }),
      Object.freeze({
        questionType: 'transfer',
        prompt: 'In “The yellow bus stopped by the school,” which words are the predicate?',
        choices: Object.freeze(['stopped by the school', 'The yellow bus', 'the school']),
        answer: 'stopped by the school',
        explanation: 'The predicate tells what the yellow bus did.',
        hint: 'Find the action and the words that go with it.',
        dok: 2,
        difficulty: 2,
      }),
      Object.freeze({
        questionType: 'transfer',
        prompt: 'Which pair correctly labels the parts of “The rabbit hopped across the yard”?',
        choices: Object.freeze([
          'subject: The rabbit; predicate: hopped across the yard',
          'subject: hopped; predicate: The rabbit',
          'subject: the yard; predicate: The rabbit hopped',
        ]),
        answer: 'subject: The rabbit; predicate: hopped across the yard',
        explanation: 'The rabbit names who the sentence is about; hopped across the yard tells what it did.',
        hint: 'Split the sentence into who or what, then what that subject does.',
        dok: 2,
        difficulty: 2,
      }),
      Object.freeze({
        questionType: 'reasoning',
        prompt: 'Why is “The tall tree” the subject in “The tall tree swayed in the wind”?',
        choices: Object.freeze([
          'It names what the sentence is about.',
          'It tells what the tree did.',
          'It names where the action happened.',
        ]),
        answer: 'It names what the sentence is about.',
        explanation: 'A subject names who or what the sentence is about.',
        hint: 'Decide whether the words name the subject or tell what it does.',
        dok: 3,
        difficulty: 3,
      }),
      Object.freeze({
        questionType: 'reasoning',
        prompt: 'Which sentence is correctly split into subject and predicate?',
        choices: Object.freeze([
          'Our class | read a new book.',
          'Read a | new book our class.',
          'A new book | our class read.',
        ]),
        answer: 'Our class | read a new book.',
        explanation: 'Our class is the complete subject, and read a new book is the predicate.',
        hint: 'Keep all the subject words together, then all the words telling what the subject does.',
        dok: 3,
        difficulty: 3,
      }),
    ]),
  }),
  SHORT_I_LONG_I_FAMILY,
]);

const clone = value => structuredClone(value);
const regexFor = family => new RegExp(family.patternSource, family.patternFlags || 'i');
const featureFlagSet = value => new Set(
  value instanceof Set ? [...value].map(String) :
  Array.isArray(value) ? value.map(String) :
  value ? [String(value)] : []
);

export function curriculumFamilyRuntimeEnabled(family, { activeFeatureFlags = [] } = {}) {
  if (!family) return false;
  if (family.rolloutStatus === 'APPROVED' && family.enabledByDefault) return true;
  if (family.rolloutStatus !== 'CANDIDATE' || family.enabledByDefault) return false;
  const flag = String(family.featureFlag || '');
  return !!flag && featureFlagSet(activeFeatureFlags).has(flag);
}

export function curriculumFamilyRegistrySnapshot() {
  return FAMILY_REGISTRY.map(family => ({
    id: family.id,
    subject: family.subject,
    label: family.label,
    standards: [...family.standards],
    domain: family.domain,
    studyNotes: [...family.studyNotes],
    sourcePriority: [...family.sourcePriority],
    featureFlag: family.featureFlag,
    rolloutStatus: family.rolloutStatus,
    enabledByDefault: family.enabledByDefault,
    minimumSemanticVariants: family.minimumSemanticVariants,
    requiredQuestionTypes: [...family.requiredQuestionTypes],
    teachCard: [...family.teachCard],
    assessmentPatterns: [...family.assessmentPatterns],
  }));
}

export function registeredCurriculumFamilyRules(options = {}) {
  return FAMILY_REGISTRY
    .filter(family => curriculumFamilyRuntimeEnabled(family, options))
    .map(family => ({
      id: family.id,
      subject: family.subject,
      label: family.label,
      pattern: regexFor(family),
      standards: [...family.standards],
      domain: family.domain,
      studyNotes: [...family.studyNotes],
      question: () => clone(family.baseQuestion),
    }));
}

export function registeredSupplementalQuestionFamily(skillId, options = {}) {
  const family = FAMILY_REGISTRY.find(row => row.id === String(skillId || ''));
  if (!family || !curriculumFamilyRuntimeEnabled(family, options)) return [];
  return family.supplementalQuestions.map(clone);
}

export function registeredPrioritySkillIds(options = {}) {
  return FAMILY_REGISTRY
    .filter(family => curriculumFamilyRuntimeEnabled(family, options))
    .filter(family => family.requiredQuestionTypes.length >= 3)
    .map(family => family.id);
}

export function registeredRuntimeMetadata(skillId, options = {}) {
  const family = FAMILY_REGISTRY.find(row => row.id === String(skillId || ''));
  if (!family || !curriculumFamilyRuntimeEnabled(family, options)) return null;
  return {
    id: family.id,
    subject: family.subject,
    label: family.label,
    standards: [...family.standards],
    domain: family.domain,
    studyNotes: [...family.studyNotes],
    teachCard: [...family.teachCard],
    assessmentPatterns: [...family.assessmentPatterns],
    featureFlag: family.featureFlag,
  };
}

export function matchCurriculumFamily(subject, topic) {
  const subjectText = String(subject || '').trim().toLowerCase();
  const topicText = String(topic || '').trim();
  const family = FAMILY_REGISTRY.find(row =>
    row.subject.toLowerCase() === subjectText && regexFor(row).test(topicText)
  );
  return family ? {
    id: family.id,
    subject: family.subject,
    label: family.label,
    standards: [...family.standards],
    domain: family.domain,
    featureFlag: family.featureFlag,
    rolloutStatus: family.rolloutStatus,
    enabledByDefault: family.enabledByDefault,
    minimumSemanticVariants: family.minimumSemanticVariants,
    requiredQuestionTypes: [...family.requiredQuestionTypes],
    baseQuestion: clone(family.baseQuestion),
    supplementalQuestions: family.supplementalQuestions.map(clone),
  } : null;
}
