// Original Grade 2 practice for verified current school topics only.
// These are not teacher-authored questions, test answers, or spelling lists.
export const SINGULAR_PLURAL_NOUNS_FAMILY=Object.freeze({
  "id": "singular-plural-nouns",
  "subject": "Reading / ELA",
  "label": "Singular and plural nouns",
  "patternSource": "\\bsingular\\s*(?:&|and|/)\\s*plural\\s+nouns?\\b|\\bplural\\s+nouns?\\b",
  "patternFlags": "i",
  "standards": [
    "CCSS.L.2.1.b"
  ],
  "domain": "Language",
  "studyNotes": [
    "A singular noun names one person, place, animal, or thing. A plural noun names more than one.",
    "Most nouns add -s to become plural; nouns ending in sounds such as s, x, and ch often add -es.",
    "For a consonant followed by y, many plural nouns change y to -ies, as in baby → babies.",
    "These explanations and practice questions are original Grade 2 teaching, not teacher-provided test questions."
  ],
  "sourcePriority": [
    "Reading Work",
    "Tests"
  ],
  "featureFlag": "curriculum-family:singular-plural-nouns-v1",
  "rolloutStatus": "CANDIDATE",
  "enabledByDefault": false,
  "strictSourceReviewRequired": true,
  "minimumSemanticVariants": 8,
  "requiredQuestionTypes": [
    "direct",
    "transfer",
    "reasoning"
  ],
  "teachCard": [
    "First ask if the noun names one or more than one.",
    "Read the whole sentence and choose the plural ending that makes sense."
  ],
  "assessmentPatterns": [
    "singular\\s*(?:&|and)\\s*plural\\s+nouns?",
    "plural\\s+nouns?"
  ],
  "baseQuestion": {
    "questionType": "direct",
    "prompt": "In “The kitten naps,” which word is a singular noun?",
    "choices": [
      "kitten",
      "naps",
      "kittens"
    ],
    "answer": "kitten",
    "explanation": "Kitten names just one animal; kittens would name more than one.",
    "hint": "Find the word that names one animal.",
    "dok": 1,
    "difficulty": 2
  },
  "supplementalQuestions": [
    {
      "questionType": "direct",
      "prompt": "Which word correctly means more than one drum?",
      "choices": [
        "drums",
        "drum",
        "drum's"
      ],
      "answer": "drums",
      "explanation": "Drums is the plural form of drum because it names more than one.",
      "hint": "Look for the form that names several objects.",
      "dok": 1,
      "difficulty": 2
    },
    {
      "questionType": "direct",
      "prompt": "Which pair correctly names one book and then several books?",
      "choices": [
        "book → books",
        "books → book",
        "book → bookes"
      ],
      "answer": "book → books",
      "explanation": "Adding -s to book makes the regular plural books.",
      "hint": "The second word should name more than one.",
      "dok": 1,
      "difficulty": 2
    },
    {
      "questionType": "transfer",
      "prompt": "A story has one fox and later three ___. Which noun completes the sentence?",
      "choices": [
        "foxes",
        "fox",
        "foxs"
      ],
      "answer": "foxes",
      "explanation": "Fox ends in x, so we add -es to make the plural foxes.",
      "hint": "Listen to how the plural sounds and choose its usual ending.",
      "dok": 2,
      "difficulty": 2
    },
    {
      "questionType": "transfer",
      "prompt": "In “The girls played outside,” which word is a plural noun?",
      "choices": [
        "girls",
        "played",
        "outside"
      ],
      "answer": "girls",
      "explanation": "Girls is a plural noun because it names more than one girl.",
      "hint": "Find the word that names people instead of an action or place.",
      "dok": 2,
      "difficulty": 2
    },
    {
      "questionType": "transfer",
      "prompt": "Which sentence correctly talks about two babies?",
      "choices": [
        "Two babies laugh.",
        "Two babys laugh.",
        "Two baby laugh."
      ],
      "answer": "Two babies laugh.",
      "explanation": "Baby changes its consonant-plus-y ending to -ies when plural.",
      "hint": "Look carefully at the ending of the noun after two.",
      "dok": 2,
      "difficulty": 2
    },
    {
      "questionType": "reasoning",
      "prompt": "Why does the plural of bus use -es instead of only -s?",
      "choices": [
        "Bus ends in s, so we add -es.",
        "Every noun must add -es.",
        "A plural never uses s."
      ],
      "answer": "Bus ends in s, so we add -es.",
      "explanation": "Bus becomes buses because words ending in s often add -es to form plurals.",
      "hint": "Consider the last letter of the singular word.",
      "dok": 3,
      "difficulty": 3
    },
    {
      "questionType": "reasoning",
      "prompt": "Why is “cats” plural while “cat” is singular?",
      "choices": [
        "Cats name more than one cat.",
        "Cats name only one cat.",
        "Cats tell what an animal does."
      ],
      "answer": "Cats name more than one cat.",
      "explanation": "The added -s makes cats refer to more than one animal.",
      "hint": "Ask how many animals each noun names.",
      "dok": 3,
      "difficulty": 3
    }
  ]
});
export const THREE_LETTER_BLENDS_FAMILY=Object.freeze({
  "id": "three-letter-blends",
  "subject": "Spelling / Handwriting",
  "label": "Three-letter consonant blends",
  "patternSource": "\\b3\\s*[- ]?\\s*letter\\s+blends?\\b|\\bthree\\s*[- ]?\\s*letter\\s+blends?\\b",
  "patternFlags": "i",
  "standards": [
    "CCSS.RF.2.3"
  ],
  "domain": "Foundational reading and phonics",
  "studyNotes": [
    "Some words start with three consonants whose individual sounds can still be heard, such as str in street, spl in splash, and spr in spring.",
    "A blend keeps the consonant sounds together. A digraph, such as sh in ship, makes one new sound instead.",
    "Tap the first three consonant sounds separately, then blend them smoothly into the whole word.",
    "These examples and practice questions are original Grade 2 teaching, not a teacher spelling list or copied test."
  ],
  "sourcePriority": [
    "Tests",
    "Reading Work"
  ],
  "featureFlag": "curriculum-family:three-letter-blends-v1",
  "rolloutStatus": "CANDIDATE",
  "enabledByDefault": false,
  "strictSourceReviewRequired": true,
  "minimumSemanticVariants": 8,
  "requiredQuestionTypes": [
    "direct",
    "transfer",
    "reasoning"
  ],
  "teachCard": [
    "Listen for three consonant sounds before the first vowel.",
    "Compare a three-letter blend with a two-letter blend and a one-sound digraph."
  ],
  "assessmentPatterns": [
    "3\\s*[- ]?\\s*letter\\s+blends?",
    "three\\s*[- ]?\\s*letter\\s+blends?"
  ],
  "baseQuestion": {
    "questionType": "direct",
    "prompt": "Which word begins with a three-letter consonant blend?",
    "choices": [
      "street",
      "ship",
      "tree"
    ],
    "answer": "street",
    "explanation": "Street begins with str, which combines three consonant sounds.",
    "hint": "Listen to how many consonant sounds come before the first vowel.",
    "dok": 1,
    "difficulty": 2
  },
  "supplementalQuestions": [
    {
      "questionType": "direct",
      "prompt": "Which three letters begin the word splash?",
      "choices": [
        "spl",
        "sp",
        "sh"
      ],
      "answer": "spl",
      "explanation": "Splash begins with the blend spl: the s, p, and l sounds can be heard.",
      "hint": "Say the word slowly and stop just before the first vowel.",
      "dok": 1,
      "difficulty": 2
    },
    {
      "questionType": "direct",
      "prompt": "Which word begins with three consonant sounds blended together?",
      "choices": [
        "sprint",
        "snake",
        "chime"
      ],
      "answer": "sprint",
      "explanation": "Sprint begins with spr; snake begins with sn and chime begins with a digraph.",
      "hint": "Count the consonant sounds before the vowel.",
      "dok": 1,
      "difficulty": 2
    },
    {
      "questionType": "transfer",
      "prompt": "Read “The strong wind blew.” Which word starts with a three-letter blend?",
      "choices": [
        "strong",
        "wind",
        "blew"
      ],
      "answer": "strong",
      "explanation": "Strong begins with str. The other words do not start with three-consonant blends.",
      "hint": "Check the letters and sounds at the start of each word.",
      "dok": 2,
      "difficulty": 2
    },
    {
      "questionType": "transfer",
      "prompt": "Which of these words starts with a three-consonant blend?",
      "choices": [
        "scrub",
        "slip",
        "clap"
      ],
      "answer": "scrub",
      "explanation": "Scrub begins with scr, while slip and clap start with two-consonant blends.",
      "hint": "Listen for three separate consonant sounds before the vowel.",
      "dok": 2,
      "difficulty": 2
    },
    {
      "questionType": "transfer",
      "prompt": "Which word completes “The stone made a big ___” and starts with a three-letter blend?",
      "choices": [
        "splash",
        "sound",
        "ripple"
      ],
      "answer": "splash",
      "explanation": "Splash completes the sentence and begins with spl, a three-letter blend.",
      "hint": "Choose the word that fits the sentence and starts with three consonant sounds.",
      "dok": 2,
      "difficulty": 2
    },
    {
      "questionType": "reasoning",
      "prompt": "Why is the beginning of stripe a consonant blend rather than one new sound?",
      "choices": [
        "You can still hear three consonant sounds.",
        "All the consonants are silent.",
        "The consonants turn into vowels."
      ],
      "answer": "You can still hear three consonant sounds.",
      "explanation": "The letters s, t, and r keep their individual sounds when blended in stripe.",
      "hint": "Try saying each beginning sound separately.",
      "dok": 3,
      "difficulty": 3
    },
    {
      "questionType": "reasoning",
      "prompt": "A student marks only sp as the whole beginning blend in spring. What did they miss?",
      "choices": [
        "The r joins the first two consonants.",
        "The g belongs at the start.",
        "The i is another consonant."
      ],
      "answer": "The r joins the first two consonants.",
      "explanation": "Spring begins with spr, a blend of three consonants before the vowel.",
      "hint": "Check whether another consonant comes before the first vowel.",
      "dok": 3,
      "difficulty": 3
    }
  ]
});
