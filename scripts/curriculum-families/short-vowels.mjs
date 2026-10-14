// Original Grade 2 practice authored for page-exact topic names; no teacher test questions inferred.
export const SHORT_VOWELS_FAMILY = Object.freeze({
  "id": "short-vowels",
  "subject": "Reading / ELA",
  "label": "Short vowel sounds a, e, i, o and u",
  "patternSource": "\\bshort\\s+vowels?\\b",
  "patternFlags": "i",
  "standards": [
    "CCSS.RF.2.3"
  ],
  "domain": "Foundational reading and phonics",
  "studyNotes": [
    "Short vowels include a in cat, e in bed, i in sit, o in hot, and u in sun.",
    "Practice identifying sounds in original CVC word examples; they are not a teacher-published test question list."
  ],
  "sourcePriority": [
    "Tests",
    "Reading Work"
  ],
  "featureFlag": "curriculum-family:short-vowels-v1",
  "rolloutStatus": "APPROVED",
  "enabledByDefault": true,
  "minimumSemanticVariants": 8,
  "requiredQuestionTypes": [
    "direct",
    "transfer",
    "reasoning"
  ],
  "teachCard": [
    "For each word, say the sound in the middle, not just the letter name.",
    "Use examples such as cat, bed, sit, hot and sun to hear the five short vowel sounds."
  ],
  "assessmentPatterns": [
    "\\bshort\\s+vowels?\\b"
  ],
  "baseQuestion": {
    "questionType": "direct",
    "prompt": "Which word has the short a sound, like cat?",
    "choices": [
      "Map",
      "Cake",
      "Rain"
    ],
    "answer": "Map",
    "explanation": "Map and cat have short a; cake and rain have long a.",
    "hint": "Listen for the middle vowel in cat.",
    "dok": 1,
    "difficulty": 2
  },
  "supplementalQuestions": [
    {
      "questionType": "direct",
      "prompt": "Which word has the short e sound, like bed?",
      "choices": [
        "Hen",
        "Feet",
        "See"
      ],
      "answer": "Hen",
      "explanation": "Hen and bed share the short e sound; feet and see have long e.",
      "hint": "Compare each choice with the vowel sound in bed.",
      "dok": 1,
      "difficulty": 2
    },
    {
      "questionType": "direct",
      "prompt": "Which word has the short i sound, like sit?",
      "choices": [
        "Pig",
        "Bike",
        "Time"
      ],
      "answer": "Pig",
      "explanation": "Pig and sit have short i; bike and time have long i.",
      "hint": "Listen for the middle sound in sit.",
      "dok": 1,
      "difficulty": 2
    },
    {
      "questionType": "direct",
      "prompt": "Which word has the short o sound, like hot?",
      "choices": [
        "Fox",
        "Bone",
        "Go"
      ],
      "answer": "Fox",
      "explanation": "Fox and hot use short o; bone and go have long o.",
      "hint": "Say each word slowly and compare its vowel with hot.",
      "dok": 1,
      "difficulty": 2
    },
    {
      "questionType": "direct",
      "prompt": "Which word has the short u sound, like sun?",
      "choices": [
        "Cup",
        "Cute",
        "June"
      ],
      "answer": "Cup",
      "explanation": "Cup and sun have short u; cute and June have long u.",
      "hint": "Compare the middle vowel sound with sun.",
      "dok": 1,
      "difficulty": 2
    },
    {
      "questionType": "transfer",
      "prompt": "Read: A red hen sat on a log. Which word contains the short e sound?",
      "choices": [
        "Hen",
        "Log",
        "Sat"
      ],
      "answer": "Hen",
      "explanation": "Hen has short e, while log has short o and sat has short a.",
      "hint": "Find the word that rhymes with ten.",
      "dok": 2,
      "difficulty": 2
    },
    {
      "questionType": "transfer",
      "prompt": "Which pair shows two different short-vowel sounds?",
      "choices": [
        "Cat and pin",
        "Bike and time",
        "Boat and rope"
      ],
      "answer": "Cat and pin",
      "explanation": "Cat has short a and pin has short i; the other pairs have long vowel sounds.",
      "hint": "Say both words and compare the sounds in the middle.",
      "dok": 2,
      "difficulty": 2
    },
    {
      "questionType": "reasoning",
      "prompt": "A student says pin belongs in the short a group with cap and bag. What explains the mistake?",
      "choices": [
        "Pin has short i, not short a.",
        "Pin has a long a sound.",
        "All three words have a long vowel."
      ],
      "answer": "Pin has short i, not short a.",
      "explanation": "Cap and bag have short a, but pin has short i.",
      "hint": "Separate the words by the sound of their vowel.",
      "dok": 3,
      "difficulty": 3
    }
  ]
});
