// Grade 2 original instruction. A listed classroom word licenses a practice topic,
// not a claim that the classroom teacher supplied or approved any of these meanings.
// Each entry is an editorially checked, context-limited common use of the word.
export const ORIGINAL_GRADE2_VOCABULARY = Object.freeze({
  groom: Object.freeze({meaning: 'clean and care for an animal’s coat or body', example: 'Cats groom their fur by licking it.', distractors: ['fur', 'offspring']}),
  mammal: Object.freeze({meaning: 'an animal with hair or fur whose mother feeds her young milk', example: 'A rabbit is a mammal.', distractors: ['fur', 'offspring']}),
  adult: Object.freeze({meaning: 'a fully grown person or animal', example: 'An adult rabbit is fully grown.', distractors: ['fur', 'offspring']}),
  alive: Object.freeze({meaning: 'living, not dead', example: 'A growing tree is alive.', distractors: ['covered', 'giant']}),
  covered: Object.freeze({meaning: 'put something over or on top of something else', example: 'We covered the table with a cloth.', distractors: ['alive', 'giant']}),
  fur: Object.freeze({meaning: 'the thick, soft hair on some animals', example: 'The rabbit has soft fur.', distractors: ['adult', 'offspring']}),
  giant: Object.freeze({meaning: 'very large in size', example: 'We saw a giant pumpkin at the fair.', distractors: ['alive', 'covered']}),
  offspring: Object.freeze({meaning: 'the young of a person, animal, or plant', example: 'The kittens are the cat’s offspring.', distractors: ['fur', 'adult']}),
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

// A reviewed punctuation interpretation, not a replacement of the source text.
// The current animal vocabulary line uses a period between two ordinary words.
// Exact matching avoids splitting abbreviations or guessing unknown phrases.
export function teacherVocabularyTerms(value) {
  return String(value || '').split(',').map(term=>term.trim()).filter(Boolean)
    .flatMap(term=>term.toLowerCase()==='groom. mammal'?['groom','mammal']:[term]);
}
