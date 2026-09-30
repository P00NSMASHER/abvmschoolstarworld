import { createHash } from 'node:crypto';

import { validateGrade2PipelineAlignment } from './grade2-content-alignment.mjs';

const FORBIDDEN_QUESTION_PATTERNS = [
  /teacher page/i,
  /study list/i,
  /current vocabulary list/i,
  /being practiced this week/i,
  /which .* is on .* list/i,
];

const SIGHT_WORD_CONTEXTS = Object.freeze({
  she: { sentence: '___ packed her lunch before school.', distractors: ['what', 'small'] },
  boy: { sentence: 'The ___ carried a blue backpack.', distractors: ['what', 'were'] },
  he: { sentence: '___ hung his coat by the door.', distractors: ['what', 'small'] },
  small: { sentence: 'The ant is very ___.', distractors: ['were', 'what'] },
  were: { sentence: 'The boys ___ ready for recess.', distractors: ['small', 'what'] },
  what: { sentence: '___ do you want for lunch?', distractors: ['here', 'small'] },
  girl: { sentence: 'The ___ carried a yellow umbrella.', distractors: ['were', 'what'] },
  here: { sentence: 'Please come over ___.', distractors: ['were', 'want'] },
  by: { sentence: 'Put your backpack ___ the chair.', distractors: ['he', 'what'] },
  want: { sentence: 'I ___ to read this book.', distractors: ['were', 'by'] },
  put: { sentence: 'Please ___ the book on the table.', distractors: ['why', 'blue'] },
  why: { sentence: '___ did the dog bark?', distractors: ['blue', 'for'] },
  blue: { sentence: 'The clear daytime sky looks ___.', distractors: ['help', 'for'] },
  help: { sentence: 'Can you ___ me carry this box?', distractors: ['blue', 'for'] },
  for: { sentence: 'This gift is ___ Mom.', distractors: ['blue', 'help'] },
  yellow: { sentence: 'The ripe banana is ___.', distractors: ['for', 'both'] },
  both: { sentence: 'Mia and Leo ___ brought lunch.', distractors: ['yellow', 'there'] },
  there: { sentence: 'Set the basket over ___.', distractors: ['yellow', 'or'] },
  even: { sentence: 'The two teams had an ___ score.', distractors: ['there', 'or'] },
  ball: { sentence: 'He kicked the soccer ___.', distractors: ['even', 'both'] },
  or: { sentence: 'Would you like milk ___ water?', distractors: ['there', 'even'] },
  green: { sentence: 'Fresh grass is usually ___.', distractors: ['both', 'or'] },
  how: { sentence: '___ did you solve the puzzle?', distractors: ['green', 'or'] },
  little: { sentence: 'The kitten is still very ___.', distractors: ['how', 'or'] },
  one: { sentence: 'I have ___ apple left.', distractors: ['green', 'how'] },
  see: { sentence: 'I can ___ the moon tonight.', distractors: ['one', 'or'] },
  sounds: { sentence: 'The school bell ___ loud.', distractors: ['see', 'one'] },
  funny: { sentence: 'The joke was very ___.', distractors: ['sounds', 'find'] },
  find: { sentence: 'Can you ___ my missing sock?', distractors: ['funny', 'sounds'] },
  could: { sentence: 'I ___ read that book by myself.', distractors: ['find', 'funny'] },
});

const BASE_SKILLS = [
  {
    id: 'sentence-types',
    subject: 'Reading / ELA',
    label: 'Types of sentences',
    pattern: /types of sentences|statement.*question.*command.*exclamation/i,
    standards: ['CCSS.L.2.1'],
    domain: 'Language',
    studyNotes: ['Practice telling a statement, question, command, and exclamation apart.'],
    question: () => ({
      prompt: 'Which sentence is a question that asks for information?',
      choices: ['Where did the puppy hide?', 'Please close the door.', 'The puppy is under the chair.'],
      answer: 'Where did the puppy hide?',
      explanation: 'A question asks something and ends with a question mark.',
      hint: 'Look for the sentence that is asking something.',
    }),
  },
  {
    id: 'consonant-blends',
    subject: 'Spelling / Handwriting',
    label: 'Consonant blends',
    pattern: /consonant blends?/i,
    standards: ['CCSS.RF.2.3'],
    domain: 'Foundational reading',
    studyNotes: ['Blend the sounds in two-letter consonant blends without adding an extra vowel sound.'],
    question: () => ({
      prompt: 'Which word begins with a two-consonant blend?',
      choices: ['frog', 'apple', 'open'],
      answer: 'frog',
      explanation: 'The word “frog” begins with the blend fr.',
      hint: 'Say the first two sounds in each word slowly.',
    }),
  },
  {
    id: 'cvc-structure',
    subject: 'Reading / ELA',
    label: 'CVC word structure',
    pattern: /\bcvc\b|consonant[- ]vowel[- ]consonant/i,
    standards: ['CCSS.RF.2.3'],
    domain: 'Foundational reading',
    studyNotes: ['For CVC words, look for a consonant-vowel-consonant pattern such as map or sit.'],
    question: () => ({
      prompt: 'Which word follows a consonant-vowel-consonant (CVC) pattern?',
      choices: ['map', 'rain', 'boat'],
      answer: 'map',
      explanation: 'Map is m-a-p: consonant, vowel, consonant.',
      hint: 'Check the three letters and name each as consonant or vowel.',
    }),
  },
  {
    id: 'long-short-a',
    subject: 'Spelling / Handwriting',
    label: 'Long a and short a',
    pattern: /long a|short a|\ba_e\b/i,
    standards: ['CCSS.RF.2.3'],
    domain: 'Foundational reading',
    studyNotes: ['Compare short a words like cat with a_e long-a words like game.'],
    question: () => ({
      prompt: 'Which word has a long a sound because of the a_e pattern?',
      choices: ['game', 'cat', 'map'],
      answer: 'game',
      explanation: 'The silent e in game helps the a say its long sound.',
      hint: 'Look for an a, then a consonant, then a silent e.',
    }),
  },
  {
    id: 'suffix-ed-ing',
    subject: 'Reading / ELA',
    label: 'Adding -ed and -ing',
    pattern: /adding\s+-?ed.*-?ing|-ed,\s*-ing|\b-ed\b.*\b-ing\b/i,
    standards: ['CCSS.RF.2.3.d'],
    domain: 'Foundational reading',
    studyNotes: ['Practice building words by adding -ed and -ing to a base word.'],
    question: () => ({
      prompt: 'Which word correctly adds -ing to the base word jump?',
      choices: ['jumping', 'jumpeding', 'jumpsing'],
      answer: 'jumping',
      explanation: 'Jump + ing makes jumping.',
      hint: 'Keep the base word jump and add the ending -ing.',
    }),
  },
  {
    id: 'suffix-s-es',
    subject: 'Reading / ELA',
    label: 'Adding -s and -es',
    pattern: /adding\s+-?s.*-?es|\b-s\b.*\b-es\b/i,
    standards: ['CCSS.L.2.1.b'],
    domain: 'Language',
    studyNotes: ['Practice choosing -s or -es when making regular plural words.'],
    question: () => ({
      prompt: 'Which word correctly shows more than one box?',
      choices: ['boxes', 'boxs', 'boxeses'],
      answer: 'boxes',
      explanation: 'Words ending in x usually add -es, so box becomes boxes.',
      hint: 'Say the plural aloud and listen for the extra syllable.',
    }),
  },
  {
    id: 'theme',
    subject: 'Reading / ELA',
    label: 'Theme',
    pattern: /\btheme\b/i,
    standards: ['CCSS.RL.2.2'],
    domain: 'Analyzing literary text',
    studyNotes: ['For theme, ask what lesson or message the whole story shows.'],
    question: () => ({
      prompt: 'Nora sees a new student alone at recess and invites him to play. What theme fits best?',
      choices: ['Kindness can help people feel included.', 'Recess should always be quiet.', 'New students should play alone.'],
      answer: 'Kindness can help people feel included.',
      explanation: 'Nora’s kind action shows the message that including others matters.',
      hint: 'Choose the lesson shown by Nora’s action.',
    }),
  },
  {
    id: 'visualize',
    subject: 'Reading / ELA',
    label: 'Visualize',
    pattern: /\bvisualize\b/i,
    standards: ['CCSS.RL.2.1'],
    domain: 'Comprehension / constructing meaning',
    studyNotes: ['Visualize by using story details to make a clear mental picture.'],
    question: () => ({
      prompt: 'The author says, “Snow covered the red sled and sparkled in the morning sun.” What should you visualize?',
      choices: ['A snowy red sled shining in sunlight', 'A dark room with no windows', 'A boat floating on a lake'],
      answer: 'A snowy red sled shining in sunlight',
      explanation: 'The sentence gives details about snow, a red sled, and sunlight.',
      hint: 'Use only the picture details the sentence gives you.',
    }),
  },
  {
    id: 'dialogue',
    subject: 'Reading / ELA',
    label: 'Dialogue',
    pattern: /\bdialogue\b|quotation marks?|characters? (?:say|speak|talk)/i,
    standards: ['CCSS.RL.2.6'],
    domain: 'Analyzing literary text',
    studyNotes: ['Dialogue is the exact speech of characters; quotation marks help show the words they say.'],
    question: () => ({
      prompt: 'Read: “Can I borrow the blue marker?” Maya asked. “Sure,” Eli said. Which words are dialogue?',
      choices: ['“Can I borrow the blue marker?”', 'Maya asked.', 'blue marker'],
      answer: '“Can I borrow the blue marker?”',
      explanation: 'Dialogue is the exact speech of characters, shown here inside quotation marks.',
      hint: 'Look for the exact words a character says.',
    }),
  },
  {
    id: 'sequence',
    subject: 'Reading / ELA',
    label: 'Sequence / beginning, middle, end',
    pattern: /\bsequence\b|plot.*beginning.*middle.*end|beginning.*middle.*end/i,
    standards: ['CCSS.RL.2.5'],
    domain: 'Comprehension / constructing meaning',
    studyNotes: ['Sequence means putting events in the order they happen; beginning, middle, and end describe story order.'],
    evidenceContract: {
      evidenceType: 'DIRECT_TARGET',
      supports: ['sequence'],
      strongestClaim: 'orders-one-validated-dependency-chain',
      doesNotClaim: ['global-reading-comprehension', 'longer-unseen-narrative-sequencing'],
    },
    question: () => ({
      prompt: 'First Ava pours water into an ice tray. Next she puts the tray in the freezer. Later the water becomes ice. What happens immediately before the water becomes ice?',
      choices: ['She puts the tray in the freezer.', 'She pours water into the tray.', 'She takes the ice outside.'],
      answer: 'She puts the tray in the freezer.',
      explanation: 'The tray goes into the freezer directly before the water becomes ice.',
      hint: 'Follow the events in order and choose the step just before the last event.',
      questionType: 'direct',
      dok: 2,
      difficulty: 2,
    }),
  },
  {
    id: 'caption',
    subject: 'Reading / ELA',
    label: 'Captions / text features',
    pattern: /\bcaptions?\b|text features?/i,
    standards: ['CCSS.RI.2.5'],
    domain: 'Informational text features',
    studyNotes: ['A caption is a short text feature that explains or describes a picture, photograph, or diagram.'],
    evidenceContract: {
      evidenceType: 'DIRECT_TARGET',
      supports: ['caption'],
      strongestClaim: 'caption-function-or-described-scene-selection',
      doesNotClaim: ['caption-writing', 'real-image-interpretation'],
    },
    question: () => ({
      prompt: 'A science page shows a photo of a ladybug resting on a green leaf. Which sentence works best as the caption?',
      choices: ['A ladybug rests on a green leaf.', 'Ladybugs are always the biggest insects.', 'The page has many words.'],
      answer: 'A ladybug rests on a green leaf.',
      explanation: 'A caption should clearly describe or explain what the picture shows.',
      hint: 'Choose the sentence that directly matches the pictured scene described in the question.',
      questionType: 'direct',
      dok: 2,
      difficulty: 2,
    }),
  },
  {
    id: 'inference',
    subject: 'Reading / ELA',
    label: 'Inference',
    pattern: /\binfer(?:ence|ring)?\b/i,
    standards: ['CCSS.RL.2.1'],
    domain: 'Comprehension / constructing meaning',
    studyNotes: ['Make an inference by combining text clues with what you already know.'],
    question: () => ({
      prompt: 'Leo puts on boots, grabs an umbrella, and sees dark clouds outside. What can you infer?',
      choices: ['It may be raining or about to rain.', 'It is a hot beach day.', 'Leo is getting ready for bed.'],
      answer: 'It may be raining or about to rain.',
      explanation: 'Boots, an umbrella, and dark clouds are clues that point to rain.',
      hint: 'Combine all three clues before choosing.',
    }),
  },
  {
    id: 'cause-effect',
    subject: 'Reading / ELA',
    label: 'Cause and effect',
    pattern: /cause\s*(?:\/|&|and)?\s*effect/i,
    standards: ['CCSS.RI.2.3'],
    domain: 'Comprehension / constructing meaning',
    studyNotes: ['For cause and effect, identify what happened first and what happened because of it.'],
    question: () => ({
      prompt: 'The ice cream sat in the sun for ten minutes, so it melted. What caused the melting?',
      choices: ['It sat in the sun.', 'It was in a bowl.', 'Someone bought it.'],
      answer: 'It sat in the sun.',
      explanation: 'Sitting in the sun is the cause; melting is the effect.',
      hint: 'Ask what happened first that made the change happen.',
    }),
  },
  {
    id: 'main-character',
    subject: 'Reading / ELA',
    label: 'Main character',
    pattern: /main character/i,
    standards: ['CCSS.RL.2.3'],
    domain: 'Analyzing literary text',
    studyNotes: ['The main character is the person or animal the story mostly follows.'],
    question: () => ({
      prompt: 'A story follows Maya as she loses her mitten, searches the playground, and finally finds it. Who is the main character?',
      choices: ['Maya', 'the mitten', 'the playground'],
      answer: 'Maya',
      explanation: 'The story mostly follows Maya and what she does.',
      hint: 'Choose the person the story follows from beginning to end.',
    }),
  },
  {
    id: 'setting',
    subject: 'Reading / ELA',
    label: 'Setting',
    pattern: /\bsetting\b/i,
    standards: ['CCSS.RL.2.3'],
    domain: 'Analyzing literary text',
    studyNotes: ['Setting tells where and when a story happens.'],
    question: () => ({
      prompt: 'The story begins in a classroom on Monday morning. Which detail describes the setting?',
      choices: ['a classroom on Monday morning', 'the teacher feels excited', 'a student drops a pencil'],
      answer: 'a classroom on Monday morning',
      explanation: 'Setting tells the place and time of a story.',
      hint: 'Look for where and when.',
    }),
  },
  {
    id: 'character-feelings',
    subject: 'Reading / ELA',
    label: 'Character feelings',
    pattern: /character feelings?|how .* feels?/i,
    standards: ['CCSS.RL.2.3'],
    domain: 'Analyzing literary text',
    studyNotes: ['Use a character’s words and actions as clues to how the character feels.'],
    question: () => ({
      prompt: 'Jada smiles, claps, and runs to show her family the ribbon she won. How does Jada most likely feel?',
      choices: ['proud and excited', 'angry and bored', 'sleepy and confused'],
      answer: 'proud and excited',
      explanation: 'Smiling, clapping, and showing the ribbon are clues that Jada feels proud and excited.',
      hint: 'Use the character’s actions as feeling clues.',
    }),
  },
  {
    id: 'genre',
    subject: 'Reading / ELA',
    label: 'Genre',
    pattern: /\bgenre\b/i,
    standards: ['CCSS.RL.2.5'],
    domain: 'Analyzing literary text',
    studyNotes: ['Genre describes the kind of text, such as realistic fiction, fantasy, poetry, or informational text.'],
    question: () => ({
      prompt: 'A story has talking dragons, magic doors, and an invented kingdom. Which genre fits best?',
      choices: ['fantasy', 'informational text', 'biography'],
      answer: 'fantasy',
      explanation: 'Magic and impossible creatures are common features of fantasy.',
      hint: 'Look for details that could not happen in real life.',
    }),
  },
];

const RELIGION_SKILLS = [
  {
    id: 'religion-trinity',
    label: 'The Trinity',
    pattern: /\btrinity\b|father,\s*son,\s*holy spirit/i,
    studyNotes: ['Remember: the Trinity is three Persons in one God — Father, Son, and Holy Spirit.'],
    question: {
      prompt: 'According to the current Religion lesson, which answer names the three Persons of the Trinity?',
      choices: ['Father, Son, and Holy Spirit', 'Abraham, Moses, and David', 'Faith, hope, and love'],
      sourceMode: 'STRICT_SOURCE',
      supportType: 'explicit',
      answer: 'Father, Son, and Holy Spirit',
      explanation: 'The Trinity is Father, Son, and Holy Spirit: three Persons in one God.',
      hint: 'Think of the words used when making the Sign of the Cross.',
    },
  },
  {
    id: 'religion-image-likeness',
    label: "Made in God's image and likeness",
    pattern: /image and likeness|made in god'?s image/i,
    studyNotes: ["Being made in God's image means people can think, choose, and love."],
    question: {
      prompt: "Which action best applies the current Religion lesson about thinking, choosing, and loving?",
      choices: ['Helping a classmate after deciding it is the kind thing to do', 'Knocking over blocks on purpose', 'Ignoring someone who needs help'],
      sourceMode: 'CURATED_CONTEXT',
      answer: 'Helping a classmate after deciding it is the kind thing to do',
      explanation: 'Thinking, choosing what is good, and loving others are ways people use gifts from God.',
      hint: 'Choose the action that combines a good choice with love for another person.',
    },
  },
  {
    id: 'religion-creation-care',
    label: "Caring for God's creation",
    pattern: /take care of god'?s gifts of creation|care for creation|gift of creation/i,
    studyNotes: ["Caring for creation is one way to show gratitude for God's gifts."],
    question: {
      prompt: "Which action best applies the current Religion lesson about caring for God's creation?",
      choices: ['Picking up litter at the park', 'Leaving trash beside a stream', 'Breaking branches for no reason'],
      sourceMode: 'CURATED_CONTEXT',
      answer: 'Picking up litter at the park',
      explanation: "Caring for the world around us shows respect for God's gift of creation.",
      hint: 'Choose the action that protects rather than harms creation.',
    },
  },
  {
    id: 'religion-jesus-savior',
    label: 'Jesus our Savior',
    pattern: /jesus died for our sins|our savior|new life of grace/i,
    studyNotes: ['Jesus is our Savior; class notes connect his death and Resurrection with new life in grace.'],
    question: {
      prompt: 'According to the current Religion lesson, why is Jesus called our Savior?',
      choices: ['He died for our sins and gives us new life in grace.', 'He invented the seasons.', 'He wrote every book in the Bible by hand.'],
      sourceMode: 'STRICT_SOURCE',
      supportType: 'explicit',
      answer: 'He died for our sins and gives us new life in grace.',
      explanation: 'The Religion lesson teaches that Jesus died for our sins and gives us new life in grace.',
      hint: 'Use the class note about Jesus, sin, and grace.',
    },
  },
  {
    id: 'religion-disciples',
    label: 'Disciples: friends and followers of Jesus',
    pattern: /\bdisciples\b|friends? of jesus|followers? of jesus/i,
    studyNotes: ['The current Religion lesson calls disciples friends and followers of Jesus.'],
    question: {
      prompt: 'According to the current Religion lesson, what are friends and followers of Jesus called?',
      choices: ['disciples', 'captions', 'consonant blends'],
      answer: 'disciples',
      explanation: 'The current lesson says disciples are friends and followers of Jesus.',
      hint: 'Use the exact Religion word for a friend and follower of Jesus.',
      sourceMode: 'STRICT_SOURCE',
      supportType: 'explicit',
      dok: 1,
      difficulty: 2,
    },
  },
  {
    id: 'religion-mary-church',
    label: 'Mary: Jesus’ mother and mother of the Church',
    pattern: /mary is jesus'? mother|mother of the church|mary.*mother.*church/i,
    studyNotes: ['The current Religion lesson identifies Mary as Jesus’ mother and the mother of the Church.'],
    question: {
      prompt: 'According to the current Religion lesson, who is identified as Jesus’ mother and the mother of the Church?',
      choices: ['Mary', 'Martha', 'Ruth'],
      answer: 'Mary',
      explanation: 'The current lesson identifies Mary as Jesus’ mother and the mother of the Church.',
      hint: 'Use the person named in the current Religion note.',
      sourceMode: 'STRICT_SOURCE',
      supportType: 'explicit',
      dok: 1,
      difficulty: 2,
    },
  },
  {
    id: 'religion-seed-new-life',
    label: 'Seed analogy and new life in grace',
    pattern: /jesus is like a seed|seed dies.*new plant|seed.*new life.*grace/i,
    studyNotes: ['The current Religion lesson compares a seed dying so a new plant can grow with Jesus dying so we can have new life in grace.'],
    question: {
      prompt: 'According to the current Religion lesson, what comparison is made between a seed and Jesus?',
      choices: ['A seed dies so new life can grow, and Jesus died so we can have new life in grace.', 'A seed never changes, and Jesus teaches that nothing changes.', 'A seed is used only to explain the five senses.'],
      answer: 'A seed dies so new life can grow, and Jesus died so we can have new life in grace.',
      explanation: 'The lesson uses the seed’s new growth as a comparison for new life in grace through Jesus.',
      hint: 'Connect the seed becoming new growth with the lesson’s phrase about new life in grace.',
      sourceMode: 'STRICT_SOURCE',
      supportType: 'explicit',
      dok: 2,
      difficulty: 2,
    },
  },
  {
    id: 'religion-five-senses',
    label: 'Five senses and God’s gifts',
    pattern: /\bfive senses\b|\bour senses\b|seeing.*hearing|hearing.*smelling|smelling.*tasting|tasting.*touching/i,
    studyNotes: ['The current Religion lesson connects our senses with noticing and enjoying God’s gifts of creation.'],
    question: {
      prompt: 'According to the current Religion lesson, how can our five senses help us appreciate God’s gifts?',
      choices: ['They help us notice and enjoy the world around us.', 'They mean we never need to make choices.', 'They are useful only during school lessons.'],
      answer: 'They help us notice and enjoy the world around us.',
      explanation: 'The lesson connects our senses with enjoying God’s gifts and giving thanks for creation.',
      hint: 'Think about seeing, hearing, smelling, tasting, and touching.',
      sourceMode: 'STRICT_SOURCE',
      supportType: 'explicit',
      dok: 2,
      difficulty: 2,
    },
  },
  {
    id: 'religion-gifts-choices',
    label: 'Gifts and good choices',
    pattern: /gifts from god|we can think,\s*choose,\s*love|giver of gifts/i,
    studyNotes: ["God's gifts call us to make loving and responsible choices."],
    question: {
      prompt: 'Which choice best applies the current Religion lesson about using gifts responsibly?',
      choices: ['Using your abilities to help someone who needs support', 'Refusing to share because a gift is only for you', 'Damaging something another person needs'],
      sourceMode: 'CURATED_CONTEXT',
      answer: 'Using your abilities to help someone who needs support',
      explanation: 'Using gifts to love and help others is a responsible choice.',
      hint: 'Choose the action that uses a gift for good.',
    },
  },
];


const SUPPLEMENTAL_QUESTION_FAMILIES = Object.freeze({
  'sentence-types': [
    {
      questionType: 'transfer',
      prompt: 'What type of sentence is “Watch out for that puddle!”?',
      choices: ['exclamation', 'question', 'statement'],
      answer: 'exclamation',
      explanation: 'The sentence shows strong feeling and ends with an exclamation mark.',
      hint: 'Ask whether the sentence tells, asks, directs, or shows strong feeling.',
      dok: 1,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Which pair has a statement first and a command second?',
      choices: ['The paint is wet. — Do not touch it.', 'Is the paint wet? — The paint is wet.', 'Do not touch it. — Is the paint wet?'],
      answer: 'The paint is wet. — Do not touch it.',
      explanation: 'The first sentence tells information; the second gives a direction.',
      hint: 'Classify what each sentence is doing before choosing the pair.',
      dok: 3,
      difficulty: 3,
    },
  ],
  'consonant-blends': [
    {
      questionType: 'transfer',
      prompt: 'Which word begins with the same consonant blend as “flag”?',
      choices: ['flower', 'frog', 'apple'],
      answer: 'flower',
      explanation: 'Flag and flower both begin with the blend fl.',
      hint: 'Say the first two consonant sounds in each word.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why does the beginning of “stop” count as a consonant blend?',
      choices: ['You can hear both the s and t sounds.', 'The word has a short vowel.', 'The word ends with two consonants.'],
      answer: 'You can hear both the s and t sounds.',
      explanation: 'In a consonant blend, both consonant sounds are heard.',
      hint: 'Listen to the beginning of the word and count the sounds you can hear.',
      dok: 3,
      difficulty: 3,
    },
  ],
  'cvc-structure': [
    {
      questionType: 'transfer',
      prompt: 'Which new word follows the same CVC structure as “map”?',
      choices: ['sun', 'rain', 'cake'],
      answer: 'sun',
      explanation: 'Sun is s-u-n: consonant, vowel, consonant.',
      hint: 'Check each letter type from left to right.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why is “cake” not a simple three-letter CVC word?',
      choices: ['It has a fourth letter and a final e.', 'It begins with a consonant.', 'It contains the letter a.'],
      answer: 'It has a fourth letter and a final e.',
      explanation: 'A simple CVC word has exactly three letters in consonant-vowel-consonant order.',
      hint: 'Compare the number and type of letters with a three-letter CVC pattern.',
      dok: 3,
      difficulty: 3,
    },
  ],
  'long-short-a': [
    {
      questionType: 'transfer',
      prompt: 'Which pair of words both use the short a sound?',
      choices: ['cat and map', 'cake and game', 'late and cap'],
      answer: 'cat and map',
      explanation: 'Both cat and map use the short a sound.',
      hint: 'Check the vowel sound in both words in each pair.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why does the a in “game” have a long sound?',
      choices: ['The final e helps the a say its name.', 'The g makes every vowel long.', 'Every four-letter word has a long vowel.'],
      answer: 'The final e helps the a say its name.',
      explanation: 'Game follows the a_e pattern in which the final e changes the a sound.',
      hint: 'Look at the vowel-consonant-final-e pattern.',
      dok: 3,
      difficulty: 3,
    },
  ],
  'suffix-ed-ing': [
    {
      questionType: 'transfer',
      prompt: 'Which word correctly completes the sentence “Mia is ___ at recess right now”?',
      choices: ['jumping', 'jumped', 'jumps'],
      answer: 'jumping',
      explanation: 'The words “right now” show that the action is happening, so jumping fits.',
      hint: 'Use the time clue in the sentence to choose the ending.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'What does adding -ed or -ing usually help show about an action word?',
      choices: ['When or how the action is happening', 'That the word names a person', 'That the base word has no meaning'],
      answer: 'When or how the action is happening',
      explanation: 'The endings -ed and -ing change how the action is described while keeping the base action idea.',
      hint: 'Compare a word such as played with playing.',
      dok: 3,
      difficulty: 3,
    },
  ],
  theme: [
    {
      questionType: 'transfer',
      prompt: 'Evan keeps changing one fold on his paper airplane until it finally flies. Which theme fits best?',
      choices: ['Keep trying and learn from mistakes.', 'Only easy tasks are worth doing.', 'Stop after the first mistake.'],
      answer: 'Keep trying and learn from mistakes.',
      explanation: 'Evan improves by continuing to try and learning from each attempt.',
      hint: 'Choose the lesson shown by the whole situation.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why is “Keep trying and learn from mistakes” a stronger theme than “Paper airplanes can fly”?',
      choices: ['It states a lesson shown by the character’s actions.', 'It repeats one object from the story.', 'It describes only where the story happens.'],
      answer: 'It states a lesson shown by the character’s actions.',
      explanation: 'A theme is a broader lesson or message, not just a fact or detail from the story.',
      hint: 'Ask which choice could apply beyond this one story.',
      dok: 3,
      difficulty: 3,
    },
  ],
  visualize: [
    {
      questionType: 'transfer',
      prompt: 'Read: “Tiny raindrops tapped the window while gray clouds covered the sky.” Which picture best matches?',
      choices: ['A gray rainy scene outside a window', 'A bright beach with large waves', 'A sunny playground with no clouds'],
      answer: 'A gray rainy scene outside a window',
      explanation: 'The words raindrops, window, and gray clouds create that mental picture.',
      hint: 'Match the picture to the exact describing words.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Which detail is most important for visualizing “golden leaves covered the path like a crunchy blanket”?',
      choices: ['The path is covered with golden leaves.', 'Someone may walk later.', 'The sentence has many words.'],
      answer: 'The path is covered with golden leaves.',
      explanation: 'Color and where the leaves are located are concrete details that build the mental picture.',
      hint: 'Choose a detail you could actually picture in your mind.',
      dok: 3,
      difficulty: 3,
    },
  ],
  dialogue: [
    {
      questionType: 'transfer',
      prompt: 'Which part of this sentence is dialogue: “I found my book!” Lena shouted.',
      choices: ['“I found my book!”', 'Lena shouted.', 'my book'],
      answer: '“I found my book!”',
      explanation: 'Dialogue is the exact speech of a character and is shown inside quotation marks.',
      hint: 'Look for the words the character actually says.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why do quotation marks help a reader recognize dialogue?',
      choices: ['They show the exact words a character says.', 'They show where the story takes place.', 'They tell how many paragraphs are in a story.'],
      answer: 'They show the exact words a character says.',
      explanation: 'Quotation marks separate a character’s spoken words from the narration around them.',
      hint: 'Think about what information quotation marks surround.',
      dok: 3,
      difficulty: 3,
    },
  ],
  inference: [
    {
      questionType: 'transfer',
      prompt: 'Mia carries a flashlight into a dark closet and checks behind every box. What can you infer?',
      choices: ['She is searching for something.', 'She is getting ready to sleep.', 'She is watering plants.'],
      answer: 'She is searching for something.',
      explanation: 'Using a flashlight and checking behind boxes are clues that Mia is looking for something.',
      hint: 'Combine more than one clue from the sentence.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Which clue best supports the inference that Mia is searching for something?',
      choices: ['She checks behind every box.', 'The closet is dark.', 'Her name is Mia.'],
      answer: 'She checks behind every box.',
      explanation: 'Checking behind every box most directly shows an active search.',
      hint: 'Choose the clue that most directly proves the inference.',
      dok: 3,
      difficulty: 3,
    },
  ],
  'subtraction-within-12': [
    {
      questionType: 'direct',
      prompt: 'What is the difference in 12 - 5?',
      choices: ['7', '6', '8'],
      answer: '7',
      explanation: 'Twelve take away five leaves seven.',
      hint: 'Start at 12 and count back 5.',
      dok: 1,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Which addition fact is the best check for 12 - 5 = 7?',
      choices: ['7 + 5 = 12', '12 + 5 = 17', '7 + 12 = 19'],
      answer: '7 + 5 = 12',
      explanation: 'Addition can check subtraction because the difference plus the amount taken away should equal the starting number.',
      hint: 'Use the same three numbers to build the related addition fact.',
      dok: 3,
      difficulty: 3,
    },
  ],
  'religion-trinity': [
    {
      questionType: 'reasoning',
      prompt: 'According to the current Religion lesson, which statement best explains the Trinity?',
      choices: ['One God in three Persons: Father, Son, and Holy Spirit.', 'Three unrelated gods with separate roles.', 'One person with three unrelated names.'],
      answer: 'One God in three Persons: Father, Son, and Holy Spirit.',
      explanation: 'The current lesson describes the Trinity as one God in three Persons.',
      hint: 'Keep both parts of the lesson together: one God and three Persons.',
      sourceMode: 'STRICT_SOURCE',
      supportType: 'explicit',
      dok: 2,
      difficulty: 2,
    },
  ],
  'religion-creation-care': [
    {
      questionType: 'transfer',
      prompt: 'Which choice best applies the current Religion lesson about caring for creation?',
      choices: ['Turning off running water after washing your hands', 'Leaving trash beside a stream', 'Breaking plants for fun'],
      answer: 'Turning off running water after washing your hands',
      explanation: 'Protecting resources is one way to care for creation responsibly.',
      hint: 'Choose the action that protects rather than wastes or harms.',
      sourceMode: 'CURATED_CONTEXT',
      dok: 2,
      difficulty: 2,
    },
  ],
  'religion-gifts-choices': [
    {
      questionType: 'direct',
      prompt: 'According to the current Religion lesson about gifts from God, which choice best matches the lesson?',
      choices: ['God is the giver of gifts.', 'Gifts should never be used to help anyone.', 'Only school supplies can be gifts.'],
      answer: 'God is the giver of gifts.',
      explanation: 'The current lesson identifies God as the giver of gifts.',
      hint: 'Use the exact idea named in the current Religion material about gifts.',
      sourceMode: 'STRICT_SOURCE',
      supportType: 'explicit',
      dok: 1,
      difficulty: 2,
    },
  ],
  'religion-disciples': [
    {
      questionType: 'reasoning',
      prompt: 'According to the current Religion lesson, which statement best describes a disciple?',
      choices: ['A disciple is a friend and follower of Jesus.', 'A disciple is another name for a school subject.', 'A disciple is a type of text feature.'],
      answer: 'A disciple is a friend and follower of Jesus.',
      explanation: 'The lesson defines disciples as friends and followers of Jesus.',
      hint: 'Use the lesson’s relationship between disciples and Jesus.',
      sourceMode: 'STRICT_SOURCE',
      supportType: 'explicit',
      dok: 2,
      difficulty: 2,
    },
  ],
  'religion-mary-church': [
    {
      questionType: 'reasoning',
      prompt: 'Which statement about Mary matches the current Religion lesson?',
      choices: ['Mary is Jesus’ mother and the mother of the Church.', 'Mary is one of the three Persons of the Trinity.', 'Mary is the name of the current Reading story.'],
      answer: 'Mary is Jesus’ mother and the mother of the Church.',
      explanation: 'That statement matches the current Religion lesson exactly.',
      hint: 'Use the titles for Mary stated in the current lesson.',
      sourceMode: 'STRICT_SOURCE',
      supportType: 'explicit',
      dok: 2,
      difficulty: 2,
    },
  ],
  'religion-seed-new-life': [
    {
      questionType: 'reasoning',
      prompt: 'Why does the current Religion lesson compare Jesus with a seed that dies and then produces new growth?',
      choices: ['The comparison connects death with new life in grace.', 'The comparison teaches that plants are one Person of the Trinity.', 'The comparison explains how to spell the word seed.'],
      answer: 'The comparison connects death with new life in grace.',
      explanation: 'The lesson connects the seed’s new growth with Jesus giving us new life in grace.',
      hint: 'Focus on what comes after the seed dies and on the lesson’s phrase “new life in grace.”',
      sourceMode: 'STRICT_SOURCE',
      supportType: 'explicit',
      dok: 3,
      difficulty: 3,
    },
  ],
  sequence: [
    {
      questionType: 'transfer',
      prompt: 'Which sequence has one clear cause-and-effect order?',
      choices: ['Put water in an ice tray → place it in a freezer → the water freezes', 'The water freezes → put water in a tray → place it in a freezer', 'Place an empty tray in a freezer → the water freezes → pour in water'],
      answer: 'Put water in an ice tray → place it in a freezer → the water freezes',
      explanation: 'The water must be in the tray before it can freeze there.',
      hint: 'Choose the order in which each step makes the next step possible.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why is “put on socks → put on shoes → tie the laces” a stronger sequence than “put on shoes → put on socks → tie the laces”?',
      choices: ['The steps have a necessary order because socks go on before shoes.', 'The first sequence has more words.', 'Any order works exactly the same.'],
      answer: 'The steps have a necessary order because socks go on before shoes.',
      explanation: 'A strong sequence uses events whose order is supported by a real dependency.',
      hint: 'Ask whether changing the order would make a step impossible or incorrect.',
      dok: 3,
      difficulty: 3,
    },
  ],
  caption: [
    {
      questionType: 'transfer',
      prompt: 'A page shows a picture of three chicks following a hen across a barnyard. Which caption best matches the picture?',
      choices: ['Three chicks follow a hen across the barnyard.', 'Chickens can live for many years.', 'The farmer owns a red tractor.'],
      answer: 'Three chicks follow a hen across the barnyard.',
      explanation: 'The best caption directly describes the important action shown in the picture.',
      hint: 'Choose the sentence that matches the pictured scene described in the question.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why is “A red kite flies above the field” a stronger caption for a kite photograph than “It is fun outside”?',
      choices: ['It gives specific information that directly matches the photograph.', 'It uses fewer letters.', 'A caption should never describe what is visible.'],
      answer: 'It gives specific information that directly matches the photograph.',
      explanation: 'A useful caption adds clear information about the picture instead of making a vague statement.',
      hint: 'Choose the reason that connects the caption to the picture most directly.',
      dok: 3,
      difficulty: 3,
    },
  ],
  'suffix-s-es': [
    {
      questionType: 'transfer',
      prompt: 'Which word correctly shows more than one dish?',
      choices: ['dishes', 'dishs', 'disheses'],
      answer: 'dishes',
      explanation: 'Dish ends with sh, so the plural is formed by adding -es.',
      hint: 'Words ending in sounds like sh often need -es to make the plural.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why does “boxes” use -es instead of only -s?',
      choices: ['The singular word box ends in x, so -es forms the regular plural.', 'Every four-letter word uses -es.', 'The word box is a verb.'],
      answer: 'The singular word box ends in x, so -es forms the regular plural.',
      explanation: 'Regular nouns ending in x commonly add -es to show more than one.',
      hint: 'Look at the ending of the singular noun.',
      dok: 3,
      difficulty: 3,
    },
  ],
  'cause-effect': [
    {
      questionType: 'transfer',
      prompt: 'The plant was not watered for many days, and its leaves drooped. What is the cause?',
      choices: ['The plant was not watered.', 'The leaves drooped.', 'The pot was green.'],
      answer: 'The plant was not watered.',
      explanation: 'Not receiving water happened first and led to the drooping leaves.',
      hint: 'Choose what happened first and made the later event happen.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'In “The sidewalk was icy, so Maya walked slowly,” why is the icy sidewalk the cause?',
      choices: ['It explains why Maya changed how she walked.', 'It happened after Maya arrived home.', 'It tells Maya’s favorite activity.'],
      answer: 'It explains why Maya changed how she walked.',
      explanation: 'The icy condition caused Maya to walk more carefully.',
      hint: 'Ask which detail explains why the other event happened.',
      dok: 3,
      difficulty: 3,
    },
  ],
  'main-character': [
    {
      questionType: 'transfer',
      prompt: 'A story follows Ben as he trains for a race, worries before the start, and celebrates at the finish. Who is the main character?',
      choices: ['Ben', 'the race', 'the finish line'],
      answer: 'Ben',
      explanation: 'The story follows Ben’s actions and feelings across the whole sequence.',
      hint: 'Choose the person the story follows most closely.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why is Ben the main character in a story that follows his problem, choices, and result?',
      choices: ['Most of the important events happen to or because of Ben.', 'His name has three letters.', 'He appears only in the title.'],
      answer: 'Most of the important events happen to or because of Ben.',
      explanation: 'The main character is central to the important events and changes in the story.',
      hint: 'Think about whose actions drive the story.',
      dok: 3,
      difficulty: 3,
    },
  ],
  setting: [
    {
      questionType: 'transfer',
      prompt: 'A story says, “At sunset, the family spread a blanket beside the lake.” Which words tell the setting?',
      choices: ['at sunset beside the lake', 'the family spread', 'a blanket'],
      answer: 'at sunset beside the lake',
      explanation: 'Those words tell both when and where the story is happening.',
      hint: 'Find the place and time clues.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why is “in the school gym on Friday night” a complete setting detail?',
      choices: ['It tells both where and when.', 'It names the main character.', 'It explains the story’s theme.'],
      answer: 'It tells both where and when.',
      explanation: 'Setting includes the place and time in which events happen.',
      hint: 'Check whether the phrase gives a place clue and a time clue.',
      dok: 3,
      difficulty: 3,
    },
  ],
  'character-feelings': [
    {
      questionType: 'transfer',
      prompt: 'Noah hides behind his dad and speaks in a tiny voice before meeting the new coach. How does Noah most likely feel?',
      choices: ['nervous', 'furious', 'proud'],
      answer: 'nervous',
      explanation: 'Hiding and speaking quietly are clues that Noah feels nervous.',
      hint: 'Use the character’s actions as clues to the feeling.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Which detail is the strongest evidence that Ana feels excited about her surprise?',
      choices: ['She jumps up, smiles, and claps.', 'She is standing in a room.', 'The box is on a table.'],
      answer: 'She jumps up, smiles, and claps.',
      explanation: 'Those actions directly show excitement.',
      hint: 'Choose the action that most directly reveals a feeling.',
      dok: 3,
      difficulty: 3,
    },
  ],
  genre: [
    {
      questionType: 'transfer',
      prompt: 'A text explains how bees collect nectar and includes labeled photographs. Which genre fits best?',
      choices: ['informational text', 'fantasy', 'poetry'],
      answer: 'informational text',
      explanation: 'The text gives factual information and labeled photographs about a real topic.',
      hint: 'Ask whether the text is mainly teaching facts, telling an impossible story, or using poetic form.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why does a story with a talking dragon and a magic doorway fit fantasy?',
      choices: ['It includes events and characters that cannot happen in ordinary real life.', 'It contains only true facts and labels.', 'It is written as a list of directions.'],
      answer: 'It includes events and characters that cannot happen in ordinary real life.',
      explanation: 'Fantasy often includes magical or impossible elements.',
      hint: 'Look for features that separate fantasy from realistic or informational text.',
      dok: 3,
      difficulty: 3,
    },
  ],
  'place-value': [
    {
      questionType: 'transfer',
      prompt: 'In the number 582, what value does the digit 8 represent?',
      choices: ['80', '8', '800'],
      answer: '80',
      explanation: 'The 8 is in the tens place, so its value is 80.',
      hint: 'Name the place first: hundreds, tens, ones.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why is the 6 worth 600 in the number 641?',
      choices: ['It is in the hundreds place.', 'It is the first digit written.', 'Every 6 is worth 600.'],
      answer: 'It is in the hundreds place.',
      explanation: 'A digit’s value depends on its place in the number.',
      hint: 'Identify the place occupied by the digit 6.',
      dok: 3,
      difficulty: 3,
    },
  ],
  'compare-numbers': [
    {
      questionType: 'transfer',
      prompt: 'Which comparison is true for 375 and 357?',
      choices: ['375 > 357', '375 < 357', '375 = 357'],
      answer: '375 > 357',
      explanation: 'The hundreds are equal, but 375 has 7 tens while 357 has 5 tens.',
      hint: 'Compare the greatest place first, then move right.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why is 428 greater than 419?',
      choices: ['The hundreds match, and 2 tens is greater than 1 ten.', '8 ones is always more important than hundreds.', 'The numbers have the same digits.'],
      answer: 'The hundreds match, and 2 tens is greater than 1 ten.',
      explanation: 'When hundreds are equal, compare the tens place next.',
      hint: 'Compare hundreds first and tens second.',
      dok: 3,
      difficulty: 3,
    },
  ],
  time: [
    {
      questionType: 'transfer',
      prompt: 'The minute hand points to 9 and the hour hand is between 4 and 5. What time is it?',
      choices: ['4:45', '9:20', '5:45'],
      answer: '4:45',
      explanation: 'A minute hand on 9 means 45 minutes past the hour.',
      hint: 'Count by fives around the clock to find the minutes.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why does a minute hand pointing to 6 mean 30 minutes past the hour?',
      choices: ['Each clock number represents 5 minutes, and 6 × 5 = 30.', 'The number 6 always means 6:00.', 'There are 30 hours in a day.'],
      answer: 'Each clock number represents 5 minutes, and 6 × 5 = 30.',
      explanation: 'Counting by fives to the 6 gives 30 minutes.',
      hint: 'Count the minute marks in groups of five.',
      dok: 3,
      difficulty: 3,
    },
  ],
  money: [
    {
      questionType: 'transfer',
      prompt: 'What is the total value of two dimes and one nickel?',
      choices: ['25¢', '20¢', '30¢'],
      answer: '25¢',
      explanation: 'Two dimes are 20¢ and one nickel is 5¢, for a total of 25¢.',
      hint: 'Name each coin value and then add the cents.',
      dok: 2,
      difficulty: 2,
    },
    {
      questionType: 'reasoning',
      prompt: 'Why do one quarter and two nickels have a total value of 35¢?',
      choices: ['25¢ + 5¢ + 5¢ = 35¢', '25¢ + 10¢ + 10¢ = 45¢', 'A quarter is worth 35¢ by itself.'],
      answer: '25¢ + 5¢ + 5¢ = 35¢',
      explanation: 'A quarter is 25¢ and each nickel is 5¢.',
      hint: 'Write each coin’s value before adding.',
      dok: 3,
      difficulty: 3,
    },
  ],
  'religion-image-likeness': [
    {
      questionType: 'direct',
      prompt: "According to the current Religion lesson, which abilities are connected with being made in God's image and likeness?",
      choices: ['thinking, choosing, and loving', 'running, jumping, and throwing', 'reading, writing, and drawing'],
      answer: 'thinking, choosing, and loving',
      explanation: "The current lesson says people are made in God's image and likeness and can think, choose, and love.",
      hint: 'Use the exact abilities named in the current lesson.',
      sourceMode: 'STRICT_SOURCE',
      supportType: 'explicit',
      dok: 1,
      difficulty: 2,
    },
  ],
  'religion-jesus-savior': [
    {
      questionType: 'direct',
      prompt: 'According to the current Religion lesson, what new life does Jesus give us?',
      choices: ['new life in grace', 'a new school schedule', 'a new set of senses'],
      answer: 'new life in grace',
      explanation: 'The lesson says Jesus gives us new life in grace.',
      hint: 'Use the exact phrase connected with Jesus in the current lesson.',
      sourceMode: 'STRICT_SOURCE',
      supportType: 'explicit',
      dok: 1,
      difficulty: 2,
    },
  ],
  'religion-five-senses': [
    {
      questionType: 'transfer',
      prompt: 'Which choice best applies the current Religion lesson about using our senses to notice God’s gifts of creation?',
      choices: ['Listening to birds and noticing the colors of flowers', 'Ignoring everything around you on purpose', 'Breaking plants to see what happens'],
      answer: 'Listening to birds and noticing the colors of flowers',
      explanation: 'Hearing and seeing can help a person notice and appreciate creation.',
      hint: 'Choose an action that uses the senses to notice the world respectfully.',
      sourceMode: 'CURATED_CONTEXT',
      dok: 2,
      difficulty: 2,
    },
  ],
});

function supplementalQuestionFamily(skill) {
  const staticFamily = SUPPLEMENTAL_QUESTION_FAMILIES[skill.id] || [];
  if (staticFamily.length) return staticFamily;

  const subtraction = String(skill.id || '').match(/^subtraction-within-(\d+)$/);
  if (subtraction) {
    const max = Number(subtraction[1]);
    const start = Math.max(3, Math.min(max, 14));
    const take = Math.max(1, Math.min(5, start - 1));
    const answer = start - take;
    return [
      {
        questionType: 'direct',
        prompt: `Solve this subtraction fact: ${start} - ${take}. What is the difference?`,
        choices: [String(answer), String(answer + 1), String(Math.max(0, answer - 1))],
        answer: String(answer),
        explanation: `${start} take away ${take} leaves ${answer}.`,
        hint: `Start at ${start} and count back ${take}.`,
        dok: 1,
        difficulty: 2,
      },
      {
        questionType: 'reasoning',
        prompt: `Which addition fact correctly checks ${start} - ${take} = ${answer}?`,
        choices: [`${answer} + ${take} = ${start}`, `${start} + ${take} = ${start + take}`, `${answer} + ${start} = ${answer + start}`],
        answer: `${answer} + ${take} = ${start}`,
        explanation: 'The difference plus the amount taken away should equal the starting number.',
        hint: 'Use the same three numbers to build the related addition fact.',
        dok: 3,
        difficulty: 3,
      },
    ];
  }

  const addition = String(skill.id || '').match(/^addition-within-(\d+)$/);
  if (addition) {
    const max = Number(addition[1]);
    const a = Math.max(2, Math.min(7, Math.floor(max / 2)));
    const b = Math.max(2, Math.min(5, max - a));
    const answer = a + b;
    return [
      {
        questionType: 'direct',
        prompt: `Solve this addition fact: ${a} + ${b}. What is the total?`,
        choices: [String(answer), String(Math.max(0, answer - 1)), String(Math.min(max + 1, answer + 1))],
        answer: String(answer),
        explanation: `${a} plus ${b} equals ${answer}.`,
        hint: `Start with ${a} and count on ${b} more.`,
        dok: 1,
        difficulty: 2,
      },
      {
        questionType: 'reasoning',
        prompt: `Which subtraction fact correctly checks ${a} + ${b} = ${answer}?`,
        choices: [`${answer} - ${b} = ${a}`, `${answer} + ${b} = ${answer + b}`, `${a} - ${b} = ${Math.max(0, a - b)}`],
        answer: `${answer} - ${b} = ${a}`,
        explanation: 'Subtracting one addend from the total gives the other addend.',
        hint: 'Use the total and take away one part.',
        dok: 3,
        difficulty: 3,
      },
    ];
  }

  return [];
}

function addSupplementalQuestionFamilies(skills, questions) {
  for (const skill of skills) {
    for (const raw of supplementalQuestionFamily(skill)) questions.push(questionFor(skill, raw));
  }
}

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalize(value) {
  return text(value).toLowerCase();
}

function slug(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function fingerprint(value) {
  let hash = 2166136261 >>> 0;
  for (const ch of String(value ?? '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function balancedChoices(question, index) {
  const choices = [...question.choices];
  const current = choices.indexOf(question.answer);
  const target = index % choices.length;
  if (current < 0 || current === target) return question;
  const [answer] = choices.splice(current, 1);
  choices.splice(target, 0, answer);
  return { ...question, choices };
}

function isPlaceholderVocabularyMeaning(value) {
  const clean = normalize(value);
  return !clean
    || clean.includes('teacher page does not provide a definition')
    || clean.includes('current reading work vocabulary word');
}

function uniqueText(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const clean = text(value);
    const key = normalize(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function subjectRow(pack, name) {
  return (pack?.subjects || []).find(row => normalize(row?.subject) === normalize(name)) || null;
}

function sha256(value) {
  return 'sha256:' + createHash('sha256').update(String(value ?? '')).digest('hex');
}

function normalizedSourcePages(sourcePages) {
  return (Array.isArray(sourcePages) ? sourcePages : []).map(page => ({
    title: text(page?.title),
    url: text(page?.url),
    checkedAt: text(page?.checkedAt),
    contentHash: text(page?.contentHash),
    lines: uniqueText(page?.lines || []),
  })).filter(page => page.title && page.contentHash);
}

function sourcePriority(skill, title) {
  const priorities = skill.subject === 'Religion'
    ? ['Religion']
    : skill.subject === 'Math'
      ? ['Tests', 'Homework']
      : skill.subject === 'Spelling / Handwriting'
        ? ['Weekly Spelling List', 'Reading Work', 'Tests']
        : skill.id === 'sentence-types'
          ? ['Tests', 'Reading Work']
          : ['Reading Work', 'Tests', 'Homework'];
  const index = priorities.indexOf(title);
  return index < 0 ? priorities.length + 1 : index;
}

function pageLineageForSkill(skill, sourcePages, sourceHash) {
  const evidence = uniqueText(skill?.evidence || []);
  const pages = normalizedSourcePages(sourcePages);
  const candidates = pages.map(page => {
    const matchedLines = page.lines.filter(line => {
      const haystack = normalize(line);
      return evidence.some(item => {
        const needle = normalize(item);
        return needle.length >= 3 && (haystack.includes(needle) || needle.includes(haystack));
      });
    });
    return { page, matchedLines, score: matchedLines.length };
  }).filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || sourcePriority(skill, a.page.title) - sourcePriority(skill, b.page.title));

  const match = candidates[0];
  if (!match) {
    return {
      quality: 'unresolved',
      sourceHash: text(sourceHash),
      evidenceExcerptHash: sha256(evidence.join('\n')),
      matchedEvidence: evidence,
    };
  }
  return {
    quality: 'page-exact',
    sourceTitle: match.page.title,
    sourceUrl: match.page.url,
    sourceCaptureHash: match.page.contentHash,
    sourceCheckedAt: match.page.checkedAt,
    evidenceExcerptHash: sha256(match.matchedLines.join('\n')),
    matchedEvidence: match.matchedLines,
  };
}

function attachSourceLineage(skills, questions, { sourcePages, sourceHash } = {}) {
  const bySkill = new Map();
  for (const skill of skills) {
    const lineage = pageLineageForSkill(skill, sourcePages, sourceHash);
    skill.sourceLineage = lineage;
    bySkill.set(skill.id, lineage);
  }
  for (const question of questions) {
    question.sourceLineage = bySkill.get(question.skill) || {
      quality: 'unresolved',
      sourceHash: text(sourceHash),
      evidenceExcerptHash: sha256(question.sourceFact || question.skill || ''),
      matchedEvidence: uniqueText(question.sourceEvidence || []),
    };
  }
}

function subjectText(pack, name) {
  const row = subjectRow(pack, name);
  return uniqueText([...(row?.topics || []), ...(row?.studyNotes || [])]).join(' | ');
}

function addSkill(out, skill) {
  if (!skill?.id || out.some(row => row.id === skill.id)) return;
  out.push({
    id: skill.id,
    subject: skill.subject,
    label: skill.label,
    evidence: uniqueText(skill.evidence || []),
    studyNotes: uniqueText(skill.studyNotes || []),
    standards: [...new Set(skill.standards || [])],
    domain: skill.domain || 'Grade 2',
    sourceBacked: true,
    ...(skill.evidenceContract ? { evidenceContract: structuredClone(skill.evidenceContract) } : {}),
  });
}

function questionFor(skill, raw) {
  if (!raw) return null;
  const choices = (raw.choices || []).map(text);
  const answer = text(raw.answer);
  const sourceMode = raw.sourceMode || skill.sourceMode || (skill.subject === 'Religion' ? 'STRICT_SOURCE' : 'DETERMINISTIC_TEMPLATE');
  const sourceFact = text(raw.sourceFact || `Verified Grade 2 skill: ${skill.label}`);
  const questionId = `auto-${slug(skill.id)}-${slug(answer)}-${fingerprint(raw.prompt).slice(0, 6)}`;
  const diagnostics = {};
  for (const choice of choices) {
    if (choice === answer) continue;
    diagnostics[choice] = {
      misconception: text(raw.misconceptions?.[choice] || `${skill.id}-distractor`),
      feedback: text(raw.wrongFeedback?.[choice] || raw.wrongFeedback || `Recheck the ${skill.label.toLowerCase()} skill and use the clue in the question.`),
    };
  }
  const dok = Number.isInteger(raw.dok) ? raw.dok : 2;
  const difficulty = Number.isInteger(raw.difficulty) ? raw.difficulty : 2;
  return {
    id: questionId,
    templateId: `grade2-${skill.id}-v1`,
    subject: skill.subject,
    skill: skill.id,
    assessedSkillIds: [skill.id],
    prompt: text(raw.prompt),
    choices,
    answer,
    explanation: text(raw.explanation),
    hint: text(raw.hint),
    sourceFact,
    sourceEvidence: uniqueText(skill.evidence || []),
    sourceMode,
    supportType: raw.supportType || 'deterministic_transform',
    provenance: 'verified-abvm-skill-template',
    standards: [...new Set(skill.standards || [])],
    domain: skill.domain || 'Grade 2',
    dok,
    cognitiveDemand: dok === 3 ? 'strategic-reasoning' : dok === 2 ? 'skill-and-concept-application' : 'recall-and-fluency',
    difficulty,
    questionType: raw.questionType || 'direct',
    choiceDiagnostics: diagnostics,
    rubric: {
      maxPoints: 2,
      criteria: [
        'Selects the correct answer using the target Grade 2 skill.',
        'Uses the clue, rule, or evidence required by the item.',
      ],
      partialCredit: Object.fromEntries(Object.keys(diagnostics).map(choice => [choice, 0])),
    },
    evidenceContract: {
      evidenceType: 'DIRECT_TARGET',
      supports: [skill.id],
      strongestClaim: 'practice-performance-on-this-skill',
      doesNotClaim: ['standardized-test-score', 'global-subject-mastery'],
    },
    ...(raw.evidenceContract || skill.evidenceContract ? {
      evidenceContract: structuredClone(raw.evidenceContract || skill.evidenceContract),
    } : {}),
    generatorVersion: 'grade2-content-pipeline-v2-research-recovery',
    contentFingerprint: fingerprint(`${skill.id}|${raw.questionType || 'direct'}|${raw.prompt}`),
    variantFingerprint: fingerprint(`${raw.prompt}|${answer}|${choices.join('|')}`),
    presentationFingerprint: fingerprint(choices.join('|')),
  };
}

function detectBaseSkills(pack, skills, questions) {
  const haystack = [
    subjectText(pack, 'Reading / ELA'),
    subjectText(pack, 'Spelling / Handwriting'),
  ].join(' | ');
  for (const rule of BASE_SKILLS) {
    if (!rule.pattern.test(haystack)) continue;
    const skill = {
      id: rule.id,
      subject: rule.subject,
      label: rule.label,
      evidence: [haystack.match(rule.pattern)?.[0] || rule.label],
      studyNotes: rule.studyNotes,
      standards: rule.standards,
      domain: rule.domain,
      evidenceContract: rule.evidenceContract,
    };
    addSkill(skills, skill);
    questions.push(questionFor(skill, rule.question()));
  }
}

function detectSightWords(pack, skills, questions, coverage) {
  const reading = subjectRow(pack, 'Reading / ELA');
  const sightTopic = (reading?.topics || []).find(topic => /^Sight words\s*:/i.test(text(topic)));
  if (!sightTopic) return;

  const words = uniqueText(text(sightTopic).replace(/^Sight words\s*:/i, '').split(',')).map(word => normalize(word)).filter(Boolean);
  if (!words.length) return;

  const available = new Set(words);
  const candidates = [];
  const uncovered = [];
  for (const word of words) {
    const context = SIGHT_WORD_CONTEXTS[word];
    if (!context || !context.distractors.every(distractor => available.has(distractor))) {
      uncovered.push(word);
      continue;
    }
    candidates.push({ word, ...context });
  }

  if (candidates.length < 2) {
    coverage.push({
      topic: 'Sight / high-frequency words',
      subject: 'Reading / ELA',
      status: 'SOURCE_INSUFFICIENT',
      reason: 'The teacher source provides sight words, but fewer than two have an approved contextual-cloze template with same-construct distractors.',
    });
    return;
  }

  const skill = {
    id: 'high-frequency-word-use',
    subject: 'Reading / ELA',
    label: 'High-frequency words in context',
    evidence: [sightTopic],
    studyNotes: ['Practice current high-frequency words in short sentence contexts. Context-cloze performance does not claim spelling or isolated print-recognition mastery.'],
    standards: ['CCSS.RF.2.3.f'],
    domain: 'Foundational reading',
    sourceMode: 'CURATED_CONTEXT',
    evidenceContract: {
      evidenceType: 'DIRECT_TARGET',
      supports: ['high-frequency-word-use'],
      strongestClaim: 'contextual-high-frequency-word-use',
      doesNotClaim: ['spelling', 'oral-fluency', 'isolated-print-recognition'],
    },
  };
  addSkill(skills, skill);

  for (const row of candidates) {
    questions.push(questionFor(skill, {
      questionType: 'transfer',
      prompt: `Which word correctly completes the sentence? “${row.sentence}”`,
      choices: [row.word, ...row.distractors],
      answer: row.word,
      explanation: `“${row.word}” makes the sentence grammatically complete and meaningful.`,
      hint: 'Read the whole sentence with each choice and choose the word that makes the sentence sound correct and make sense.',
      sourceMode: 'CURATED_CONTEXT',
      sourceFact: `Verified current high-frequency word: ${row.word}`,
      dok: 2,
      difficulty: 2,
    }));
  }

  coverage.push({
    topic: 'Sight / high-frequency words',
    subject: 'Reading / ELA',
    skillId: skill.id,
    status: uncovered.length ? 'PARTIALLY_COVERED' : 'COVERED',
    ...(uncovered.length ? {
      reason: `Approved contextual-cloze templates are not yet available for: ${uncovered.join(', ')}.`,
      uncovered,
    } : {}),
  });
}

function detectMath(pack, skills, questions) {
  const source = subjectText(pack, 'Math');
  let match = source.match(/subtraction\s+(?:to|within)\s+(\d+)/i);
  if (match) {
    const max = Number(match[1]);
    const skill = {
      id: max <= 20 ? `subtraction-within-${max}` : 'subtraction-within-100',
      subject: 'Math',
      label: `Subtraction within ${max}`,
      evidence: [match[0]],
      studyNotes: [`Practice subtraction facts with answers and starting numbers within ${max}.`],
      standards: [max <= 20 ? 'CCSS.2.OA.B.2' : 'CCSS.2.NBT.B.5'],
      domain: 'Numbers and operations',
    };
    addSkill(skills, skill);
    const start = Math.max(8, Math.min(max, 12));
    const take = Math.max(3, Math.min(5, start - 2));
    const answer = start - take;
    questions.push(questionFor(skill, {
      questionType: 'transfer',
      prompt: `Mia has ${start} crayons and gives ${take} away. How many crayons does she have left?`,
      choices: [String(answer), String(answer + 1), String(Math.max(0, answer - 1))],
      answer: String(answer),
      explanation: `${start} - ${take} = ${answer}.`,
      hint: `Start at ${start} and count back ${take}.`,
    }));
  }

  match = source.match(/addition\s+(?:to|within)\s+(\d+)/i);
  if (match) {
    const max = Number(match[1]);
    const skill = {
      id: max <= 20 ? `addition-within-${max}` : 'addition-within-100',
      subject: 'Math',
      label: `Addition within ${max}`,
      evidence: [match[0]],
      studyNotes: [`Practice addition facts with totals within ${max}.`],
      standards: [max <= 20 ? 'CCSS.2.OA.B.2' : 'CCSS.2.NBT.B.5'],
      domain: 'Numbers and operations',
    };
    addSkill(skills, skill);
    const a = Math.max(4, Math.min(9, Math.floor(max / 2)));
    const b = Math.max(3, Math.min(max - a, 6));
    const answer = a + b;
    questions.push(questionFor(skill, {
      questionType: 'transfer',
      prompt: `A basket has ${a} red apples and ${b} green apples. How many apples are there altogether?`,
      choices: [String(answer), String(answer - 1), String(answer + 2)],
      answer: String(answer),
      explanation: `${a} + ${b} = ${answer}.`,
      hint: `Add ${a} and ${b}.`,
    }));
  }

  const additional = [
    {
      id: 'place-value',
      label: 'Place value',
      pattern: /place value/i,
      standards: ['CCSS.2.NBT.A.1'],
      domain: 'Numbers and operations',
      note: 'Use hundreds, tens, and ones to explain the value of each digit.',
      q: {
        prompt: 'In the number 347, what value does the digit 4 represent?',
        choices: ['40', '4', '400'],
        answer: '40',
        explanation: 'The 4 is in the tens place, so its value is 40.',
        hint: 'Read the places from right to left: ones, tens, hundreds.',
      },
    },
    {
      id: 'compare-numbers',
      label: 'Compare numbers',
      pattern: /compare numbers|greater than|less than/i,
      standards: ['CCSS.2.NBT.A.4'],
      domain: 'Numbers and operations',
      note: 'Compare hundreds first, then tens, then ones.',
      q: {
        prompt: 'Which comparison is true?',
        choices: ['462 > 426', '462 < 426', '462 = 426'],
        answer: '462 > 426',
        explanation: 'Both numbers have 4 hundreds, but 462 has 6 tens while 426 has 2 tens.',
        hint: 'Compare the hundreds and then the tens.',
      },
    },
    {
      id: 'time',
      label: 'Tell time',
      pattern: /\btime\b|clock/i,
      standards: ['CCSS.2.MD.C.7'],
      domain: 'Geometry and measurement',
      note: 'Practice reading clocks to the nearest five minutes.',
      q: {
        prompt: 'The minute hand points to 6 and the hour hand is between 3 and 4. What time is it?',
        choices: ['3:30', '6:15', '4:30'],
        answer: '3:30',
        explanation: 'A minute hand on 6 means 30 minutes past the hour.',
        hint: 'Each number on the clock counts as five minutes.',
      },
    },
    {
      id: 'money',
      label: 'Money',
      pattern: /\bmoney\b|coins?|dimes?|nickels?|quarters?/i,
      standards: ['CCSS.2.MD.C.8'],
      domain: 'Geometry and measurement',
      note: 'Count coin values carefully and write the total with a cent sign.',
      q: {
        prompt: 'What is the total value of one quarter and one dime?',
        choices: ['35¢', '25¢', '40¢'],
        answer: '35¢',
        explanation: 'A quarter is 25¢ and a dime is 10¢, so 25¢ + 10¢ = 35¢.',
        hint: 'Add 25 cents and 10 cents.',
      },
    },
  ];
  for (const rule of additional) {
    if (!rule.pattern.test(source)) continue;
    const skill = {
      id: rule.id,
      subject: 'Math',
      label: rule.label,
      evidence: [source.match(rule.pattern)?.[0] || rule.label],
      studyNotes: [rule.note],
      standards: rule.standards,
      domain: rule.domain,
    };
    addSkill(skills, skill);
    questions.push(questionFor(skill, rule.q));
  }
}

function detectReligion(pack, skills, questions) {
  const source = subjectText(pack, 'Religion');
  for (const rule of RELIGION_SKILLS) {
    if (!rule.pattern.test(source)) continue;
    const skill = {
      id: rule.id,
      subject: 'Religion',
      label: rule.label,
      evidence: [source.match(rule.pattern)?.[0] || rule.label],
      studyNotes: rule.studyNotes,
      standards: ['ABVM.RELIGION.CURRENT'],
      domain: 'Religion',
    };
    addSkill(skills, skill);
    questions.push(questionFor(skill, rule.question));
  }
}

function detectVocabulary(pack, skills, questions, coverage) {
  const rows = (pack?.vocabulary || [])
    .map(row => ({
      term: text(row?.term).toLowerCase(),
      meaning: text(row?.meaning),
    }))
    .filter(row => row.term);

  if (!rows.length) return;

  const supported = rows.filter(row => !isPlaceholderVocabularyMeaning(row.meaning));
  if (!supported.length) {
    coverage.push({
      topic: 'Reading / ELA vocabulary definitions',
      subject: 'Reading / ELA',
      status: 'SOURCE_INSUFFICIENT',
      reason: 'Vocabulary terms are present, but the verified teacher source does not provide definitions. Definition questions are intentionally suppressed.',
    });
    return;
  }

  const skill = {
    id: 'vocabulary-in-context',
    subject: 'Reading / ELA',
    label: 'Vocabulary meaning',
    evidence: supported.map(row => `${row.term}: ${row.meaning}`),
    studyNotes: supported.map(row => `${row.term}: ${row.meaning}`),
    standards: ['CCSS.L.2.4.a'],
    domain: 'Word knowledge and skills',
    sourceMode: 'STRICT_SOURCE',
  };
  addSkill(skills, skill);

  for (const row of supported.slice(0, 6)) {
    const distractors = supported
      .filter(other => other.term !== row.term)
      .map(other => other.meaning)
      .filter(Boolean)
      .slice(0, 2);
    if (distractors.length < 2) {
      coverage.push({
        topic: `Vocabulary: ${row.term}`,
        subject: 'Reading / ELA',
        status: 'SOURCE_INSUFFICIENT',
        reason: 'A verified definition exists, but there are not enough same-construct verified distractors for a three-choice item.',
      });
      continue;
    }
    questions.push(questionFor(skill, {
      prompt: `Which meaning matches the vocabulary word “${row.term}”?`,
      choices: [row.meaning, ...distractors],
      answer: row.meaning,
      explanation: `The verified source defines “${row.term}” as ${row.meaning}.`,
      hint: 'Use the verified vocabulary meaning from the current school material.',
      sourceMode: 'STRICT_SOURCE',
      supportType: 'explicit',
      sourceFact: `Verified vocabulary definition: ${row.term} — ${row.meaning}`,
      dok: 1,
      difficulty: 2,
    }));
  }
}


function detectUnsupportedExplicitSkills(pack, coverage) {
  const addUnsupported = (subject, topic) => {
    const clean = text(topic);
    if (!clean || coverage.some(row => row.status === 'GENERATOR_UNSUPPORTED' && normalize(row.topic) === normalize(clean))) return;
    coverage.push({
      topic: clean,
      subject,
      status: 'GENERATOR_UNSUPPORTED',
      reason: 'The verified teacher source names this instructional skill, but the current deterministic generator does not yet have an approved practice template for it.',
    });
  };

  const reading = subjectRow(pack, 'Reading / ELA');
  const readingLines = [...(reading?.topics || []), ...(reading?.studyNotes || [])];
  for (const raw of readingLines) {
    const line = text(raw);
    const comprehension = line.match(/^Reading comprehension:\s*(.+)$/i);
    if (comprehension) {
      for (const item of comprehension[1].split(/\s*[,;]\s*/).map(text).filter(Boolean)) {
        if (!BASE_SKILLS.some(rule => rule.pattern.test(item))) addUnsupported('Reading / ELA', item);
      }
      continue;
    }
    const explicit = line.match(/^(Phonics|Word structure|Grammar):\s*(.+)$/i);
    if (explicit && !BASE_SKILLS.some(rule => rule.pattern.test(explicit[2]))) {
      addUnsupported('Reading / ELA', explicit[2]);
    }
  }

  const readingSubject = subjectRow(pack, 'Reading / ELA');
  for (const topic of readingSubject?.topics || []) {
    if (!/^Story\s*:/i.test(text(topic))) continue;
    coverage.push({
      topic: text(topic),
      subject: 'Reading / ELA',
      status: 'NOT_PRACTICED_BY_DESIGN',
      reason: 'Only the story title is verified here; the pipeline does not invent plot, character, or comprehension facts without passage-level evidence.',
    });
  }

  const spelling = subjectRow(pack, 'Spelling / Handwriting');
  for (const raw of spelling?.topics || []) {
    const line = text(raw);
    const focus = line.match(/(?:test\s+focus|focus):\s*(.+)$/i);
    if (focus && !BASE_SKILLS.some(rule => rule.pattern.test(focus[1]))) {
      addUnsupported('Spelling / Handwriting', focus[1]);
    }
  }

  const religion = subjectRow(pack, 'Religion');
  const religionLines = [...(religion?.topics || []), ...(religion?.studyNotes || [])].map(text).filter(Boolean);
  if (religionLines.some(line => /vine and the branches|vine and branches/i.test(line))) {
    coverage.push({
      topic: 'Parable of the vine and the branches',
      subject: 'Religion',
      status: 'SOURCE_INSUFFICIENT',
      reason: 'The verified source names the parable but does not provide enough passage or lesson detail to generate a defensible skill question without adding outside content.',
    });
  }

  const mathPatterns = [
    /subtraction\s+(?:to|within)\s+\d+/i,
    /addition\s+(?:to|within)\s+\d+/i,
    /place value/i,
    /compare numbers|greater than|less than/i,
    /\btime\b|clock/i,
    /\bmoney\b|coins?|dimes?|nickels?|quarters?/i,
  ];
  const math = subjectRow(pack, 'Math');
  for (const raw of math?.topics || []) {
    const topic = text(raw);
    if (topic && !mathPatterns.some(pattern => pattern.test(topic))) addUnsupported('Math', topic);
  }
}

export function validateGeneratedQuestionSpec(question) {
  const issues = [];
  if (!question || typeof question !== 'object') return ['question-missing'];
  if (!text(question.id)) issues.push('id-missing');
  if (!text(question.subject)) issues.push('subject-missing');
  if (!text(question.skill)) issues.push('skill-missing');
  if (text(question.prompt).length < 20) issues.push('prompt-too-short');
  if (text(question.prompt).length > 320) issues.push('prompt-too-long');
  if (/\b(?:NOT|EXCEPT)\b/.test(question.prompt)) issues.push('negative-stem');
  for (const pattern of FORBIDDEN_QUESTION_PATTERNS) {
    if (pattern.test(question.prompt)) issues.push('forbidden-meta-prompt');
  }
  if (!Array.isArray(question.choices) || question.choices.length !== 3) {
    issues.push('choices-not-three');
  } else {
    if (new Set(question.choices.map(normalize)).size !== 3) issues.push('choices-duplicate');
    if (!question.choices.includes(question.answer)) issues.push('answer-not-in-choices');
  }
  if (!text(question.explanation)) issues.push('explanation-missing');
  if (!text(question.hint)) issues.push('hint-missing');
  if (normalize(question.answer).length >= 4 && normalize(question.hint).includes(normalize(question.answer))) issues.push('hint-leaks-answer');
  if (!['STRICT_SOURCE', 'CURATED_CONTEXT', 'DETERMINISTIC_TEMPLATE'].includes(question.sourceMode)) issues.push('source-mode-invalid');
  if (!text(question.provenance)) issues.push('provenance-missing');
  if (!text(question.contentFingerprint) || !text(question.variantFingerprint) || !text(question.presentationFingerprint)) issues.push('fingerprints-missing');
  if (!question.evidenceContract || question.evidenceContract.evidenceType !== 'DIRECT_TARGET') issues.push('evidence-contract-invalid');
  if (!question.choiceDiagnostics || typeof question.choiceDiagnostics !== 'object') issues.push('choice-diagnostics-missing');
  if (!question.rubric || question.rubric.maxPoints !== 2) issues.push('rubric-invalid');
  if (!Array.isArray(question.standards) || question.standards.length === 0) issues.push('standards-missing');
  if (!text(question.domain)) issues.push('domain-missing');
  if (!Number.isInteger(question.dok) || question.dok < 1 || question.dok > 3) issues.push('dok-invalid');
  if (!Number.isInteger(question.difficulty) || question.difficulty < 1 || question.difficulty > 3) issues.push('difficulty-invalid');
  return [...new Set(issues)];
}

function filterQuestions(rawQuestions) {
  const accepted = [];
  const rejected = [];
  const seen = new Set();
  let duplicatesRemoved = 0;
  for (const question of rawQuestions.filter(Boolean)) {
    const issues = validateGeneratedQuestionSpec(question);
    if (issues.length) {
      rejected.push({ id: question.id || 'unknown', issues });
      continue;
    }
    const signature = `${normalize(question.prompt)}|${normalize(question.answer)}`;
    if (seen.has(signature)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(signature);
    accepted.push(question);
  }

  const questions = accepted.map((question, index) => balancedChoices(question, index)).map(question => ({
    ...question,
    presentationFingerprint: fingerprint(question.choices.join('|')),
  }));
  const answerPositionCounts = [0, 0, 0];
  for (const question of questions) {
    const position = question.choices.indexOf(question.answer);
    if (position >= 0 && position < 3) answerPositionCounts[position] += 1;
  }
  return { questions, rejected, duplicatesRemoved, answerPositionCounts };
}

export function validateGrade2ContentPipeline(pipeline) {
  const issues = [];
  if (!pipeline || typeof pipeline !== 'object') return ['pipeline-missing'];
  if (pipeline.schemaVersion !== 2) issues.push('schema-version-invalid');
  if (!text(pipeline.sourceHash)) issues.push('source-hash-missing');
  if (!text(pipeline.bankFingerprint)) issues.push('bank-fingerprint-missing');
  if (!Array.isArray(pipeline.skills) || pipeline.skills.length === 0) issues.push('skills-empty');
  if (!Array.isArray(pipeline.questions) || pipeline.questions.length === 0) issues.push('questions-empty');

  const skillIds = new Set();
  for (const skill of pipeline.skills || []) {
    if (!text(skill.id)) issues.push('skill-id-missing');
    if (skillIds.has(skill.id)) issues.push(`duplicate-skill:${skill.id}`);
    skillIds.add(skill.id);
    if (!text(skill.subject)) issues.push(`skill-subject-missing:${skill.id}`);
    if (!Array.isArray(skill.studyNotes) || skill.studyNotes.length === 0) issues.push(`skill-study-notes-missing:${skill.id}`);
    if (!Array.isArray(skill.standards) || skill.standards.length === 0) issues.push(`skill-standards-missing:${skill.id}`);
    if (pipeline.sourcePolicy?.requirePageExactLineage && skill.sourceLineage?.quality !== 'page-exact') issues.push(`skill-lineage-unresolved:${skill.id}`);
  }

  const questionIds = new Set();
  const questionSkills = new Set();
  for (const question of pipeline.questions || []) {
    if (questionIds.has(question.id)) issues.push(`duplicate-question-id:${question.id}`);
    questionIds.add(question.id);
    questionSkills.add(question.skill);
    for (const issue of validateGeneratedQuestionSpec(question)) issues.push(`${question.id}:${issue}`);
    if (pipeline.sourcePolicy?.requirePageExactLineage) {
      const lineage = question.sourceLineage;
      if (lineage?.quality !== 'page-exact' || !text(lineage.sourceTitle) || !text(lineage.sourceCaptureHash) || !text(lineage.evidenceExcerptHash)) {
        issues.push(`question-lineage-unresolved:${question.id}`);
      }
    }
  }

  for (const skill of pipeline.skills || []) {
    if (!questionSkills.has(skill.id)) issues.push(`skill-without-question:${skill.id}`);
    const rows=(pipeline.questions||[]).filter(question=>question.skill===skill.id);
    if(rows.length<2)issues.push(`skill-sibling-bank-too-small:${skill.id}:${rows.length}/2`);
    const expected=1+supplementalQuestionFamily(skill).length;
    if(expected>1){
      if(rows.length<expected)issues.push(`semantic-family-incomplete:${skill.id}:${rows.length}/${expected}`);
      if(new Set(rows.map(question=>question.variantFingerprint)).size!==rows.length)issues.push(`semantic-variant-duplicate:${skill.id}`);
      if(new Set(rows.map(question=>question.contentFingerprint)).size!==rows.length)issues.push(`content-fingerprint-duplicate:${skill.id}`);
      if(expected>=3){
        const types=new Set(rows.map(question=>question.questionType));
        for(const requiredType of ['direct','transfer','reasoning']){
          if(!types.has(requiredType))issues.push(`semantic-family-type-missing:${skill.id}:${requiredType}`);
        }
      }
    }
  }
  if ((pipeline.qa?.rejectedCount || 0) > 0) issues.push('rejected-questions-present');
  if (pipeline.qa?.status !== 'pass') issues.push('qa-status-not-pass');

  const alignmentIssues = validateGrade2PipelineAlignment(pipeline);
  for (const issue of alignmentIssues) issues.push(`alignment:${issue.id}:${issue.issue}`);

  const positions = pipeline.qa?.answerPositionCounts || [];
  if (pipeline.questions?.length >= 3 && positions.length === 3) {
    const spread = Math.max(...positions) - Math.min(...positions);
    if (spread > 1) issues.push('answer-position-bias');
  }
  if((pipeline.qa?.maxConsecutiveAnswerPosition||0)>2)issues.push('answer-position-run-too-long');
  return [...new Set(issues)];
}

export function buildGrade2ContentPipeline(pack, { generatedAt, sourceHash, sourcePages = [], requirePageExactLineage = false } = {}) {
  const skills = [];
  const rawQuestions = [];
  const coverage = [];
  detectBaseSkills(pack, skills, rawQuestions);
  detectSightWords(pack, skills, rawQuestions, coverage);
  detectMath(pack, skills, rawQuestions);
  detectReligion(pack, skills, rawQuestions);
  detectVocabulary(pack, skills, rawQuestions, coverage);
  addSupplementalQuestionFamilies(skills, rawQuestions);
  attachSourceLineage(skills, rawQuestions, { sourcePages, sourceHash: sourceHash || pack?.sourceHash });
  detectUnsupportedExplicitSkills(pack, coverage);

  for (const skill of skills) {
    if (coverage.some(row => row.skillId === skill.id)) continue;
    coverage.push({
      topic: skill.label,
      subject: skill.subject,
      status: 'COVERED',
      skillId: skill.id,
    });
  }

  const spelling = subjectRow(pack, 'Spelling / Handwriting');
  if ((spelling?.studyNotes || []).some(note => /no word list posted/i.test(note))) {
    coverage.push({
      topic: 'Weekly spelling word list',
      subject: 'Spelling / Handwriting',
      status: 'SOURCE_INSUFFICIENT',
      reason: 'The teacher spelling page does not currently provide a usable word list.',
    });
  }

  const { questions, rejected, duplicatesRemoved, answerPositionCounts } = filterQuestions(rawQuestions);
  const studyNotesBySubject = {};
  for (const skill of skills) {
    if (!studyNotesBySubject[skill.subject]) studyNotesBySubject[skill.subject] = [];
    studyNotesBySubject[skill.subject].push(...skill.studyNotes);
  }
  for (const key of Object.keys(studyNotesBySubject)) {
    studyNotesBySubject[key] = uniqueText(studyNotesBySubject[key]);
  }

  const partialCoverage = coverage.some(row => ['PARTIALLY_COVERED', 'SOURCE_INSUFFICIENT', 'MISSING', 'GENERATOR_UNSUPPORTED'].includes(row.status));
  const bankFingerprint = fingerprint([
    ...questions.map(question => question.variantFingerprint).sort(),
    ...coverage.map(row => `${row.subject}|${row.topic}|${row.status}`).sort(),
  ].join('||'));
  const pipeline = {
    schemaVersion: 2,
    generatorVersion: 'grade2-content-pipeline-v2-research-recovery',
    generatedAt: generatedAt || new Date().toISOString(),
    sourceHash: sourceHash || pack?.sourceHash || 'unknown-source',
    bankFingerprint,
    lifecycleStage: 'QA_PASSED',
    safetyState: partialCoverage ? 'SAFE_PARTIAL' : 'READY',
    sourcePolicy: {
      runtimeAI: false,
      modes: ['STRICT_SOURCE', 'CURATED_CONTEXT', 'DETERMINISTIC_TEMPLATE'],
      failClosed: true,
      requirePageExactLineage,
    },
    skills,
    coverage,
    studyNotesBySubject,
    questions,
    qa: {
      status: rejected.length === 0 && skills.length > 0 && questions.length > 0 ? 'pass' : 'fail',
      skillCount: skills.length,
      questionCount: questions.length,
      minimumQuestionsPerSkill: 2,
      duplicatesRemoved,
      answerPositionCounts,
      semanticVariantCount:new Set(questions.map(question=>question.variantFingerprint)).size,
      maxConsecutiveAnswerPosition:questions.reduce((state,question)=>{
        const position=question.choices.indexOf(question.answer);
        state.run=position===state.last?state.run+1:1;state.last=position;state.max=Math.max(state.max,state.run);return state;
      },{last:-1,run:0,max:0}).max,
      questionTypeCounts: questions.reduce((counts, question) => {
        counts[question.questionType] = (counts[question.questionType] || 0) + 1;
        return counts;
      }, {}),
      dokCounts: questions.reduce((counts, question) => {
        counts[question.dok] = (counts[question.dok] || 0) + 1;
        return counts;
      }, {}),
      questionsPerSkill: questions.reduce((counts, question) => {
        counts[question.skill] = (counts[question.skill] || 0) + 1;
        return counts;
      }, {}),
      rejectedCount: rejected.length,
      rejected,
      subjectCoverage: [...new Set(skills.map(skill => skill.subject))].sort(),
      sourceInsufficientCount: coverage.filter(row => row.status === 'SOURCE_INSUFFICIENT').length,
      unsupportedSkillCount: coverage.filter(row => row.status === 'GENERATOR_UNSUPPORTED').length,
      pageExactLineageCount: questions.filter(question => question.sourceLineage?.quality === 'page-exact').length,
      unresolvedLineageCount: questions.filter(question => question.sourceLineage?.quality !== 'page-exact').length,
    },
  };

  const issues = validateGrade2ContentPipeline(pipeline);
  if (issues.length) {
    const rejectionDetail = rejected.length ? `; rejected=${JSON.stringify(rejected)}` : '';
    throw new Error(`Grade 2 content pipeline validation failed: ${JSON.stringify(issues)}${rejectionDetail}`);
  }
  return pipeline;
}

export function mergeGrade2StudyNotes(pack, pipeline) {
  const notesBySubject = pipeline?.studyNotesBySubject || {};
  for (const subject of pack?.subjects || []) {
    const generated = notesBySubject[subject.subject] || [];
    subject.studyNotes = uniqueText([...(subject.studyNotes || []), ...generated]);
  }
  return pack;
}
