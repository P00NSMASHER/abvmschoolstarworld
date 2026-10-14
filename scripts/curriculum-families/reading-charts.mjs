// Original Grade 2 chart interpretation practice. Only activated when the current
// public teacher source explicitly names charts. These examples are not teacher test items.
const questions=[
  {
    "questionType": "direct",
    "prompt": "A class chart lists favorite fruit: apples 6 votes, grapes 4 votes, pears 3 votes. Which fruit has the most votes?",
    "choices": [
      "apples",
      "grapes",
      "pears"
    ],
    "answer": "apples",
    "explanation": "The chart shows 6 votes for apples, more than grapes (4) or pears (3).",
    "hint": "Find the largest number beside a fruit.",
    "dok": 1,
    "difficulty": 2
  },
  {
    "questionType": "direct",
    "prompt": "A reading chart lists books finished: Mia 5, Ben 2, Ava 4. How many books did Ben finish?",
    "choices": [
      "2",
      "4",
      "5"
    ],
    "answer": "2",
    "explanation": "The row for Ben shows 2 books finished.",
    "hint": "Read the number in the row named in the question.",
    "dok": 1,
    "difficulty": 2
  },
  {
    "questionType": "direct",
    "prompt": "A color chart shows red ribbons 3, blue ribbons 5, green ribbons 1. Which color has the fewest ribbons?",
    "choices": [
      "green",
      "red",
      "blue"
    ],
    "answer": "green",
    "explanation": "Green has 1 ribbon, the smallest count on the chart.",
    "hint": "Look for the smallest count.",
    "dok": 1,
    "difficulty": 2
  },
  {
    "questionType": "transfer",
    "prompt": "A chart shows sunny hours: Monday 3, Tuesday 5, Wednesday 2. How many more sunny hours were there Tuesday than Wednesday?",
    "choices": [
      "3",
      "2",
      "7"
    ],
    "answer": "3",
    "explanation": "Tuesday has 5 and Wednesday has 2, so 5 - 2 = 3 more sunny hours.",
    "hint": "Subtract Wednesday's number from Tuesday's number.",
    "dok": 2,
    "difficulty": 2
  },
  {
    "questionType": "transfer",
    "prompt": "An animal chart shows birds 4, squirrels 2, rabbits 3. How many birds and rabbits are there altogether?",
    "choices": [
      "7",
      "6",
      "9"
    ],
    "answer": "7",
    "explanation": "The chart shows 4 birds and 3 rabbits. Together that is 4 + 3 = 7.",
    "hint": "Add the counts for just the two animals named.",
    "dok": 2,
    "difficulty": 2
  },
  {
    "questionType": "transfer",
    "prompt": "A points chart shows Team A 7 points and Team B 5 points. Team B scores 2 more points. What does the new chart show?",
    "choices": [
      "Both teams have 7 points.",
      "Team B has 5 points.",
      "Team A has 9 points."
    ],
    "answer": "Both teams have 7 points.",
    "explanation": "Team B increases from 5 to 7 points, matching Team A's 7 points.",
    "hint": "Add the extra points to Team B's count, then compare.",
    "dok": 2,
    "difficulty": 2
  },
  {
    "questionType": "reasoning",
    "prompt": "A chart shows books read: Kim 4, Jay 6, Lee 2. Which statement does the chart support?",
    "choices": [
      "Jay read two more books than Kim.",
      "Lee read more books than Jay.",
      "Kim read the fewest books."
    ],
    "answer": "Jay read two more books than Kim.",
    "explanation": "Jay read 6 books and Kim read 4; 6 - 4 = 2. Lee, not Kim, read the fewest.",
    "hint": "Check each claim against the exact numbers in the chart.",
    "dok": 3,
    "difficulty": 3
  },
  {
    "questionType": "reasoning",
    "prompt": "A lunch vote chart shows pizza 8 votes, pasta 6 votes, soup 6 votes. Which conclusion is supported?",
    "choices": [
      "Pizza received two more votes than pasta.",
      "Soup received more votes than pizza.",
      "Every student chose pizza."
    ],
    "answer": "Pizza received two more votes than pasta.",
    "explanation": "Pizza has 8 votes and pasta has 6, a difference of 2; soup has 6 votes too.",
    "hint": "Compare the counts, not what people might have chosen.",
    "dok": 3,
    "difficulty": 3
  },
  {
    "questionType": "reasoning",
    "prompt": "A leaf chart shows Tuesday 4 leaves, Wednesday 7 leaves, Thursday 5 leaves. A student says Wednesday has three more than Thursday. What is the correction?",
    "choices": [
      "Wednesday has two more than Thursday.",
      "Wednesday has three fewer than Thursday.",
      "Wednesday has the same number as Thursday."
    ],
    "answer": "Wednesday has two more than Thursday.",
    "explanation": "Wednesday shows 7 leaves and Thursday shows 5, so the difference is 2.",
    "hint": "Subtract Thursday's count from Wednesday's count.",
    "dok": 3,
    "difficulty": 3
  }
];
const freezeQuestion = row => Object.freeze({...row,choices:Object.freeze([...row.choices])});

export const READING_CHARTS_FAMILY=Object.freeze({
  id:'reading-charts',
  subject:'Reading / ELA',
  label:'Read simple charts',
  patternSource:'\\bcharts?\\b',
  patternFlags:'i',
  standards:Object.freeze(['CCSS.RI.2.7']),
  domain:'Informational text features',
  studyNotes:Object.freeze([
    'A chart organizes information using labels and numbers. Read the heading and labels before comparing counts.',
    'To find how many more, subtract two chart values; to find altogether, add the values requested.',
  ]),
  sourcePriority:Object.freeze(['Reading Work']),
  featureFlag:'curriculum-family:reading-charts-v1',
  rolloutStatus:'APPROVED',
  enabledByDefault:true,
  minimumSemanticVariants:8,
  requiredQuestionTypes:Object.freeze(['direct','transfer','reasoning']),
  teachCard:Object.freeze([
    'Read a chart title, match each label to its count, and answer only what the chart actually shows.',
    'Compare two counts with subtraction; combine named groups with addition.',
  ]),
  assessmentPatterns:Object.freeze(['\\bcharts?\\b','\\bdata\\b','\\bcounts?\\b']),
  baseQuestion:freezeQuestion(questions[0]),
  supplementalQuestions:Object.freeze(questions.slice(1).map(freezeQuestion)),
});
