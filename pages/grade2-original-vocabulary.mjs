// Grade 2 original instruction. A listed classroom word licenses a practice topic,
// not a claim that the classroom teacher supplied or approved any of these meanings.
// Each entry is an editorially checked, context-limited common use of the word.
export const ORIGINAL_GRADE2_VOCABULARY = Object.freeze({
  checks: Object.freeze({
    meaning: 'looks at something carefully to make sure it is correct',
    example: 'Mia checks her answer before she turns in her work.',
    distractors: ['choose', 'spend'],
  }),
  choose: Object.freeze({
    meaning: 'pick one thing from two or more choices',
    example: 'You can choose which library book to read.',
    distractors: ['checks', 'spend'],
  }),
  chores: Object.freeze({
    meaning: 'small jobs we do to help at home',
    example: 'Washing dishes and putting away toys are chores.',
    distractors: ['customers', 'tools'],
  }),
  cost: Object.freeze({
    meaning: 'the amount of money needed to buy something',
    example: 'The cost of the notebook is three dollars.',
    distractors: ['jobs', 'tools'],
  }),
  customers: Object.freeze({
    meaning: 'people who buy things from a store or business',
    example: 'The customers bought bread at the bakery.',
    distractors: ['jobs', 'cost'],
  }),
  jobs: Object.freeze({
    meaning: 'tasks or work people do',
    example: 'The workers have different jobs at the grocery store.',
    distractors: ['tools', 'customers'],
  }),
  spend: Object.freeze({
    meaning: 'use money to pay for something',
    example: 'I will spend two dollars on a pencil.',
    distractors: ['choose', 'checks'],
  }),
  tools: Object.freeze({
    meaning: 'objects that help people do a task or make something',
    example: 'The gardener uses tools such as a shovel and a rake.',
    distractors: ['jobs', 'chores'],
  }),
});

export function originalGrade2Vocabulary(term) {
  const key=String(term ?? '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ORIGINAL_GRADE2_VOCABULARY,key)
    ? ORIGINAL_GRADE2_VOCABULARY[key]
    : null;
}

export function originalGrade2VocabularyMeaning(term) {
  return originalGrade2Vocabulary(term)?.meaning || '';
}
