/** Original practice, not official Renaissance STAR items or score predictions. */
export function buildStarBank() {
  const bank = [];
  const add = (
    subject,
    skill,
    prompt,
    answer,
    wrong,
    explanation,
    hint,
    difficulty = 2,
    dok = 1,
  ) => {
    const choices = [String(answer), ...wrong.map(String)];
    const position = bank.length % 4;
    choices.splice(0, 1);
    choices.splice(position, 0, String(answer));
    bank.push({
      id: `original-star-${bank.length + 1}`,
      subject,
      skill,
      prompt,
      choices,
      answer: String(answer),
      explanation,
      hint,
      tier: "star-fallback",
      difficulty,
      dok,
      sourceFact: "Original Grade 2 STAR-style practice",
    });
  };
  const math = (...args) => add("Math", ...args);
  for (const [a, b] of [
    [28, 17],
    [46, 25],
    [37, 36],
    [58, 14],
    [19, 54],
    [63, 18],
    [27, 48],
    [36, 29],
    [45, 37],
    [56, 26],
  ])
    math(
      "Addition",
      `What is ${a} + ${b}?`,
      a + b,
      [a + b - 10, a + b + 10, a + b - 1],
      `${a} + ${b} = ${a + b}. Add the ones, regroup if needed, then add the tens.`,
      "You can break each number into tens and ones.",
    );
  for (const [a, b] of [
    [54, 28],
    [72, 36],
    [81, 47],
    [63, 25],
    [90, 56],
    [45, 19],
    [67, 38],
    [83, 24],
    [61, 35],
    [76, 49],
  ])
    math(
      "Subtraction",
      `What is ${a} − ${b}?`,
      a - b,
      [a - b + 10, a - b - 10, a - b + 1],
      `${a} − ${b} = ${a - b}. Check by adding ${a - b} and ${b}.`,
      "Regroup one ten into ten ones when needed.",
    );
  for (const [a, b] of [
    [6, 8],
    [9, 7],
    [8, 5],
    [7, 4],
    [5, 9],
    [4, 8],
    [6, 7],
    [9, 3],
    [8, 8],
    [7, 7],
  ])
    math(
      "Missing addend",
      `A basket has ${a + b} apples. ${a} are green and the rest are red. How many are red?`,
      b,
      [b + 1, b + 2, a + b],
      `${a} + ${b} = ${a + b}, so ${b} apples are red.`,
      "Think: the whole minus the green apples.",
      2,
      2,
    );
  for (const n of [143, 268, 352, 417, 589, 624, 731, 856, 962, 195]) {
    const h = Math.floor(n / 100),
      t = Math.floor(n / 10) % 10,
      o = n % 10;
    math(
      "Place value",
      `What is the value of the digit ${t} in ${n}?`,
      t * 10,
      [t, t * 100, o],
      `The digit ${t} is in the tens place. ${t} tens equals ${t * 10}.`,
      "Read the places: hundreds, tens, ones.",
    );
  }
  for (const [a, b] of [
    [245, 254],
    [609, 590],
    [381, 318],
    [472, 427],
    [826, 862],
  ])
    math(
      "Compare numbers",
      `Which comparison of ${a} and ${b} is true?`,
      `${a} ${a > b ? ">" : "<"} ${b}`,
      [`${a} ${a > b ? "<" : ">"} ${b}`, `${a} = ${b}`, `${a} + 1 = ${b}`],
      `Compare hundreds first, then tens, then ones: ${a} is ${a > b ? "greater" : "less"} than ${b}.`,
      "Start at the leftmost place.",
    );
  for (const [start, step] of [
    [15, 5],
    [24, 2],
    [130, 10],
    [35, 5],
    [46, 2],
  ])
    math(
      "Number patterns",
      `What comes next: ${start}, ${start + step}, ${start + step * 2}, ___?`,
      start + step * 3,
      [start + step * 2 + 1, start + step * 4, start + step],
      `Each number increases by ${step}. The next number is ${start + step * 3}.`,
      "Find how much is added each time.",
    );
  for (const [h, m] of [
    [2, 15],
    [4, 30],
    [7, 45],
    [9, 5],
    [11, 50],
  ]) {
    const min = m / 5;
    math(
      "Time",
      `A clock's minute hand points to ${min}. Its hour hand is ${m < 30 ? "just past" : "between"} ${h}${m < 30 ? "" : ` and ${h + 1}`}. What time is it?`,
      `${h}:${String(m).padStart(2, "0")}`,
      [
        `${h}:${String(min).padStart(2, "0")}`,
        `${h + 1}:${String(m).padStart(2, "0")}`,
        `${h}:00`,
      ],
      `Count by fives to ${min}: ${m} minutes. The hour is ${h}.`,
      "Each number on a clock stands for five minutes.",
    );
  }
  for (const [quarters, dimes, nickels, pennies] of [
    [1, 2, 1, 3],
    [2, 1, 1, 2],
    [0, 3, 2, 4],
    [1, 0, 2, 1],
    [2, 2, 0, 4],
  ]) {
    const cents = quarters * 25 + dimes * 10 + nickels * 5 + pennies;
    math(
      "Money",
      `How many cents are ${quarters} quarter(s), ${dimes} dime(s), ${nickels} nickel(s), and ${pennies} pennies worth?`,
      cents,
      [cents + 5, cents - 5, cents + 10],
      `Add ${quarters * 25} + ${dimes * 10} + ${nickels * 5} + ${pennies} = ${cents} cents.`,
      "A quarter is 25¢, a dime 10¢, and a nickel 5¢.",
    );
  }
  const facts = [
    [
      "Geometry",
      "Which shape has exactly 3 straight sides?",
      "Triangle",
      ["Square", "Pentagon", "Hexagon"],
      "A triangle has 3 straight sides.",
      "Count the sides.",
    ],
    [
      "Geometry",
      "Which shape has exactly 6 straight sides?",
      "Hexagon",
      ["Triangle", "Pentagon", "Square"],
      "A hexagon has 6 straight sides.",
      "The prefix hex means six.",
    ],
    [
      "Geometry",
      "How many corners does a rectangle have?",
      "4",
      ["2", "3", "6"],
      "A rectangle has 4 corners.",
      "Imagine walking around its edges.",
    ],
    [
      "Geometry",
      "Which solid is shaped like a ball?",
      "Sphere",
      ["Cube", "Cone", "Cylinder"],
      "A sphere is round in every direction.",
      "Think about a soccer ball.",
    ],
    [
      "Geometry",
      "How many equal parts are needed to make fourths?",
      "4",
      ["2", "3", "8"],
      "Fourths divide a whole into 4 equal parts.",
      "The word fourths gives a clue.",
    ],
    [
      "Geometry",
      "A sandwich is cut into 2 equal pieces. What is one piece called?",
      "One half",
      ["One fourth", "One whole", "Two halves"],
      "Each of 2 equal parts is one half.",
      "Both parts must be equal.",
    ],
    [
      "Measurement",
      "Which unit is best for measuring the length of a pencil?",
      "Centimeters",
      ["Liters", "Hours", "Kilograms"],
      "Centimeters measure short lengths.",
      "Choose a unit of length.",
    ],
    [
      "Measurement",
      "Which tool measures length?",
      "Ruler",
      ["Clock", "Thermometer", "Balance scale"],
      "A ruler measures length.",
      "Think about measuring a line.",
    ],
    [
      "Measurement",
      "A ribbon is 18 centimeters long. You cut off 7 centimeters. How long is the rest?",
      "11 centimeters",
      ["25 centimeters", "7 centimeters", "12 centimeters"],
      "18 − 7 = 11 centimeters.",
      "Subtract the piece that was cut off.",
    ],
    [
      "Measurement",
      "A toy car is 9 inches long. Another is 6 inches long. How much longer is the first car?",
      "3 inches",
      ["15 inches", "6 inches", "9 inches"],
      "9 − 6 = 3 inches.",
      "Find the difference.",
    ],
    [
      "Time",
      "What time is 30 minutes after 3:15?",
      "3:45",
      ["3:30", "4:15", "2:45"],
      "15 minutes plus 30 minutes is 45 minutes.",
      "Keep the hour and add the minutes.",
    ],
    [
      "Time",
      "What time is one hour after 10:30?",
      "11:30",
      ["10:31", "11:00", "9:30"],
      "One hour later changes 10 to 11; the minutes stay 30.",
      "Only the hour changes.",
    ],
    [
      "Money",
      "You have 50 cents and spend 35 cents. How much remains?",
      "15 cents",
      ["25 cents", "85 cents", "35 cents"],
      "50 − 35 = 15 cents.",
      "Subtract what you spend.",
    ],
    [
      "Money",
      "Which group is worth exactly one dollar?",
      "4 quarters",
      ["4 dimes", "4 nickels", "4 pennies"],
      "4 × 25 cents = 100 cents, or one dollar.",
      "One dollar is 100 cents.",
    ],
    [
      "Number sense",
      "Is 18 even or odd?",
      "Even, because it can make pairs with none left",
      [
        "Odd, because it ends in 8",
        "Odd, because it is more than 10",
        "Even, because all numbers are even",
      ],
      "18 makes 9 pairs with none left.",
      "Try grouping objects in twos.",
    ],
    [
      "Number sense",
      "Which number is 100 more than 236?",
      "336",
      ["246", "136", "326"],
      "Adding 100 increases the hundreds digit by one.",
      "Keep the tens and ones the same.",
    ],
    [
      "Number sense",
      "Which number is 10 less than 502?",
      "492",
      ["501", "512", "402"],
      "502 − 10 = 492.",
      "Count backward one group of ten.",
    ],
    [
      "Operations",
      "Three rows have 4 chairs in each row. How many chairs are there?",
      "12",
      ["7", "8", "16"],
      "4 + 4 + 4 = 12 chairs.",
      "Add one group for each row.",
    ],
    [
      "Operations",
      "There are 5 pairs of socks. How many socks are there?",
      "10",
      ["5", "7", "12"],
      "2 + 2 + 2 + 2 + 2 = 10 socks.",
      "A pair has two things.",
    ],
    [
      "Operations",
      "Mia has 12 beads. She gets 8 more, then gives away 5. How many does she have?",
      "15",
      ["20", "25", "9"],
      "12 + 8 = 20; 20 − 5 = 15.",
      "Work through the story in order.",
    ],
  ];
  facts.forEach((f) => math(...f));
  for (const [cats, dogs, birds] of [
    [8, 5, 3],
    [7, 2, 1],
    [9, 5, 4],
    [6, 4, 1],
    [10, 3, 5],
  ]) {
    math(
      "Data",
      `A class votes for pets: cats ${cats}, dogs ${dogs}, birds ${birds}. How many more votes do cats have than dogs?`,
      cats - dogs,
      [cats + dogs, cats - dogs + 1, cats - dogs - 1],
      `${cats} − ${dogs} = ${cats - dogs} more votes.`,
      "Compare the two named groups.",
      2,
      2,
    );
    math(
      "Data",
      `A class votes for pets: cats ${cats}, dogs ${dogs}, birds ${birds}. How many votes are there altogether?`,
      cats + dogs + birds,
      [cats + dogs, cats + birds, dogs + birds],
      `${cats} + ${dogs} + ${birds} = ${cats + dogs + birds}.`,
      "Include all three groups.",
      2,
      2,
    );
  }
  // Each passage supplies all evidence needed; no outside story knowledge is assumed.
  const passages = [
    {
      text: "Lena saw dry soil in the class garden. The bean leaves drooped. She filled a watering can and gently watered the soil. By afternoon, the leaves stood taller.",
      qs: [
        [
          "Main idea",
          "What is this passage mostly about?",
          "Lena helps a dry plant",
          ["Lena paints a garden", "Lena picks beans", "Lena buys a can"],
          "The dry soil, watering, and taller leaves all show Lena helping the plant.",
        ],
        [
          "Inference",
          "Why did Lena water the soil?",
          "The plant needed water",
          [
            "The leaves were too tall",
            "She wanted to wash beans",
            "The garden was flooded",
          ],
          "Dry soil and drooping leaves show the plant needed water.",
        ],
        [
          "Vocabulary",
          "What does drooped mean here?",
          "Hung downward",
          ["Grew flowers", "Turned blue", "Made sounds"],
          "The leaves hung down before watering and stood taller afterward.",
        ],
        [
          "Sequence",
          "What happened after Lena watered the soil?",
          "The leaves stood taller",
          ["She saw dry soil", "She filled the can", "She planted a tree"],
          "The final sentence tells what happened afterward.",
        ],
      ],
    },
    {
      text: "Owen packed a sandwich and an apple. He checked that his water bottle was full. Then he put on his hiking shoes. His family was ready for a walk on the forest trail.",
      qs: [
        [
          "Main idea",
          "What is Owen doing?",
          "Getting ready for a hike",
          [
            "Getting ready for bed",
            "Making a school poster",
            "Cleaning a kitchen",
          ],
          "Food, water, hiking shoes, and the trail all connect to a hike.",
        ],
        [
          "Evidence",
          "Which detail best shows where the family will walk?",
          "They will use a forest trail",
          [
            "Owen packed an apple",
            "The bottle was full",
            "Owen had a sandwich",
          ],
          "The final sentence names the forest trail.",
        ],
        [
          "Sequence",
          "What did Owen do just before putting on his shoes?",
          "Checked his water bottle",
          ["Walked the trail", "Ate an apple", "Went to bed"],
          "He checked the water before putting on his shoes.",
        ],
        [
          "Inference",
          "Why did Owen bring water?",
          "He might get thirsty while walking",
          [
            "He wanted to water houseplants",
            "He planned to paint",
            "He wanted to fill a pool",
          ],
          "Water is useful to drink during a hike.",
        ],
      ],
    },
    {
      text: "A robin carried twigs to a tree. It tucked grass between the twigs. Soon a small round nest rested on a branch. The nest would be a place for the robin to lay its eggs.",
      qs: [
        [
          "Main idea",
          "What is this passage mostly about?",
          "A robin builds a nest",
          [
            "A robin learns to swim",
            "A tree loses leaves",
            "A child finds a feather",
          ],
          "The passage follows the robin making a nest.",
        ],
        [
          "Details",
          "What did the robin tuck between the twigs?",
          "Grass",
          ["Stones", "Snow", "Paper cups"],
          "The second sentence says it tucked grass between the twigs.",
        ],
        [
          "Purpose",
          "Why did the robin build the nest?",
          "To have a place for its eggs",
          ["To store shoes", "To hide a bicycle", "To catch fish"],
          "The last sentence explains the purpose.",
        ],
        [
          "Vocabulary",
          "What is a branch?",
          "A part of a tree that grows out from the trunk",
          ["A kind of bird food", "A deep hole in soil", "A baby robin"],
          "The nest rests on a part of the tree.",
        ],
      ],
    },
    {
      text: "Sam wanted to read, but his little brother was playing a loud drum. Sam asked him to play in another room. His brother agreed. Sam smiled and opened his book.",
      qs: [
        [
          "Problem and solution",
          "What problem did Sam have?",
          "The drum was too loud for reading",
          ["His book was wet", "He lost his drum", "The room was dark"],
          "The loud drum interrupted the quiet he needed.",
        ],
        [
          "Details",
          "How did Sam solve the problem?",
          "He asked his brother to play elsewhere",
          [
            "He threw away the drum",
            "He tore his book",
            "He turned off a light",
          ],
          "Sam asked his brother to use another room.",
        ],
        [
          "Inference",
          "How did Sam probably feel at the end?",
          "Pleased",
          ["Terrified", "Angry at the book", "Confused about the drum"],
          "Sam smiled and began reading after his brother agreed.",
        ],
        [
          "Sequence",
          "What happened last?",
          "Sam opened his book",
          [
            "The brother played loudly",
            "Sam asked for a change",
            "The brother agreed",
          ],
          "Opening the book is the final action.",
        ],
      ],
    },
    {
      text: "Bees visit flowers to collect nectar. As they move, pollen sticks to their bodies. Some pollen rubs off on the next flower. Moving pollen between flowers helps many plants make seeds.",
      qs: [
        [
          "Main idea",
          "What is the passage mainly explaining?",
          "How bees help plants",
          ["How to draw a bee", "Why flowers need snow", "Where bears sleep"],
          "The passage explains how bees move pollen and help seed production.",
        ],
        [
          "Details",
          "What do bees collect from flowers?",
          "Nectar",
          ["Sand", "Salt", "Stones"],
          "The first sentence says they collect nectar.",
        ],
        [
          "Cause and effect",
          "What happens when bees visit another flower?",
          "Some pollen rubs off",
          [
            "All flowers close forever",
            "The bee becomes a seed",
            "The flower turns to stone",
          ],
          "The passage states that pollen rubs off on the next flower.",
        ],
        [
          "Evidence",
          "Which detail shows that bees are useful to plants?",
          "Moving pollen helps plants make seeds",
          ["Bees have bodies", "Flowers have colors", "Seeds are always large"],
          "The last sentence directly explains the benefit.",
        ],
      ],
    },
    {
      text: "Nora was nervous about reading her poem to the class. She practiced twice with her dad. At school she took a slow breath and began. When she finished, her classmates clapped.",
      qs: [
        [
          "Main idea",
          "What is this passage mostly about?",
          "Nora reads her poem despite feeling nervous",
          [
            "Nora forgets school",
            "Nora teaches her dad to clap",
            "Nora buys a book",
          ],
          "Her practice and classroom reading address her nervousness.",
        ],
        [
          "Vocabulary",
          "What does nervous mean here?",
          "Worried about what might happen",
          ["Ready to fall asleep", "Very hungry", "Unable to hear"],
          "Nora is worried about reading to the class.",
        ],
        [
          "Sequence",
          "What did Nora do before she began reading at school?",
          "Took a slow breath",
          ["Went home", "Clapped for herself", "Wrote a new poem"],
          "She took a slow breath and then began.",
        ],
        [
          "Inference",
          "Why did her classmates clap?",
          "To show they liked or supported her reading",
          ["To ask her to stop sleeping", "To call her dad", "To make it rain"],
          "Clapping after a performance shows appreciation or support.",
        ],
      ],
    },
    {
      text: "Ice covered the shallow puddle in the morning. The sun warmed the sidewalk. By lunchtime, the ice had become liquid water. The children stepped around the puddle on their way outside.",
      qs: [
        [
          "Main idea",
          "What change does this passage describe?",
          "Ice melts into water",
          [
            "Water becomes a rock",
            "A sidewalk becomes ice",
            "Children build a pool",
          ],
          "The frozen puddle becomes liquid as it warms.",
        ],
        [
          "Cause and effect",
          "What helped the ice melt?",
          "Warmth from the sun",
          [
            "The children clapping",
            "More cold wind",
            "A dark cloud cooling it",
          ],
          "The sun warmed the sidewalk before the ice melted.",
        ],
        [
          "Sequence",
          "When was the puddle covered with ice?",
          "In the morning",
          ["At lunchtime", "After bedtime", "At midnight only"],
          "The first sentence states in the morning.",
        ],
        [
          "Vocabulary",
          "What does shallow mean?",
          "Not deep",
          ["Very loud", "Extremely long", "Always frozen"],
          "Shallow describes water with little depth.",
        ],
      ],
    },
    {
      text: "The library basket held books about space, insects, and oceans. Kai chose the ocean book because he wanted to learn about whales. He used the table of contents to find a chapter called Giant Swimmers.",
      qs: [
        [
          "Details",
          "Which book did Kai choose?",
          "The ocean book",
          ["The space book", "The insect book", "A book about baking"],
          "Kai chose the ocean book to learn about whales.",
        ],
        [
          "Text features",
          "What helped Kai find a chapter?",
          "The table of contents",
          ["The price tag", "The basket handle", "The library door"],
          "The passage names the table of contents.",
        ],
        [
          "Inference",
          "What will Giant Swimmers most likely discuss?",
          "Large ocean animals",
          ["Tiny garden seeds", "Small stars", "How to bake bread"],
          "Kai is looking for whales in an ocean book.",
        ],
        [
          "Purpose",
          "Why did Kai choose that book?",
          "To learn about whales",
          ["To learn about ants", "To draw planets", "To read a cookie recipe"],
          "The second sentence gives his reason.",
        ],
      ],
    },
    {
      text: "Maya and Leo built a block bridge. The first bridge fell when they put a toy truck on it. They made the base wider and tried again. This time the bridge held the truck.",
      qs: [
        [
          "Main idea",
          "What is the passage mostly about?",
          "Children improve a block bridge",
          [
            "Children wash a truck",
            "Children lose their blocks",
            "Children cross a river",
          ],
          "They test a bridge, change it, and make it work.",
        ],
        [
          "Cause and effect",
          "What change helped the bridge hold the truck?",
          "A wider base",
          ["A louder horn", "A taller toy driver", "Fewer wheels on the truck"],
          "After they widened the base, the bridge held the truck.",
        ],
        [
          "Sequence",
          "What happened first?",
          "They built a block bridge",
          [
            "They made the base wider",
            "The second bridge held",
            "They tried again",
          ],
          "Building the first bridge comes before testing it.",
        ],
        [
          "Inference",
          "Which lesson fits the story?",
          "Trying a new plan can solve a problem",
          [
            "Always quit after one try",
            "Toys cannot be used to learn",
            "Working together never helps",
          ],
          "They changed their plan after failure and succeeded.",
        ],
      ],
    },
    {
      text: "Some trees lose their leaves in autumn. Before falling, the leaves may turn red, orange, or yellow. Evergreen trees keep green needles or leaves through the winter. Both kinds provide shelter for animals.",
      qs: [
        [
          "Compare and contrast",
          "How are the two kinds of trees alike?",
          "Both provide shelter",
          [
            "Both always lose all leaves in autumn",
            "Both have only red leaves",
            "Both have no leaves in winter",
          ],
          "The final sentence says both provide shelter.",
        ],
        [
          "Details",
          "What do evergreen trees keep through winter?",
          "Green needles or leaves",
          ["Only yellow flowers", "Snow all year", "Only bare branches"],
          "The passage states they keep green needles or leaves.",
        ],
        [
          "Vocabulary",
          "What does shelter mean here?",
          "A place that helps protect animals",
          ["A kind of animal food", "A tree color", "A winter month"],
          "Shelter offers protection.",
        ],
        [
          "Details",
          "When do some trees lose their leaves?",
          "In autumn",
          ["Only in summer", "Every morning", "Only in spring"],
          "The opening sentence names autumn.",
        ],
      ],
    },
  ];
  passages.forEach((p, pi) =>
    p.qs.forEach(([skill, q, a, w, e]) =>
      add(
        "Reading / ELA",
        skill,
        `Read the passage:\n${p.text}\n\n${q}`,
        a,
        w,
        e,
        "Reread the passage and look for words that support your answer.",
        2,
        skill === "Inference" ? 2 : 1,
      ),
    ),
  );
  const words = [
    [
      "Phonics",
      "Which word has the same long a sound as cake?",
      "Rain",
      ["Cat", "Cap", "Apple"],
      "Rain and cake both have the long a sound.",
    ],
    [
      "Phonics",
      "Which word has the same long e sound as tree?",
      "Seed",
      ["Bed", "Hen", "Pet"],
      "Tree and seed both have the long e sound.",
    ],
    [
      "Phonics",
      "Which word has the same long i sound as kite?",
      "Bike",
      ["Sit", "Pin", "Fish"],
      "Kite and bike both have the long i sound.",
    ],
    [
      "Phonics",
      "Which word has the same long o sound as boat?",
      "Snow",
      ["Hot", "Sock", "Top"],
      "Boat and snow both have the long o sound.",
    ],
    [
      "Phonics",
      "Which word rhymes with light?",
      "Night",
      ["Little", "Leaf", "Late"],
      "Light and night share the ending sound.",
    ],
    [
      "Phonics",
      "Which word starts with the same sound as ship?",
      "Shell",
      ["Chair", "Sock", "Tree"],
      "Ship and shell begin with the sh sound.",
    ],
    [
      "Phonics",
      "Which word starts with the same sound as chair?",
      "Cheese",
      ["Sheep", "Cat", "Thin"],
      "Chair and cheese begin with the ch sound.",
    ],
    [
      "Syllables",
      "How many syllables are in rabbit?",
      "2",
      ["1", "3", "4"],
      "Rabbit has two beats: rab-bit.",
    ],
    [
      "Syllables",
      "How many syllables are in banana?",
      "3",
      ["1", "2", "4"],
      "Banana has three beats: ba-na-na.",
    ],
    [
      "Word parts",
      "What does unhappy mean?",
      "Not happy",
      ["Very happy", "Happy again", "Always happy"],
      "The prefix un- means not.",
    ],
    [
      "Word parts",
      "What does reread mean?",
      "Read again",
      ["Stop reading", "Read badly", "Never read"],
      "The prefix re- means again.",
    ],
    [
      "Word parts",
      "Which word is made from two smaller words?",
      "Sunflower",
      ["Happy", "Little", "Jumping"],
      "Sunflower combines sun and flower.",
    ],
    [
      "Vocabulary",
      "In “The tiny ant crawled by,” what does tiny mean?",
      "Very small",
      ["Very loud", "Very fast", "Very old"],
      "Tiny describes something very small.",
    ],
    [
      "Vocabulary",
      "In “Please shut the gate,” which word means shut?",
      "Close",
      ["Paint", "Open", "Carry"],
      "Shut and close have the same meaning here.",
    ],
    [
      "Vocabulary",
      "Which word means the opposite of empty?",
      "Full",
      ["Hollow", "Bare", "Vacant"],
      "Full is the opposite of empty.",
    ],
    [
      "Vocabulary",
      "Which word means the opposite of early?",
      "Late",
      ["Soon", "First", "Before"],
      "Late is the opposite of early.",
    ],
    [
      "Sentence meaning",
      "Which sentence is a question?",
      "Where is my hat?",
      ["I found my hat.", "My hat is blue.", "Please wear a hat."],
      "It asks for information and ends with a question mark.",
    ],
    [
      "Sequence",
      "Which word tells that an event happens at the end?",
      "Finally",
      ["First", "Before", "Earlier"],
      "Finally introduces the last event.",
    ],
    [
      "Context clues",
      "“The path was slippery, so Ben walked slowly to avoid falling.” What does slippery mean?",
      "Easy to slide on",
      ["Very colorful", "Full of flowers", "Warm to touch"],
      "Walking slowly to avoid falling is a clue that feet could slide.",
    ],
    [
      "Context clues",
      "“Ava whispered so she would not wake the baby.” How did Ava speak?",
      "Very quietly",
      ["Very loudly", "While singing loudly", "With a shout"],
      "Not waking the baby is a clue that she spoke quietly.",
    ],
  ];
  words.forEach(([s, p, a, w, e]) =>
    add(
      "Reading / ELA",
      s,
      p,
      a,
      w,
      e,
      "Say the words softly or reread the sentence for clues.",
    ),
  );
  const vowelPractice = [
    [
      "Which word has a long i sound?",
      "Smile",
      ["Swim", "Milk", "Gift"],
      "Smile has the long i sound; swim, milk, and gift have short i.",
    ],
    [
      "Which word has a short i sound?",
      "Brick",
      ["Time", "Line", "Drive"],
      "Brick has short i; time, line, and drive have long i.",
    ],
    [
      "Which word changes to a long i sound when silent e is added?",
      "Kit becomes kite",
      ["Hop becomes hope", "Cap becomes cape", "Cub becomes cube"],
      "Kit has short i; kite has long i. The other pairs change different vowels.",
    ],
    [
      "Which pair has a short i word followed by a long i word?",
      "Pin and pine",
      ["Pine and pin", "Bike and ride", "Fish and dish"],
      "Pin has short i and pine has long i.",
    ],
    [
      "Which word has the same vowel sound as five?",
      "Nine",
      ["Six", "Big", "Thin"],
      "Five and nine have long i.",
    ],
    [
      "Which word has the same vowel sound as mitt?",
      "Hill",
      ["Ice", "Fly", "Pie"],
      "Mitt and hill have short i.",
    ],
    [
      "Which pair has two long i sounds?",
      "Light and night",
      ["Hit and sit", "Pig and wig", "Fish and fin"],
      "The igh in light and night spells long i.",
    ],
    [
      "Which pair has two short i sounds?",
      "Lip and zip",
      ["Lime and time", "Ride and hide", "Pie and tie"],
      "Lip and zip both have short i.",
    ],
  ];
  vowelPractice.forEach(([p, a, w, e]) =>
    add(
      "Reading / ELA",
      "long-short-i",
      p,
      a,
      w,
      e,
      "Long i says its letter name. Short i sounds like the vowel in sit.",
    ),
  );
  return bank;
}
