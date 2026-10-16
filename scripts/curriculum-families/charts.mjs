// Original Grade 2 practice authored for page-exact topic names; no teacher test questions inferred.
export const CHART_READING_FAMILY = Object.freeze({
  "id": "reading-charts",
  "subject": "Reading / ELA",
  "label": "Read and interpret charts",
  "patternSource": "\\bcharts?\\b",
  "patternFlags": "i",
  "standards": [
    "CCSS.RI.2.7"
  ],
  "domain": "Informational text features and data interpretation",
  "studyNotes": [
    "A chart organizes information into rows or groups. Read its labels and counts before answering a question.",
    "Compare chart values by finding the greatest, least, total, or difference."
  ],
  "sourcePriority": [
    "Reading Work",
    "Tests"
  ],
  "featureFlag": "curriculum-family:reading-charts-v1",
  "rolloutStatus": "APPROVED",
  "enabledByDefault": true,
  "minimumSemanticVariants": 8,
  "requiredQuestionTypes": [
    "direct",
    "transfer",
    "reasoning"
  ],
  "teachCard": [
    "Read the title and labels first, then find the number for each group.",
    "Use the chart's numbers to answer; do not guess from outside facts."
  ],
  "assessmentPatterns": [
    "\\bcharts?\\b",
    "data interpretation"
  ],
  "baseQuestion": {
    "questionType": "direct",
    "prompt": "A class chart lists apples 6, bananas 4, and oranges 3. Which fruit has the most votes?",
    "choices": [
      "Apples",
      "Bananas",
      "Oranges"
    ],
    "answer": "Apples",
    "explanation": "Six apple votes are more than four banana votes or three orange votes.",
    "hint": "Compare the three numbers and find the largest.",
    "dok": 1,
    "difficulty": 2
  },
  "supplementalQuestions": [
    {
      "questionType": "direct",
      "prompt": "The chart says: red pencils 2, blue pencils 5, and green pencils 4. Which color has the fewest pencils?",
      "choices": [
        "Blue",
        "Red",
        "Green"
      ],
      "answer": "Red",
      "explanation": "Two red pencils are fewer than four green or five blue pencils.",
      "hint": "Find the smallest number in the chart.",
      "dok": 1,
      "difficulty": 2
    },
    {
      "questionType": "direct",
      "prompt": "A chart shows Monday 3 books, Tuesday 7 books, Wednesday 5 books. How many books were read on Tuesday?",
      "choices": [
        "7 books",
        "5 books",
        "3 books"
      ],
      "answer": "7 books",
      "explanation": "The Tuesday row in the chart shows 7 books.",
      "hint": "Find Tuesday before looking at the number beside it.",
      "dok": 1,
      "difficulty": 2
    },
    {
      "questionType": "transfer",
      "prompt": "A snack chart shows 8 pretzels and 5 crackers. How many more pretzels than crackers are shown?",
      "choices": [
        "3 more",
        "5 more",
        "13 more"
      ],
      "answer": "3 more",
      "explanation": "Eight minus five is three, so there are 3 more pretzels.",
      "hint": "Compare the two counts by subtracting the smaller from the larger.",
      "dok": 2,
      "difficulty": 2
    },
    {
      "questionType": "transfer",
      "prompt": "A class plant chart shows 4 sprouts on Monday and 6 on Tuesday. How many sprouts were counted altogether?",
      "choices": [
        "10 sprouts",
        "6 sprouts",
        "2 sprouts"
      ],
      "answer": "10 sprouts",
      "explanation": "Four plus six equals ten sprouts counted across the two days.",
      "hint": "Add the counts from both days.",
      "dok": 2,
      "difficulty": 2
    },
    {
      "questionType": "transfer",
      "prompt": "A chart shows 3 dogs, 6 cats, and 4 fish. If two more dogs are added, how many dogs are shown?",
      "choices": [
        "5 dogs",
        "6 dogs",
        "3 dogs"
      ],
      "answer": "5 dogs",
      "explanation": "Three dogs plus two more makes five dogs.",
      "hint": "Use the dogs row and add two.",
      "dok": 2,
      "difficulty": 2
    },
    {
      "questionType": "reasoning",
      "prompt": "A chart shows Lily read 6 pages and Max read 4 pages. Lily says she read two more pages. Which explanation fits?",
      "choices": [
        "6 minus 4 equals 2",
        "6 plus 4 equals 2",
        "Both students read 6 pages"
      ],
      "answer": "6 minus 4 equals 2",
      "explanation": "Subtracting Max's 4 pages from Lily's 6 pages gives a difference of 2.",
      "hint": "Check the claim by finding the difference.",
      "dok": 3,
      "difficulty": 3
    },
    {
      "questionType": "reasoning",
      "prompt": "A chart shows 5 bikes, 2 scooters, and 4 skateboards. Which statement is supported by the chart?",
      "choices": [
        "There are more bikes than scooters.",
        "There are fewer bikes than skateboards.",
        "There are the same number of all three."
      ],
      "answer": "There are more bikes than scooters.",
      "explanation": "Five bikes is more than two scooters; the other statements contradict the counts.",
      "hint": "Check each statement against the numbers in the chart.",
      "dok": 3,
      "difficulty": 3
    }
  ]
});
