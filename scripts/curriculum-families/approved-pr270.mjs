import askAnswer from '../../curriculum-candidates/curriculum-reading-ela-ask-answer-questions-b08b218ff1.json' with { type: 'json' };
import longI from '../../curriculum-candidates/curriculum-reading-ela-long-i-i-e-and-short-i-08bac3c7d8.json' with { type: 'json' };
import mainIdea from '../../curriculum-candidates/curriculum-reading-ela-main-idea-details-0a409e562c.json' with { type: 'json' };
import possessives from '../../curriculum-candidates/curriculum-reading-ela-possessives-s-de6f518f2a.json' with { type: 'json' };

const freezeQuestion = question => Object.freeze({
  questionType: question.questionType,
  prompt: question.prompt,
  choices: Object.freeze([...question.choices]),
  answer: question.answer,
  explanation: question.explanation,
  hint: question.hint,
  dok: question.dok,
  difficulty: question.difficulty,
});

function approvedFamily(candidate, metadata) {
  const questions = candidate.proposedQuestions.map(freezeQuestion);
  return Object.freeze({
    id: candidate.familyId,
    subject: candidate.subject,
    label: candidate.topic,
    patternSource: metadata.patternSource,
    patternFlags: 'i',
    standards: Object.freeze(metadata.standards),
    domain: metadata.domain,
    studyNotes: Object.freeze(metadata.studyNotes),
    sourcePriority: Object.freeze(['Reading Work']),
    featureFlag: candidate.featureFlag.replace(/-candidate$/, '-v1'),
    rolloutStatus: 'APPROVED',
    enabledByDefault: true,
    minimumSemanticVariants: candidate.minimumSemanticVariants,
    requiredQuestionTypes: Object.freeze([...candidate.requiredQuestionTypes]),
    teachCard: Object.freeze(metadata.teachCard),
    assessmentPatterns: Object.freeze(metadata.assessmentPatterns),
    baseQuestion: questions[0],
    supplementalQuestions: Object.freeze(questions.slice(1)),
    approvedContentFingerprint: '2d173ac9d3f8761a48a13ac22df86460d522744fc572f95b76836ec2922ef4f0',
  });
}

export const APPROVED_PR270_FAMILIES = Object.freeze([
  approvedFamily(askAnswer, {
    patternSource: 'ask\\s*(?:&|and)\\s*answer\\s+questions?',
    standards: ['CCSS.RL.2.1', 'CCSS.RI.2.1'],
    domain: 'Comprehension / constructing meaning',
    studyNotes: ['Ask and answer who, what, where, when, why, and how questions using details from the text.'],
    teachCard: ['Read the whole passage, name what the question asks, and point to the detail that proves the answer.'],
    assessmentPatterns: ['ask\\s*(?:&|and)\\s*answer', 'who|what|where|when|why|how'],
  }),
  approvedFamily(longI, {
    patternSource: 'long\\s+i\\s*\\(i[_-]?e\\)\\s*(?:and|&)\\s*short\\s+i',
    standards: ['CCSS.RF.2.3'],
    domain: 'Foundational reading',
    studyNotes: ['Compare short i with long i made by the silent-e i_e pattern.'],
    teachCard: ['Short i sounds like sit. In an i_e word such as kite, silent e helps i say its name.'],
    assessmentPatterns: ['long\\s+i', 'short\\s+i', 'i[_-]?e', 'silent\\s+e'],
  }),
  approvedFamily(mainIdea, {
    patternSource: 'main\\s+idea\\s*(?:/|and|&)\\s*details?',
    standards: ['CCSS.RI.2.2', 'CCSS.RL.2.2'],
    domain: 'Comprehension / constructing meaning',
    studyNotes: ['The main idea tells what the whole passage is mostly about; details explain or support it.'],
    teachCard: ['Choose the idea broad enough to cover the whole passage, then check that the important details support it.'],
    assessmentPatterns: ['main\\s+idea', 'details?', 'mostly\\s+about'],
  }),
  approvedFamily(possessives, {
    patternSource: "possessives?\\s*\\(['’]?s\\)",
    standards: ['CCSS.L.2.2.c'],
    domain: 'Language',
    studyNotes: ["A singular possessive noun uses 's to show that one person, animal, place, or thing owns something."],
    teachCard: ["Look for ownership. Add 's to a singular noun when something belongs to it."],
    assessmentPatterns: ["possessive", "ownership", "['’]s"],
  }),
]);
