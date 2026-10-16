// Original Grade 2 practice authored for page-exact topic names; no teacher test questions inferred.
export const LONG_O_FAMILY = Object.freeze({
  "id": "long-o",
  "subject": "Spelling / Handwriting",
  "label": "Long o sound (original practice, not teacher word list)",
  "patternSource": "\\blong\\s+o\\b",
  "patternFlags": "i",
  "standards": [
    "CCSS.RF.2.3"
  ],
  "domain": "Phonics and word recognition",
  "studyNotes": [
    "Long o sounds like the letter name in go, home, and boat. These are original examples, not an official spelling list.",
    "If a teacher test label also says “short” without naming the vowel, do not guess which short-vowel pattern is included."
  ],
  "sourcePriority": [
    "Tests",
    "Weekly Spelling List"
  ],
  "featureFlag": "curriculum-family:long-o-v1",
  "rolloutStatus": "APPROVED",
  "enabledByDefault": true,
  "minimumSemanticVariants": 8,
  "requiredQuestionTypes": [
    "direct",
    "transfer",
    "reasoning"
  ],
  "teachCard": [
    "Say each word slowly and listen for the vowel name o.",
    "Different spellings can make the long o sound; the current teacher page does not specify a full weekly word list."
  ],
  "assessmentPatterns": [
    "\\blong\\s+o\\b"
  ],
  "baseQuestion": {
    "questionType": "direct",
    "prompt": "Which word has the long o sound, like the o sound in home?",
    "choices": [
      "Rope",
      "Hop",
      "Hot"
    ],
    "answer": "Rope",
    "explanation": "Rope has the long o sound; hop and hot use short o.",
    "hint": "Say the words slowly and compare the vowel with home.",
    "dok": 1,
    "difficulty": 2
  },
  "supplementalQuestions": [
    {
      "questionType": "direct",
      "prompt": "Which word has the same long o sound as the word snow?",
      "choices": [
        "Goat",
        "Sock",
        "Stop"
      ],
      "answer": "Goat",
      "explanation": "Goat and snow both have the long o sound.",
      "hint": "Listen for the o that sounds like its letter name.",
      "dok": 1,
      "difficulty": 2
    },
    {
      "questionType": "direct",
      "prompt": "Which word has a short o sound instead of a long o sound?",
      "choices": [
        "Cone",
        "Rose",
        "Box"
      ],
      "answer": "Box",
      "explanation": "Box has short o, while cone and rose have long o.",
      "hint": "Compare each middle vowel with the sound in hot.",
      "dok": 1,
      "difficulty": 2
    },
    {
      "questionType": "transfer",
      "prompt": "Read the sentence: The boat floats in the pond. Which word has a long o sound?",
      "choices": [
        "Boat",
        "Pond",
        "In"
      ],
      "answer": "Boat",
      "explanation": "Boat has long o spelled oa; pond has short o.",
      "hint": "Read each word aloud and listen for the long vowel.",
      "dok": 2,
      "difficulty": 2
    },
    {
      "questionType": "transfer",
      "prompt": "Add a silent e to the word not to make note. What happens to the vowel sound?",
      "choices": [
        "The o changes from short to long.",
        "The o stays short.",
        "The word no longer has an o."
      ],
      "answer": "The o changes from short to long.",
      "explanation": "Not has short o; note has long o with a final silent e.",
      "hint": "Compare the sounds in not and note.",
      "dok": 2,
      "difficulty": 2
    },
    {
      "questionType": "transfer",
      "prompt": "Which pair of words both have a long o sound?",
      "choices": [
        "Go and rope",
        "Fox and rock",
        "Hot and home"
      ],
      "answer": "Go and rope",
      "explanation": "Go and rope both have long o; the other pairs include short o.",
      "hint": "Check both words in each pair.",
      "dok": 2,
      "difficulty": 2
    },
    {
      "questionType": "reasoning",
      "prompt": "Why do the words boat and coat belong in the same long o group?",
      "choices": [
        "They both use the long o vowel sound.",
        "They both have a short o sound.",
        "They both begin with the same letter."
      ],
      "answer": "They both use the long o vowel sound.",
      "explanation": "Boat and coat share the long o sound, spelled oa.",
      "hint": "Focus on the vowel sound, not just the first letter.",
      "dok": 3,
      "difficulty": 3
    },
    {
      "questionType": "reasoning",
      "prompt": "A student groups home, hope, and hop as three long o words. Which word should be replaced?",
      "choices": [
        "Hop",
        "Home",
        "Hope"
      ],
      "answer": "Hop",
      "explanation": "Hop has short o; home and hope have long o.",
      "hint": "Read each word and find the one with a different o sound.",
      "dok": 3,
      "difficulty": 3
    }
  ]
});
