// Original Grade 2 teaching support for the exact current Reading Work topic.
// These are not teacher-provided questions or a school spelling list.
const question=spec=>Object.freeze({...spec,sourceMode:'CURATED_CONTEXT'});

export const READING_LONG_SHORT_O_FAMILY=Object.freeze({
  id:'reading-long-short-o',
  subject:'Reading / ELA',
  label:'Long o (o_e) and short o',
  patternSource:'long\\s+o\\s*\\(\\s*o_e\\s*\\)\\s*(?:and|&|/)\\s*short\\s+o|short\\s+o.*long\\s+o\\s*\\(\\s*o_e\\s*\\)',
  patternFlags:'i',
  standards:Object.freeze(['CCSS.RF.2.3']),
  domain:'Phonics and word recognition',
  studyNotes:Object.freeze([
    'Short o has the sound heard in hot, hop, and rock.',
    'In an o_e word, the final silent e helps o say its name, as in hop → hope and not → note.',
    'Teacher-style mnemonic: “Silent e helps o say O.” Box o_e, then read the whole word.',
    'Teacher-style supplemental practice: these explanations and original questions support the current Reading Work topic; they were not supplied by the school.',
  ]),
  sourcePriority:Object.freeze(['Reading Work','Tests']),
  featureFlag:'curriculum-family:reading-long-short-o-v1',
  rolloutStatus:'APPROVED',
  enabledByDefault:true,
  minimumSemanticVariants:8,
  requiredQuestionTypes:Object.freeze(['direct','transfer','reasoning']),
  teachCard:Object.freeze([
    'Read the word without e, then add silent e and listen for the change: hop → hope.',
    'Teacher-style supplemental practice; not teacher-provided questions.',
  ]),
  assessmentPatterns:Object.freeze(['long\\s+o\\s*\\(\\s*o_e\\s*\\).*short\\s+o']),
  baseQuestion:question({
    questionType:'direct',prompt:'Which word has the short o sound heard in hot?',
    choices:Object.freeze(['hop','hope','rope']),answer:'hop',
    explanation:'Hop has short o. Hope and rope use long o with a final silent e.',
    hint:'Say each word and listen for the vowel sound in hot.',dok:1,difficulty:2,
  }),
  supplementalQuestions:Object.freeze([
    question({
      questionType:'direct',prompt:'Which word has long o made with the o_e pattern?',
      choices:Object.freeze(['home','hot','sock']),answer:'home',
      explanation:'Home uses the o_e pattern. The final silent e helps o say its name.',
      hint:'Look for o, one consonant, and a final silent e.',dok:1,difficulty:2,
    }),
    question({
      questionType:'direct',prompt:'Which pair shows a short-o word followed by its long-o o_e partner?',
      choices:Object.freeze(['not, note','note, not','hop, hot']),answer:'not, note',
      explanation:'Not has short o. Adding silent e makes note, where o has its long sound.',
      hint:'The first word should sound like hot; the second should have silent e.',dok:1,difficulty:2,
    }),
    question({
      questionType:'transfer',prompt:'Read the sentence: “The fox ran home.” Which words show short o and long o?',
      choices:Object.freeze(['fox is short o; home is long o','home is short o; fox is long o','ran is short o; the is long o']),
      answer:'fox is short o; home is long o',
      explanation:'Fox has the short o sound. Home has long o in the o_e pattern.',
      hint:'Compare each o sound with hot and hope.',dok:2,difficulty:2,
    }),
    question({
      questionType:'transfer',prompt:'Add silent e to hop to make hope. What happens to the o sound?',
      choices:Object.freeze(['It changes from short o to long o.','It stays short o.','The word loses its o sound.']),
      answer:'It changes from short o to long o.',
      explanation:'Hop has short o. In hope, the final silent e helps o say its name.',
      hint:'Read hop, then hope, and listen for the change.',dok:2,difficulty:2,
    }),
    question({
      questionType:'transfer',prompt:'Which sorting row puts both words in the correct sound groups?',
      choices:Object.freeze(['short o: rock; long o: rode','short o: rode; long o: rock','short o: rope; long o: stop']),
      answer:'short o: rock; long o: rode',
      explanation:'Rock has short o. Rode uses the o_e pattern and has long o.',
      hint:'Read each word aloud before choosing its group.',dok:2,difficulty:2,
    }),
    question({
      questionType:'reasoning',prompt:'Mia says home has short o because o is followed by m. Which explanation corrects her?',
      choices:Object.freeze(['The final silent e makes the o long.','Every o before m is short.','The m removes the vowel sound.']),
      answer:'The final silent e makes the o long.',
      explanation:'Home follows the o_e pattern, so the final silent e helps o make its long sound.',
      hint:'Look at the whole word, including the last letter.',dok:3,difficulty:3,
    }),
    question({
      questionType:'reasoning',prompt:'Why does hope have long o while hop has short o?',
      choices:Object.freeze(['Hope has a final silent e that changes the vowel sound.','Hope has more consonant sounds than hop.','Hop begins with a different letter.']),
      answer:'Hope has a final silent e that changes the vowel sound.',
      explanation:'The final silent e creates the o_e pattern in hope, changing short o in hop to long o.',
      hint:'Compare the ending of each word.',dok:3,difficulty:3,
    }),
  ]),
});
