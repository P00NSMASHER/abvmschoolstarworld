// Original examples for the explicitly published skill, never a teacher word/test list.
export const LONG_SHORT_U_FAMILY=Object.freeze({
 id:'long-short-u',subject:'Spelling / Handwriting',label:'Long u and short u',
 patternSource:'\\blong\\s*(?:u\\s*)?(?:/|&|and)\\s*short\\s*u\\b',patternFlags:'i',
 standards:['CCSS.RF.2.3'],domain:'Foundational reading and phonics',
 studyNotes:[
  'Short u is the middle sound in cup, sun and mud. Compare it with long u in cube, cute and mule.',
  'In the original pairs cub/cube, cut/cute and tub/tube, final e changes the vowel sound. The u-consonant-e pattern often signals long u.',
  'Long u can sound like yoo in cube or oo in flute. Say the whole word and listen; do not assume every word containing u has the same vowel sound.',
  'These are original practice examples for the published long/short-u skill, not a teacher-published spelling list or test questions.'
 ],
 sourcePriority:['Tests','Reading Work'],featureFlag:'curriculum-family:long-short-u-v1',
 rolloutStatus:'CANDIDATE',enabledByDefault:false,minimumSemanticVariants:8,
 requiredQuestionTypes:['direct','transfer','reasoning'],
 teachCard:['Compare the vowel in cup with the vowel in cube.','Look for a final silent e, then say the word to check its vowel sound.'],
 assessmentPatterns:['\\blong\\s*(?:u\\s*)?(?:/|&|and)\\s*short\\s*u\\b'],
 baseQuestion:{questionType:'direct',prompt:'Which word has short u, like the vowel in cup?',choices:['sun','cube','mule'],answer:'sun',explanation:'Sun and cup have short u. Cube and mule have long u.',hint:'Say each whole word and listen to its middle sound.',dok:1,difficulty:2},
 supplementalQuestions:[
  {questionType:'direct',prompt:'Which word uses the u-consonant-e pattern with a long u sound?',choices:['cute','cut','cup'],answer:'cute',explanation:'Cute has final silent e and long u. Cut and cup have short u.',hint:'Find the word with a final silent e, then say it aloud.',dok:1,difficulty:2},
  {questionType:'direct',prompt:'Which word has the same short u sound as mud?',choices:['rug','tube','flute'],answer:'rug',explanation:'Rug and mud have short u. Tube and flute have long u.',hint:'Compare the vowel sounds rather than only the letter u.',dok:1,difficulty:2},
  {questionType:'transfer',prompt:'Add a final e to cub. Which new word has long u?',choices:['cube','club','cup'],answer:'cube',explanation:'Cub becomes cube when a final e is added. Its short u changes to long u.',hint:'Keep the original letters in their order and add a silent e.',dok:2,difficulty:2},
  {questionType:'transfer',prompt:'Which pair shows short u first and long u second?',choices:['tub and tube','mule and mud','cute and cut'],answer:'tub and tube',explanation:'Tub has short u; tube has long u. The other pairs put long u first.',hint:'Check the vowel in the first word and then the second word.',dok:2,difficulty:2},
  {questionType:'transfer',prompt:'A reader sorts sun and cup into a short-u group. Which new word belongs with them?',choices:['bus','cube','cute'],answer:'bus',explanation:'Bus has the short u sound heard in sun and cup.',hint:'Read each choice aloud and compare the middle vowel.',dok:2,difficulty:2},
  {questionType:'reasoning',prompt:'Why do cut and cute belong in different vowel-sound groups?',choices:['Cut has short u; cute has long u.','Both words have no vowel sound.','The first consonant makes their vowel sounds the same.'],answer:'Cut has short u; cute has long u.',explanation:'Adding final e changes cut to cute and changes the u vowel sound.',hint:'Compare the vowel when each word is spoken, including the effect of final e.',dok:3,difficulty:3},
  {questionType:'reasoning',prompt:'A learner says every word with u has the same vowel sound. Which comparison shows why that is incorrect?',choices:['Mud has short u, while mule has long u.','Mud and sun both have short u.','Cube and cute both have long u.'],answer:'Mud has short u, while mule has long u.',explanation:'Mud and mule both contain u, but one has short u and the other long u.',hint:'Choose a comparison that shows two different vowel sounds.',dok:3,difficulty:3},
  {questionType:'reasoning',prompt:'Which explanation correctly describes the long-u words cube and flute?',choices:['Long u can sound like yoo or oo in different words.','Every long-u word must rhyme with cube.','The letter u is silent in both words.'],answer:'Long u can sound like yoo or oo in different words.',explanation:'Cube uses a yoo sound, while flute uses an oo sound; both are long-u examples.',hint:'Read both words and notice their vowel sounds.',dok:3,difficulty:3}
 ]
});
