(()=>{"use strict";
const VERSION="abvm-starblox-study-engine-v2-research-quality";
const SOURCE_TRANSFORM="skill-only-equivalent-item-v2";
const MATERIAL_PROVENANCE="original-practice-derived-from-verified-abvm-skills";
const FALLBACK_PROVENANCE="original-star-aligned-grade2-practice";
const FORBIDDEN=[
  /sight word/i,
  /which .* is on the current .* list/i,
  /which .* is on .* list/i,
  /current vocabulary list/i,
  /what .* is being practiced this week/i,
  /being practiced this week/i,
  /which story is on the current .* page/i,
  /teacher page/i,
  /study list/i
];
const STANDARD_BY_SKILL=Object.freeze({
  "subtraction-within-12":["CCSS.2.OA.B.2"],
  "subtraction-word-problem":["CCSS.2.OA.A.1"],
  "two-step-word-problem":["CCSS.2.OA.A.1"],
  "sentence-types":["CCSS.L.2.1"],
  "consonant-blends":["CCSS.RF.2.3"],
  "cvc-structure":["CCSS.RF.2.3"],
  "long-short-a":["CCSS.RF.2.3"],
  "suffix-ed-ing":["CCSS.RF.2.3.d"],
  "high-frequency-word-use":["CCSS.RF.2.3.f"],
  "vocabulary-in-context":["CCSS.L.2.4.a"],
  "theme":["CCSS.RL.2.2"],
  "inference":["CCSS.RL.2.1"],
  "text-evidence":["CCSS.RL.2.1"],
  "visualize":["CCSS.RL.2.1"],
  "character-motivation":["CCSS.RL.2.3"],
  "religion-application":["ABVM.RELIGION.CURRENT"],
  "addition-within-100":["CCSS.2.NBT.B.5"],
  "subtraction-within-100":["CCSS.2.NBT.B.5"],
  "place-value":["CCSS.2.NBT.A.1"],
  "compare-numbers":["CCSS.2.NBT.A.4"],
  "time":["CCSS.2.MD.C.7"],
  "measurement":["CCSS.2.MD.A.1"],
  "data-interpretation":["CCSS.2.MD.D.10"],
  "author-purpose":["CCSS.RI.2.6"],
  "word-choice":["CCSS.RL.2.4"],
  "cause-effect":["CCSS.RI.2.3"]
});
const DOMAIN_BY_SKILL=Object.freeze({
  "subtraction-within-12":"Numbers and operations",
  "subtraction-word-problem":"Algebraic thinking",
  "two-step-word-problem":"Algebraic thinking",
  "sentence-types":"Language",
  "consonant-blends":"Foundational reading",
  "cvc-structure":"Foundational reading",
  "long-short-a":"Foundational reading",
  "suffix-ed-ing":"Foundational reading",
  "high-frequency-word-use":"Foundational reading",
  "vocabulary-in-context":"Word knowledge and skills",
  "theme":"Analyzing literary text",
  "inference":"Comprehension / constructing meaning",
  "text-evidence":"Comprehension / constructing meaning",
  "visualize":"Comprehension / constructing meaning",
  "character-motivation":"Analyzing literary text",
  "religion-application":"Religion",
  "addition-within-100":"Numbers and operations",
  "subtraction-within-100":"Numbers and operations",
  "place-value":"Numbers and operations",
  "compare-numbers":"Numbers and operations",
  "time":"Geometry and measurement",
  "measurement":"Geometry and measurement",
  "data-interpretation":"Data analysis, statistics, and probability",
  "author-purpose":"Understanding author's craft",
  "word-choice":"Understanding author's craft",
  "cause-effect":"Comprehension / constructing meaning"
});
const VOCAB=Object.freeze({
  action:{
    meaning:"something a person or thing does",
    sentence:"The firefighter's quick action helped everyone get outside safely.",
    best:"Mia took action by picking up the books that fell."
  },
  afraid:{
    meaning:"feeling scared or worried about danger",
    sentence:"Kai felt afraid when thunder shook the windows.",
    best:"The child felt afraid and held Dad's hand during the loud storm."
  },
  depend:{
    meaning:"to need or rely on someone or something",
    sentence:"Young birds depend on their parents for food.",
    best:"Plants depend on sunlight and water to grow."
  },
  nervously:{
    meaning:"in a worried or uneasy way",
    sentence:"Lena waited nervously outside the principal's office.",
    best:"Owen tapped his foot nervously before his turn on stage."
  },
  peered:{
    meaning:"looked closely or carefully",
    sentence:"Nico peered through the foggy window to see the bus.",
    best:"Ava peered into the tiny box to see what was inside."
  },
  perfectly:{
    meaning:"in exactly the right way or without mistakes",
    sentence:"The puzzle piece fit perfectly into the empty space.",
    best:"The lid fit perfectly, with no gap around the edge."
  },
  rescue:{
    meaning:"to save someone or something from danger",
    sentence:"The lifeguard swam out to rescue the tired swimmer.",
    best:"Firefighters rescue people when they are in danger."
  },
  secret:{
    meaning:"something kept hidden or not told to everyone",
    sentence:"Maya whispered the secret so no one else could hear it.",
    best:"The surprise party stayed a secret until Saturday."
  }
});

function text(value){return String(value??"").trim()}
function slug(value){return text(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"item"}
function hash(value){
  let h=2166136261>>>0;
  for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0}
  return h>>>0;
}
function variantFor(sourceKey){return (hash(sourceKey)%2)+1}
function rowFor(rows,variant){return rows[Math.max(0,(Math.floor(Number(variant)||1)-1)%rows.length)]}
function shuffled(values,seed){
  return [...values].sort((a,b)=>hash(seed+"|"+a)-hash(seed+"|"+b));
}
function subject(pack,name){return (pack?.subjects||[]).find(row=>text(row.subject).toLowerCase()===name.toLowerCase())||null}
function subjectText(pack,name){
  const row=subject(pack,name);
  return [...(row?.topics||[]),...(row?.studyNotes||[])].join(" | ");
}
function topicMatch(pack,name,re){return re.test(subjectText(pack,name))}
function readingTopics(pack){return subject(pack,"Reading / ELA")?.topics||[]}
function listFromTopic(pack,label){
  const row=readingTopics(pack).find(value=>new RegExp("^"+label+"\\s*:","i").test(value));
  if(!row)return [];
  return row.replace(new RegExp("^"+label+"\\s*:","i"),"").split(",").map(text).filter(Boolean);
}
function diagnosticMap(choices,answer,feedback,misconception){
  const map={};
  for(const choice of choices){
    if(choice===answer)continue;
    map[choice]={
      misconception:text(typeof misconception==="function"?misconception(choice):misconception||"skill-misapplied"),
      feedback:text(typeof feedback==="function"?feedback(choice):feedback||"Try the skill again and use the clue in the question.")
    };
  }
  return map;
}
function rubric(){
  return {
    maxPoints:2,
    criteria:[
      "2 points: selects the correct answer using the target skill.",
      "1 point: selects a plausible misconception-aligned answer that shows partial understanding.",
      "0 points: selects an unrelated or unsupported answer."
    ]
  };
}
function makeQuestion({
  id,subject,skill,tier,type,prompt,choices,answer,explanation,hint,sourceFact,
  dok=2,difficulty=2,standards,domain,wrongFeedback,misconception,richContent=null
}){
  const cleanChoices=[...choices].map(text);
  return {
    id,subject,skill,tier,
    questionType:type||"direct",
    format:"multiple_choice",
    prompt:text(prompt),
    choices:cleanChoices,
    answer:text(answer),
    explanation:text(explanation),
    hint:text(hint||"Use the important clue in the question before choosing."),
    standards:standards||STANDARD_BY_SKILL[skill]||[],
    domain:domain||DOMAIN_BY_SKILL[skill]||"Grade 2",
    dok,
    cognitiveDemand:dok===3?"strategic reasoning":dok===2?"skill / concept":"recall / procedure",
    difficulty,
    choiceDiagnostics:diagnosticMap(cleanChoices,text(answer),wrongFeedback,misconception),
    rubric:rubric(),
    provenance:tier==="material"?MATERIAL_PROVENANCE:FALLBACK_PROVENANCE,
    sourceFact:text(sourceFact||skill),
    sourceTransform:SOURCE_TRANSFORM,
    originalEquivalent:true,
    richContent
  };
}
function addTriad(out,prefix,base,items){
  const types=["direct","transfer","reasoning"];
  items.forEach((item,index)=>out.push(makeQuestion({
    ...base,...item,type:types[index],
    id:prefix+"-"+types[index]+"-"+slug(item.idSuffix||String(index+1))
  })));
}
function add(out,question){out.push(makeQuestion(question))}
function materialContentPipeline(pack,out){
  const specs=Array.isArray(pack?.contentPipeline?.questions)?pack.contentPipeline.questions:[];
  for(const spec of specs){
    if(!spec||typeof spec!=="object")continue;
    const diagnostics=spec.choiceDiagnostics&&typeof spec.choiceDiagnostics==="object"?spec.choiceDiagnostics:{};
    add(out,{
      id:text(spec.id),subject:text(spec.subject),skill:text(spec.skill),tier:"material",
      type:text(spec.questionType)||"direct",prompt:spec.prompt,choices:spec.choices||[],answer:spec.answer,
      explanation:spec.explanation,hint:spec.hint,sourceFact:spec.sourceFact,
      dok:Number.isInteger(spec.dok)?spec.dok:2,
      difficulty:Number.isInteger(spec.difficulty)?spec.difficulty:2,
      standards:Array.isArray(spec.standards)?spec.standards:undefined,
      domain:spec.domain,
      wrongFeedback:choice=>text(diagnostics?.[choice]?.feedback||"Review the target skill and use the hint before choosing again."),
      misconception:choice=>text(diagnostics?.[choice]?.misconception||"pipeline-generated-distractor")
    });
  }
}
function materialMath(pack,variant,out){
  if(!topicMatch(pack,"Math",/subtraction\s+to\s+12/i))return;
  const row=rowFor([
    {a:12,b:7,c:10,d:6,start:9,give:4,first:11,add:1,take:5},
    {a:11,b:5,c:9,d:4,start:12,give:8,first:8,add:3,take:4}
  ],variant);
  addTriad(out,"mat-sub12",{
    subject:"Math",skill:"subtraction-within-12",tier:"material",
    sourceFact:"Verified current ABVM skill: Subtraction to 12",
    hint:"Think about the amount you start with and how many are taken away."
  },[
    {
      skill:"subtraction-within-12",
      prompt:`Solve this subtraction problem: ${row.a} − ${row.b}. What is the difference?`,
      choices:shuffled([String(row.a-row.b),String(row.a-row.b+1),String(row.a-row.b-1)],"m1"+variant),
      answer:String(row.a-row.b),
      explanation:`${row.a} take away ${row.b} leaves ${row.a-row.b}.`,
      dok:1,difficulty:2,
      wrongFeedback:choice=>`Check by adding ${row.b} to ${choice}. The result should equal ${row.a}.`,
      misconception:"subtraction-fact-error"
    },
    {
      skill:"subtraction-word-problem",
      prompt:`Mila had ${row.start} stickers and gave ${row.give} away. How many stickers does she have now?`,
      choices:shuffled([String(row.start-row.give),String(row.start+row.give),String(row.give)],"m2"+variant),
      answer:String(row.start-row.give),
      explanation:`Giving some away means subtracting: ${row.start} − ${row.give} = ${row.start-row.give}.`,
      dok:2,difficulty:2,
      wrongFeedback:choice=>choice===String(row.start+row.give)?"You added, but the story says stickers were given away.":"Use the starting amount, then take away the amount given.",
      misconception:choice=>choice===String(row.start+row.give)?"operation-confusion":"part-whole-confusion"
    },
    {
      skill:"two-step-word-problem",
      prompt:`A box held ${row.first} crayons. ${row.add} crayon was added, then ${row.take} crayons were used. How many crayons are left?`,
      choices:shuffled([String(row.first+row.add-row.take),String(row.first+row.add),String(Math.max(0,row.first-row.take))],"m3"+variant),
      answer:String(row.first+row.add-row.take),
      explanation:`First add: ${row.first} + ${row.add} = ${row.first+row.add}. Then subtract ${row.take}: ${row.first+row.add} − ${row.take} = ${row.first+row.add-row.take}.`,
      dok:3,difficulty:3,
      hint:"Do the changes in order. Write the new amount after the first change.",
      wrongFeedback:choice=>choice===String(row.first+row.add)?"You solved the first step but stopped before the crayons were used.":"Do the addition first, then subtract the crayons that were used.",
      misconception:choice=>choice===String(row.first+row.add)?"one-step-only":"operation-order"
    }
  ]);
  add(out,{
    id:"mat-sub12-fact-b-v"+variant,subject:"Math",skill:"subtraction-within-12",tier:"material",
    prompt:`Solve this subtraction fact: ${row.c} − ${row.d}. What is the difference?`,
    choices:shuffled([String(row.c-row.d),String(row.c-row.d+1),String(row.c-row.d-1)],"m4"+variant),
    answer:String(row.c-row.d),
    explanation:`${row.c} take away ${row.d} leaves ${row.c-row.d}.`,
    hint:"Count back or use an addition fact to check.",
    sourceFact:"Verified current ABVM skill: Subtraction to 12",dok:1,difficulty:2,
    wrongFeedback:`Add ${row.d} back to your answer. You should get ${row.c}.`,
    misconception:"subtraction-fact-error"
  });
  add(out,{
    id:"mat-sub12-story-b-v"+variant,subject:"Math",skill:"subtraction-word-problem",tier:"material",
    prompt:`There were ${row.c} birds on a fence. ${row.d} flew away. How many birds stayed?`,
    choices:shuffled([String(row.c-row.d),String(row.c+row.d),String(row.d)],"m5"+variant),
    answer:String(row.c-row.d),
    explanation:`“Flew away” means subtract: ${row.c} − ${row.d} = ${row.c-row.d}.`,
    hint:"Start with the number of birds on the fence, then take away the birds that left.",
    sourceFact:"Verified current ABVM skill: Subtraction to 12",dok:2,difficulty:2,
    wrongFeedback:"The amount gets smaller because some birds flew away.",
    misconception:"operation-confusion"
  });
  add(out,{
    id:"mat-sub12-missing-part-v"+variant,subject:"Math",skill:"subtraction-within-12",tier:"material",
    prompt:`Which number makes this true? ${row.c} − ___ = ${row.d}`,
    choices:shuffled([String(row.c-row.d),String(row.d),String(row.c)],"m6"+variant),
    answer:String(row.c-row.d),
    explanation:`${row.c} − ${row.c-row.d} = ${row.d}.`,
    hint:"Ask what amount must be taken away to reach the number on the right.",
    sourceFact:"Verified current ABVM skill: Subtraction to 12",dok:2,difficulty:2,
    wrongFeedback:"Check each choice by putting it in the blank and subtracting.",
    misconception:"missing-part-confusion"
  });
  add(out,{
    id:"mat-sub12-equation-story-v"+variant,subject:"Math",skill:"subtraction-word-problem",tier:"material",
    prompt:`A basket had ${row.c} apples and ${row.d} were eaten. Which equation matches the story?`,
    choices:shuffled([`${row.c} − ${row.d} = ${row.c-row.d}`,`${row.c} + ${row.d} = ${row.c+row.d}`,`${row.d} − ${row.c} = ${row.d-row.c}`],"m7"+variant),
    answer:`${row.c} − ${row.d} = ${row.c-row.d}`,
    explanation:"Eating apples removes some from the starting amount, so subtraction matches the story.",
    hint:"Look for the equation that starts with the whole amount and takes some away.",
    sourceFact:"Verified current ABVM skill: Subtraction to 12",dok:2,difficulty:2,
    wrongFeedback:"The story starts with the larger amount and says some were eaten.",
    misconception:"equation-model-mismatch"
  });
  add(out,{
    id:"mat-sub12-two-step-b-v"+variant,subject:"Math",skill:"two-step-word-problem",tier:"material",
    prompt:`A tray had ${row.c} counters. 2 more were added, then ${row.d} were removed. How many counters are left?`,
    choices:shuffled([String(row.c+2-row.d),String(row.c+2),String(row.c-row.d)],"m8"+variant),
    answer:String(row.c+2-row.d),
    explanation:`First ${row.c} + 2 = ${row.c+2}. Then ${row.c+2} − ${row.d} = ${row.c+2-row.d}.`,
    hint:"Do the changes in order: add first, then subtract.",
    sourceFact:"Verified current ABVM skill: Subtraction to 12",dok:3,difficulty:3,
    wrongFeedback:"Do both steps. The second change removes counters.",
    misconception:"one-step-only"
  });
}
function materialSentences(pack,variant,out){
  if(!topicMatch(pack,"Reading / ELA",/types of sentences/i))return;
  const row=rowFor([
    {direct:"Please put your folder on the desk.",a1:"command",transfer:"Why is the puppy hiding?",a2:"question",reason:"What a gigantic pumpkin!"},
    {direct:"The class planted seeds today.",a1:"statement",transfer:"Watch out for that puddle!",a2:"exclamation",reason:"Could you pass the crayons?"}
  ],variant);
  const types=["statement","question","command","exclamation"];
  const choices=a=>shuffled([a,...types.filter(x=>x!==a).slice(0,2)],"sent"+variant+a);
  addTriad(out,"mat-sentence-types",{
    subject:"Reading / ELA",skill:"sentence-types",tier:"material",
    sourceFact:"Verified current ABVM grammar skill: types of sentences",
    hint:"Ask what the sentence is doing: telling, asking, directing, or showing strong feeling."
  },[
    {
      prompt:`What type of sentence is “${row.direct}”?`,
      choices:choices(row.a1),answer:row.a1,
      explanation:"Sentence type depends on its purpose and ending punctuation.",
      dok:2,difficulty:2,
      wrongFeedback:"Read the sentence aloud and decide what the speaker is trying to do.",
      misconception:"sentence-purpose-confusion"
    },
    {
      prompt:`What type of sentence is “${row.transfer}”?`,
      choices:choices(row.a2),answer:row.a2,
      explanation:"Look at both the meaning and punctuation.",
      dok:2,difficulty:2,
      wrongFeedback:"Use both the sentence's purpose and its punctuation mark.",
      misconception:"punctuation-purpose-confusion"
    },
    {
      prompt:`Which clue is most useful for identifying the sentence type in “${row.reason}”?`,
      choices:shuffled(["Its purpose and ending punctuation.","The number of words.","Whether it contains a noun."],"sent3"+variant),
      answer:"Its purpose and ending punctuation.",
      explanation:"Sentence type is determined by what the sentence does and how it ends.",
      dok:3,difficulty:3,
      wrongFeedback:"Length and parts of speech do not decide whether a sentence tells, asks, commands, or exclaims.",
      misconception:"irrelevant-feature"
    }
  ]);
}
function materialPhonics(pack,variant,out){
  const hasBlend=topicMatch(pack,"Reading / ELA",/2-letter consonant blends/i)||topicMatch(pack,"Spelling / Handwriting",/2-letter blends/i);
  if(hasBlend){
    const row=rowFor([
      {word:"frog",blend:"fr",same:"frame",near:"fog",other:"boat"},
      {word:"clap",blend:"cl",same:"clock",near:"cap",other:"eagle"}
    ],variant);
    addTriad(out,"mat-blends",{
      subject:"Spelling / Handwriting",skill:"consonant-blends",tier:"material",
      sourceFact:"Verified current ABVM phonics skill: 2-letter consonant blends",
      hint:"Say the beginning slowly and listen for both consonant sounds."
    },[
      {
        prompt:`Which beginning blend do you hear in “${row.word}”?`,
        choices:shuffled([row.blend,row.blend[0],row.blend[1]],"bl1"+variant),answer:row.blend,
        explanation:`In “${row.word},” both sounds in ${row.blend} can be heard.`,
        dok:1,difficulty:2,
        wrongFeedback:"Say the word slowly. A blend includes both beginning consonant sounds.",
        misconception:"blend-partial-sound"
      },
      {
        prompt:`Which word begins with the same consonant blend as “${row.word}”?`,
        choices:shuffled([row.same,row.near,row.other],"bl2"+variant),answer:row.same,
        explanation:`“${row.same}” begins with the same two consonant sounds.`,
        dok:2,difficulty:2,
        wrongFeedback:choice=>choice===row.near?"That word shares one sound, but not the full two-letter blend.":"Compare the first two sounds in each word.",
        misconception:choice=>choice===row.near?"single-sound-match":"blend-mismatch"
      },
      {
        prompt:`Why is “${row.blend}” in “${row.word}” a blend instead of one sound?`,
        choices:shuffled(["You can hear both consonant sounds.","One consonant is silent.","The letters make a long vowel sound."],"bl3"+variant),
        answer:"You can hear both consonant sounds.",
        explanation:"A consonant blend keeps both consonant sounds.",
        dok:3,difficulty:3,
        wrongFeedback:"Listen to each letter in the beginning of the word.",
        misconception:"blend-definition"
      }
    ]);
  }
  if(topicMatch(pack,"Reading / ELA",/CVC words/i)){
    const row=rowFor([
      {word:"map",other:"moon",almost:"make"},
      {word:"fin",other:"boat",almost:"fine"}
    ],variant);
    addTriad(out,"mat-cvc",{
      subject:"Reading / ELA",skill:"cvc-structure",tier:"material",
      sourceFact:"Verified current ABVM word-structure skill: CVC words",
      hint:"Look for consonant-vowel-consonant with one short vowel in the middle."
    },[
      {
        prompt:`Which word has a consonant-vowel-consonant pattern?`,
        choices:shuffled([row.word,row.other,row.almost],"cvc1"+variant),answer:row.word,
        explanation:`“${row.word}” follows consonant-vowel-consonant.`,
        dok:1,difficulty:2,
        wrongFeedback:"Check the letter pattern from left to right.",
        misconception:"word-pattern-confusion"
      },
      {
        prompt:`Which change would turn “${row.word}” into a word that is no longer CVC?`,
        choices:shuffled(["Add e to the end.","Change the first consonant.","Change the last consonant."],"cvc2"+variant),
        answer:"Add e to the end.",
        explanation:"Adding a final e changes the simple three-letter CVC pattern.",
        dok:2,difficulty:2,
        wrongFeedback:"A CVC word has exactly three letters in the consonant-vowel-consonant pattern.",
        misconception:"structure-count"
      },
      {
        prompt:"What is the best way to check whether a three-letter word is CVC?",
        choices:shuffled(["Name each letter type in order: consonant, vowel, consonant.","Count how many syllables are in the sentence.","Look only at the first letter."],"cvc3"+variant),
        answer:"Name each letter type in order: consonant, vowel, consonant.",
        explanation:"CVC describes the letter-type pattern across the whole word.",
        dok:3,difficulty:3,
        wrongFeedback:"You need to inspect all three letters, not just one part.",
        misconception:"incomplete-structure-check"
      }
    ]);
  }
  if(topicMatch(pack,"Reading / ELA",/long a|short a|a_e/i)||topicMatch(pack,"Spelling / Handwriting",/short a\s*\/\s*long a/i)){
    addTriad(out,"mat-long-short-a",{
      subject:"Spelling / Handwriting",skill:"long-short-a",tier:"material",
      sourceFact:"Verified current ABVM phonics and spelling skill: short a / long a (a_e)",
      hint:"Listen to the vowel sound. In many a_e words, the final e helps a say its name."
    },[
      {
        prompt:"Which word has a long a sound?",
        choices:shuffled(["cake","cat","map"],"a1"+variant),
        answer:"cake",
        explanation:"In “cake,” the a_e pattern makes the a say its long sound.",
        dok:1,difficulty:2,
        wrongFeedback:"Say each word slowly and listen to the middle vowel sound.",
        misconception:"long-short-vowel-confusion"
      },
      {
        prompt:"Which pair of words both have a short a sound?",
        choices:shuffled(["cat and map","cake and game","late and cap"],"a2"+variant),
        answer:"cat and map",
        explanation:"The a in both “cat” and “map” has the short a sound.",
        dok:2,difficulty:2,
        wrongFeedback:"Check both words in the pair; both must use the short a sound.",
        misconception:"mixed-vowel-pair"
      },
      {
        prompt:"Why does the a in “game” have a long sound?",
        choices:shuffled(["The final e helps the a say its name.","The g makes every vowel long.","The word has four letters."],"a3"+variant),
        answer:"The final e helps the a say its name.",
        explanation:"“Game” follows the a_e pattern being practiced this week.",
        dok:3,difficulty:3,
        wrongFeedback:"Look at the a_e pattern: the final e changes the vowel sound.",
        misconception:"silent-e-rule-confusion"
      }
    ]);
  }
  if(topicMatch(pack,"Reading / ELA",/adding\s+-?ed.*-?ing|adding\s+-?ing.*-?ed/i)){
    addTriad(out,"mat-suffix-ed-ing",{
      subject:"Reading / ELA",skill:"suffix-ed-ing",tier:"material",
      sourceFact:"Verified current ABVM word-structure skill: adding -ed and -ing",
      hint:"Use -ed for an action that already happened and -ing for an action happening now."
    },[
      {
        prompt:"Which word means the action already happened: play, played, or playing?",
        choices:shuffled(["played","play","playing"],"suf1"+variant),
        answer:"played",
        explanation:"Adding -ed to “play” makes “played,” which tells about an action that already happened.",
        dok:1,difficulty:2,
        wrongFeedback:"Look for the ending that usually tells about a past action.",
        misconception:"suffix-time-confusion"
      },
      {
        prompt:"Which word correctly completes the sentence? “Mia is ___ at recess right now.”",
        choices:shuffled(["jumping","jumped","jump"],"suf2"+variant),
        answer:"jumping",
        explanation:"The sentence says the action is happening right now, so “jumping” fits.",
        dok:2,difficulty:2,
        wrongFeedback:"“Right now” is a clue that the action is still happening.",
        misconception:"progressive-form-confusion"
      },
      {
        prompt:"What does adding -ed or -ing usually change about a word?",
        choices:shuffled(["It helps show when or how an action is happening.","It always changes a word into a person's name.","It removes the base word's meaning."],"suf3"+variant),
        answer:"It helps show when or how an action is happening.",
        explanation:"The endings -ed and -ing help show the action's time or state while keeping the base action idea.",
        dok:3,difficulty:3,
        wrongFeedback:"Think about “played” versus “playing” and what each ending tells you.",
        misconception:"suffix-function-confusion"
      }
    ]);
  }
}
function materialHighFrequency(pack,variant,out){
  const words=listFromTopic(pack,"Sight words");
  if(words.length<4)return;
  const available=new Set(words.map(w=>w.toLowerCase()));
  const rows=[
    {prompt:"___ is my little sister.",answer:"she",choices:["she","what","by"]},
    {prompt:"The puppy is very ___.",answer:"small",choices:["small","were","what"]},
    {prompt:"Put your backpack ___ the chair.",answer:"by",choices:["by","he","want"]},
    {prompt:"___ do you want for lunch?",answer:"what",choices:["what","here","girl"]},
    {prompt:"The boys ___ ready for recess.",answer:"were",choices:["were","she","small"]},
    {prompt:"Please come over ___.",answer:"here",choices:["here","boy","by"]}
  ].filter(row=>row.choices.every(choice=>available.has(choice)));
  if(rows.length<3)return;
  const start=(variant-1)%rows.length;
  const selected=[rows[start],rows[(start+2)%rows.length],rows[(start+4)%rows.length]];
  addTriad(out,"mat-high-frequency",{
    subject:"Reading / ELA",skill:"high-frequency-word-use",tier:"material",
    sourceFact:"Verified current ABVM high-frequency-word set",
    hint:"Read the whole sentence and choose the word that makes the meaning and grammar correct."
  },selected.map((row,index)=>({
    prompt:`Which word correctly completes the sentence? “${row.prompt}”`,
    choices:shuffled(row.choices,"hf"+variant+index),answer:row.answer,
    explanation:`“${row.answer}” makes the sentence sound right and complete.`,
    dok:index===2?3:2,difficulty:index===2?3:2,
    wrongFeedback:"Read the entire sentence with each choice. Only one fits both meaning and grammar.",
    misconception:"context-grammar-mismatch"
  })));
}
function materialVocabulary(pack,variant,out){
  const pipelineSkills=Array.isArray(pack?.contentPipeline?.skills)?pack.contentPipeline.skills:null;
  if(pipelineSkills&&!pipelineSkills.some(skill=>text(skill?.id)==="vocabulary-in-context"))return;
  const current=(pack?.vocabulary||[]).map(v=>text(v.term).toLowerCase()).filter(w=>VOCAB[w]);
  if(current.length<3)return;
  const ordered=[...current].sort((a,b)=>hash("vocab"+variant+a)-hash("vocab"+variant+b));
  const selected=ordered.slice(0,3);
  const meanings=Object.values(VOCAB).map(row=>row.meaning);
  addTriad(out,"mat-vocab-context",{
    subject:"Reading / ELA",skill:"vocabulary-in-context",tier:"material",
    sourceFact:"Verified current ABVM vocabulary words practiced through context",
    hint:"Use the surrounding sentence to test the meaning."
  },selected.map((word,index)=>{
    const row=VOCAB[word];
    const distractors=meanings.filter(x=>x!==row.meaning).sort((a,b)=>hash(word+a)-hash(word+b)).slice(0,2);
    return {
      prompt:`Read: “${row.sentence}” What does “${word}” mean in this sentence?`,
      choices:shuffled([row.meaning,...distractors],"voc"+variant+word),answer:row.meaning,
      explanation:`The clues in the sentence show that “${word}” means ${row.meaning}.`,
      dok:index===2?3:2,difficulty:index===2?3:2,
      wrongFeedback:"Use the action or situation around the word as a context clue.",
      misconception:"context-clue-missed"
    };
  }));
  const word=selected[0],row=VOCAB[word];
  add(out,{
    id:"mat-vocab-use-"+word+"-v"+variant,subject:"Reading / ELA",skill:"vocabulary-in-context",tier:"material",
    prompt:`Which sentence uses “${word}” correctly?`,
    choices:shuffled([row.best,`The ${word} sandwich slept under the desk.`,`We counted ${word} because seven is blue.`],"use"+word+variant),
    answer:row.best,explanation:`The correct sentence uses “${word}” with its real meaning.`,
    hint:"Choose the sentence in which the word's meaning fits the situation.",
    sourceFact:"Verified current ABVM vocabulary word: "+word,dok:3,difficulty:3,
    wrongFeedback:"Check whether the word's meaning makes sense in the entire sentence.",
    misconception:"word-meaning-misuse"
  });
}
function materialReading(pack,variant,out){
  const source=subjectText(pack,"Reading / ELA");
  if(!/visualize|theme/i.test(source))return;
  const rows=rowFor([
    {
      infer:"Nora zipped her coat, pulled up her hood, and stepped around puddles on the sidewalk.",
      inferQ:"What can you infer about the weather?",inferA:"It is rainy or has just rained.",
      inferChoices:["It is rainy or has just rained.","It is very hot and dry.","It is snowing heavily."],
      evidence:"The sidewalk has puddles and Nora uses a hood.",
      theme:"Evan's paper airplane failed again and again. He changed one fold each time, tested it, and finally made it glide across the room.",
      themeA:"Keep trying and learn from mistakes.",
      visualize:"Golden leaves spun slowly from the tall tree and covered the path like a crunchy blanket.",
      visualA:"A path covered with falling autumn leaves."
    },
    {
      infer:"Mia carried a flashlight into the dark closet and checked behind every box.",
      inferQ:"What can you infer Mia is trying to do?",inferA:"She is searching for something.",
      inferChoices:["She is searching for something.","She is getting ready to sleep.","She is watering plants."],
      evidence:"She checks behind every box with a flashlight.",
      theme:"Jalen could not tie the knot at first. He watched carefully, practiced several times, and then tied it by himself.",
      themeA:"Practice can help you learn a hard skill.",
      visualize:"Tiny raindrops tapped the window while gray clouds covered the sky.",
      visualA:"A gray, rainy scene outside a window."
    }
  ],variant);
  addTriad(out,"mat-reading-skills",{
    subject:"Reading / ELA",tier:"material",
    sourceFact:"Verified current ABVM reading-comprehension skills: visualize and theme",
    hint:"Use details from the passage, not just one familiar word."
  },[
    {
      skill:"inference",prompt:`Read: “${rows.infer}” ${rows.inferQ}`,
      choices:shuffled(rows.inferChoices,"read1"+variant),answer:rows.inferA,
      explanation:`The best inference combines the clues: ${rows.evidence}`,
      dok:3,difficulty:3,
      wrongFeedback:"Choose the answer supported by more than one detail in the passage.",
      misconception:"unsupported-inference"
    },
    {
      skill:"theme",prompt:`Read: “${rows.theme}” What lesson best fits the whole story?`,
      choices:shuffled([rows.themeA,"Things work only when they are easy.","It is better to quit after one mistake."],"read2"+variant),answer:rows.themeA,
      explanation:"The character improves by continuing to work and learn from the problem.",
      dok:3,difficulty:3,
      wrongFeedback:"Theme is the lesson shown by the whole story, especially the character's choices and result.",
      misconception:"theme-vs-detail"
    },
    {
      skill:"visualize",prompt:`Read: “${rows.visualize}” Which mental picture best matches the author's details?`,
      choices:shuffled([rows.visualA,"A bright beach with waves.","A classroom with empty desks."],"read3"+variant),answer:rows.visualA,
      explanation:"The describing words create a specific picture in the reader's mind.",
      dok:2,difficulty:2,
      wrongFeedback:"Match the picture to the exact describing words in the sentence.",
      misconception:"visual-detail-mismatch"
    }
  ]);
  add(out,{
    id:"mat-text-evidence-v"+variant,subject:"Reading / ELA",skill:"text-evidence",tier:"material",
    prompt:"Read: “The kitten crouched low, wiggled its back legs, stared at the toy mouse, and sprang forward.” Which detail is the strongest evidence that the kitten was getting ready to pounce?",
    choices:shuffled(["It crouched low and wiggled its back legs.","It stared at the toy mouse.","The toy mouse was in front of it."],"evidence"+variant),
    answer:"It crouched low and wiggled its back legs.",
    explanation:"Several details relate to the toy, but crouching and wiggling the back legs most directly show preparation to pounce.",
    hint:"Choose the detail that most directly proves the idea.",
    sourceFact:"Verified current ABVM reading-comprehension work",dok:3,difficulty:3,
    wrongFeedback:"Pick the detail that is strongest evidence, not merely related to the topic.",
    misconception:"related-detail-not-best-evidence"
  });
}
function materialReligion(pack,variant,out){
  const source=subjectText(pack,"Religion");
  if(!source)return;
  if(/disciples|Savior|Jesus died for our sins/i.test(source)){
    const row=rowFor([
      {scenario:"A new student is sitting alone at recess. Mia invites the student to join her game.",reason:"She is choosing to love and include another person."},
      {scenario:"After an argument, Leo apologizes and forgives his friend.",reason:"He is choosing love and forgiveness."}
    ],variant);
    addTriad(out,"mat-religion-disciple",{
      subject:"Religion",skill:"religion-application",tier:"material",
      sourceFact:"Verified current ABVM Religion Chapter 2: disciples, Savior, new life in grace",
      hint:"Connect the situation to how a friend and follower of Jesus would act."
    },[
      {
        prompt:"What are friends and followers of Jesus called?",
        choices:shuffled(["disciples","captions","blends"],"rel1"+variant),answer:"disciples",
        explanation:"The current religion material teaches that disciples are friends and followers of Jesus.",
        dok:1,difficulty:2,
        wrongFeedback:"Think about the lesson's word for a person who follows Jesus.",
        misconception:"religion-term-confusion"
      },
      {
        prompt:`${row.scenario} Which lesson idea best matches this action?`,
        choices:shuffled(["Living as a disciple by loving others.","Using creation only for yourself.","Avoiding people who need help."],"rel2"+variant),
        answer:"Living as a disciple by loving others.",
        explanation:row.reason,
        dok:2,difficulty:2,
        wrongFeedback:"A disciple tries to put Jesus' teaching about love into action.",
        misconception:"application-mismatch"
      },
      {
        prompt:"Why is Jesus called our Savior in the current lesson?",
        choices:shuffled(["He died for our sins and gives us new life in grace.","He teaches that people should never make choices.","He is another name for one of the school subjects."],"rel3"+variant),
        answer:"He died for our sins and gives us new life in grace.",
        explanation:"The Chapter 2 notes connect Jesus as Savior with his death for our sins and the gift of new life in grace.",
        dok:3,difficulty:3,
        wrongFeedback:"Use the Chapter 2 idea about Jesus' death, salvation, and new life.",
        misconception:"religion-concept-confusion"
      }
    ]);
  }
  if(/Trinity:\s*3 persons in one God/i.test(source)){
    add(out,{
      id:"mat-religion-trinity-v"+variant,subject:"Religion",skill:"religion-application",tier:"material",
      prompt:"Which statement best explains the Trinity?",
      choices:shuffled(["One God in three Persons: Father, Son, and Holy Spirit.","Three separate gods who are unrelated.","One person with three unrelated jobs."],"trinity"+variant),
      answer:"One God in three Persons: Father, Son, and Holy Spirit.",
      explanation:"The Trinity teaches one God in three divine Persons.",
      hint:"Remember both parts: one God and three Persons.",
      sourceFact:"Verified current ABVM Religion topic: Trinity — 3 persons in one God",
      dok:2,difficulty:2,
      wrongFeedback:"The Trinity is not three gods; the lesson says one God in three Persons.",
      misconception:"trinity-one-vs-three-confusion"
    });
  }
  if(/Gifts from God|Giver of Gifts|God's gifts/i.test(source)){
    const row=rowFor([
      {skill:"music",action:"Playing a cheerful song for someone who is lonely."},
      {skill:"drawing",action:"Making a welcome card for a new student."}
    ],variant);
    add(out,{
      id:"mat-religion-gifts-v"+variant,subject:"Religion",skill:"religion-application",tier:"material",
      prompt:`A student is good at ${row.skill}. Which choice best shows using that gift to love and serve others?`,
      choices:shuffled([row.action,"Using the skill only to brag.","Refusing to use the skill when someone needs help."],"gift"+variant),
      answer:row.action,
      explanation:"The lesson connects gifts with gratitude, love, and service.",
      hint:"Choose the action that helps another person.",
      sourceFact:"Verified current ABVM Religion topic: Gifts from God",
      dok:2,difficulty:2,
      wrongFeedback:"A gift is being used well when it helps or encourages another person.",
      misconception:"gift-self-focus"
    });
  }
  if(/image and likeness|senses|creation/i.test(source)){
    addTriad(out,"mat-religion-creation",{
      subject:"Religion",skill:"religion-application",tier:"material",
      sourceFact:"Verified current ABVM Religion topics: God's image and likeness, senses, and caring for creation",
      hint:"Use the current lesson ideas about thinking, choosing, loving, gratitude, and creation."
    },[
      {
        prompt:"According to the current lesson, which ability helps show that people are made in God's image and likeness?",
        choices:shuffled(["We can think, choose, and love.","We never have to make choices.","Everyone must look exactly the same."],"rel6"+variant),
        answer:"We can think, choose, and love.",
        explanation:"The lesson says people are made in God's image and likeness and can think, choose, and love.",
        dok:1,difficulty:2,
        wrongFeedback:"Remember the lesson's three abilities: think, choose, and love.",
        misconception:"image-likeness-confusion"
      },
      {
        prompt:"Which action best shows taking care of God's gift of creation?",
        choices:shuffled(["Picking up litter at a park.","Leaving trash beside a stream.","Wasting water on purpose."],"rel7"+variant),
        answer:"Picking up litter at a park.",
        explanation:"Caring for creation means protecting and respecting the gifts of the world around us.",
        dok:2,difficulty:2,
        wrongFeedback:"Choose the action that protects rather than harms creation.",
        misconception:"creation-care-mismatch"
      },
      {
        prompt:"Why can using our senses lead us to thank God in the current lesson?",
        choices:shuffled(["Our senses help us notice and enjoy the gifts of creation.","Our senses mean we never need to make choices.","Our senses are only useful at school."],"rel8"+variant),
        answer:"Our senses help us notice and enjoy the gifts of creation.",
        explanation:"The lesson connects our senses with enjoying God's gifts and being thankful for creation.",
        dok:3,difficulty:3,
        wrongFeedback:"Connect seeing, hearing, smelling, tasting, and touching with noticing God's gifts.",
        misconception:"senses-purpose-confusion"
      }
    ]);
  }
}
function fallbackReading(variant,out){
  const rows=[
    {
      id:"star-read-infer-1",skill:"inference",
      prompt:"Read: “Tariq packed an extra water bottle, put on a cap, and rubbed sunscreen on his arms before leaving.” Where is Tariq most likely going?",
      choices:["Somewhere outdoors in sunny weather.","To bed for the night.","Into a snowstorm."],
      answer:"Somewhere outdoors in sunny weather.",
      explanation:"The cap, sunscreen, and water are clues that point to being outside in warm, sunny conditions."
    },
    {
      id:"star-read-theme-1",skill:"theme",
      prompt:"Read: “Ava's tower fell twice. She studied the bottom blocks, rebuilt a wider base, and the third tower stayed up.” What lesson best fits the story?",
      choices:["Learn from mistakes and keep trying.","Never change a plan.","The tallest tower always wins."],
      answer:"Learn from mistakes and keep trying.",
      explanation:"Ava uses earlier failures to improve her next attempt."
    },
    {
      id:"star-read-evidence-1",skill:"text-evidence",
      prompt:"Read: “Ben yawned, rubbed his eyes, and rested his head on the table.” Which detail is the strongest evidence that Ben is tired?",
      choices:["He yawned and rubbed his eyes.","He is near a table.","His name is Ben."],
      answer:"He yawned and rubbed his eyes.",
      explanation:"Those actions most directly show tiredness."
    },
    {
      id:"star-read-purpose-1",skill:"author-purpose",
      prompt:"A paragraph explains three steps for planting a seed in a cup. What is the author's main purpose?",
      choices:["To teach how to do something.","To persuade the reader to buy a toy.","To tell a fantasy story."],
      answer:"To teach how to do something.",
      explanation:"Step-by-step directions are written to teach a process."
    },
    {
      id:"star-read-wordchoice-1",skill:"word-choice",
      prompt:"Read: “The wind whispered through the tall grass.” Why might the author use the word “whispered”?",
      choices:["To help the reader imagine a soft sound.","To prove the wind can really talk.","To tell the exact temperature."],
      answer:"To help the reader imagine a soft sound.",
      explanation:"The word creates a quiet sound image."
    },
    {
      id:"star-read-cause-1",skill:"cause-effect",
      prompt:"Read: “The sidewalk froze overnight, so the school spread salt on it in the morning.” Why did the school spread salt?",
      choices:["Because the sidewalk was icy.","Because the sun was too bright.","Because students needed pencils."],
      answer:"Because the sidewalk was icy.",
      explanation:"The frozen sidewalk caused the school to spread salt."
    }
  ];
  for(const [index,row] of rows.entries()){
    add(out,{
      id:row.id+"-v"+variant,subject:"Reading / ELA",skill:row.skill,tier:"star-fallback",
      prompt:row.prompt,choices:shuffled(row.choices,row.id+variant),answer:row.answer,explanation:row.explanation,
      hint:row.skill==="text-evidence"?"Choose the detail that most directly proves the idea.":"Use the passage clues, not just one familiar word.",
      sourceFact:"Original Grade 2 STAR-aligned Reading practice",dok:index%3===0?1:index%3===1?2:3,difficulty:index%3===2?3:2,
      wrongFeedback:"Go back to the text and choose the answer supported by the strongest clue.",
      misconception:"unsupported-reading-choice"
    });
  }
}
function fallbackMath(variant,out){
  const offset=variant===1?0:3;
  const rows=[
    {
      id:"star-math-two-step",skill:"two-step-word-problem",
      prompt:`A class has ${24+offset} markers. The teacher adds 13 more, then 8 are used. How many markers are left?`,
      answer:String(24+offset+13-8),
      choices:[String(24+offset+13-8),String(24+offset+13),String(24+offset-8)],
      explanation:`First add ${24+offset} + 13 = ${37+offset}. Then subtract 8 to get ${29+offset}.`,
      wrongFeedback:choice=>choice===String(37+offset)?"You stopped after the first step. The story has a second change.":"Do the addition first, then subtract the markers that were used.",
      misconception:choice=>choice===String(37+offset)?"one-step-only":"operation-order",
      dok:3,difficulty:3
    },
    {
      id:"star-math-place",skill:"place-value",
      prompt:`In the number ${462+offset*10}, what value does the 6 represent?`,
      answer:"60",choices:["60","6","600"],
      explanation:"The 6 is in the tens place, so its value is 60.",
      wrongFeedback:"Name the place first: hundreds, tens, or ones.",
      misconception:"digit-vs-place-value",dok:2,difficulty:2
    },
    {
      id:"star-math-compare",skill:"compare-numbers",
      prompt:`Which comparison is true?`,
      answer:`${58+offset} < ${65+offset}`,
      choices:[`${58+offset} < ${65+offset}`,`${58+offset} > ${65+offset}`,`${58+offset} = ${65+offset}`],
      explanation:"Compare the tens first. Five tens is less than six tens.",
      wrongFeedback:"Compare tens before ones.",
      misconception:"comparison-direction",dok:2,difficulty:2
    },
    {
      id:"star-math-time",skill:"time",
      prompt:"A movie starts at 2:15 and lasts 30 minutes. What time does it end?",
      answer:"2:45",choices:["2:45","2:30","3:15"],
      explanation:"Thirty minutes after 2:15 is 2:45.",
      wrongFeedback:"Count forward 30 minutes from the starting time.",
      misconception:"elapsed-time",dok:2,difficulty:2
    },
    {
      id:"star-math-measure",skill:"measurement",
      prompt:"A ribbon is 36 centimeters long. Mia cuts off 9 centimeters. How long is the ribbon now?",
      answer:"27 centimeters",choices:["27 centimeters","45 centimeters","25 centimeters"],
      explanation:"The ribbon gets shorter, so subtract: 36 − 9 = 27.",
      wrongFeedback:"Because some ribbon is cut off, the length should decrease.",
      misconception:"measurement-operation",dok:2,difficulty:2
    },
    {
      id:"star-math-data",skill:"data-interpretation",
      prompt:"A class chart shows 7 votes for apples, 5 for bananas, and 3 for grapes. How many more votes did apples get than grapes?",
      answer:"4",choices:["4","10","2"],
      explanation:"Compare apples and grapes: 7 − 3 = 4.",
      wrongFeedback:"“How many more” asks for the difference between the two categories.",
      misconception:"data-comparison",dok:2,difficulty:2
    }
  ];
  for(const row of rows){
    add(out,{
      id:row.id+"-v"+variant,subject:"Math",skill:row.skill,tier:"star-fallback",
      prompt:row.prompt,choices:shuffled(row.choices,row.id+variant),answer:row.answer,explanation:row.explanation,
      hint:row.skill==="two-step-word-problem"?"Solve the first change, write the new amount, then solve the second change.":"Use the math relationship in the question before calculating.",
      sourceFact:"Original Grade 2 STAR-aligned Math practice",dok:row.dok,difficulty:row.difficulty,
      wrongFeedback:row.wrongFeedback,misconception:row.misconception
    });
  }
}
function validateQuestion(question){
  const issues=[];
  if(!question||typeof question!=="object")return ["question-missing"];
  if(!text(question.id))issues.push("id-missing");
  if(text(question.prompt).length<20)issues.push("prompt-too-short");
  for(const pattern of FORBIDDEN)if(pattern.test(question.prompt))issues.push("forbidden-meta-prompt");
  if(!Array.isArray(question.choices)||question.choices.length!==3)issues.push("choices-not-three");
  else{
    if(new Set(question.choices).size!==3)issues.push("choices-duplicate");
    if(!question.choices.includes(question.answer))issues.push("answer-not-in-choices");
  }
  if(!text(question.explanation))issues.push("explanation-missing");
  if(!text(question.hint))issues.push("hint-missing");
  if(!["material","star-fallback"].includes(question.tier))issues.push("tier-invalid");
  if(!Number.isInteger(question.dok)||question.dok<1||question.dok>3)issues.push("dok-invalid");
  if(!Number.isInteger(question.difficulty)||question.difficulty<2||question.difficulty>3)issues.push("difficulty-invalid");
  if(!Array.isArray(question.standards)||question.standards.length===0)issues.push("standards-missing");
  if(!text(question.domain))issues.push("domain-missing");
  if(!question.choiceDiagnostics||typeof question.choiceDiagnostics!=="object")issues.push("diagnostics-missing");
  else{
    for(const choice of question.choices){
      if(choice===question.answer)continue;
      if(!text(question.choiceDiagnostics[choice]?.feedback))issues.push("wrong-feedback-missing");
      if(!text(question.choiceDiagnostics[choice]?.misconception))issues.push("misconception-missing");
    }
  }
  if(question.rubric?.maxPoints!==2||!Array.isArray(question.rubric?.criteria)||question.rubric.criteria.length<2)issues.push("rubric-invalid");
  if(question.sourceTransform!==SOURCE_TRANSFORM||question.originalEquivalent!==true)issues.push("source-transform-invalid");
  return [...new Set(issues)];
}
function validateCatalog(catalog){
  const issues=[],ids=new Set(),doks=new Set(),tiers=new Set();
  for(const question of catalog?.questions||[]){
    if(ids.has(question.id))issues.push({id:question.id,issue:"duplicate-id"});
    ids.add(question.id);doks.add(question.dok);tiers.add(question.tier);
    for(const issue of validateQuestion(question))issues.push({id:question.id,issue});
  }
  if(!doks.has(1)||!doks.has(2)||!doks.has(3))issues.push({id:"catalog",issue:"dok-range-incomplete"});
  if(!tiers.has("star-fallback"))issues.push({id:"catalog",issue:"fallback-tier-missing"});
  if(catalog?.qualityPolicy?.materialExpected!==false&&!tiers.has("material"))issues.push({id:"catalog",issue:"tier-mix-incomplete"});
  return issues;
}
function buildCatalog(pack,{sourceKey}={}){
  const key=text(sourceKey||pack?.sourceHash||pack?.sourceCheckedAt||pack?.weekLabel||"abvm-current");
  const variant=variantFor(key),questions=[];
  materialContentPipeline(pack,questions);

  const legacyMaterial=[];
  materialMath(pack,variant,legacyMaterial);
  materialSentences(pack,variant,legacyMaterial);
  materialPhonics(pack,variant,legacyMaterial);
  materialHighFrequency(pack,variant,legacyMaterial);
  materialVocabulary(pack,variant,legacyMaterial);
  materialReading(pack,variant,legacyMaterial);
  materialReligion(pack,variant,legacyMaterial);

  const pipelineSkills=Array.isArray(pack?.contentPipeline?.skills)
    ?new Set(pack.contentPipeline.skills.map(skill=>text(skill?.id)).filter(Boolean))
    :null;
  questions.push(...(pipelineSkills
    ?legacyMaterial.filter(question=>pipelineSkills.has(question.skill)&&question.skill!=="vocabulary-in-context")
    :legacyMaterial));

  fallbackReading(variant,questions);
  fallbackMath(variant,questions);
  const deduped=[],seen=new Set();
  for(const question of questions){
    const signature=question.prompt+"|"+question.answer;
    if(seen.has(signature))continue;
    seen.add(signature);deduped.push(question);
  }
  const catalog={
    schemaVersion:2,engineVersion:VERSION,sourceTransform:SOURCE_TRANSFORM,
    sourceKey:key,generationVariant:variant,
    qualityPolicy:{
      materialFirst:true,
      minimumDifficulty:2,
      forbiddenMetaPrompts:true,
      standardsRequired:true,
      dokRequired:true,
      diagnosticDistractors:true,
      targetedWrongFeedback:true,
      analyticRubric:true,
      starFallbackOriginalOnly:true,
      materialExpected:pipelineSkills?pipelineSkills.size>0:true
    },
    questionCount:deduped.length,questions:deduped
  };
  const issues=validateCatalog(catalog);
  if(issues.length)throw new Error("ABVM study-game catalog validation failed: "+JSON.stringify(issues));
  return catalog;
}
function assessmentSkillIds(pack,test){
  const label=text(test?.x?.label).toLowerCase();
  const available=new Set((pack?.contentPipeline?.skills||[]).map(skill=>text(skill?.id)).filter(Boolean));
  const wanted=[];
  const add=id=>{if(available.has(id)&&!wanted.includes(id))wanted.push(id);};
  if(/grammar|types of sentences/.test(label))add("sentence-types");
  if(/short a|long a|a_e/.test(label))add("long-short-a");
  if(/consonant blend/.test(label))add("consonant-blends");
  if(/cvc/.test(label))add("cvc-structure");
  if(/-ed|-ing|ed\b.*ing\b/.test(label))add("suffix-ed-ing");
  if(/sight word|high[- ]frequency/.test(label))add("high-frequency-word-use");
  if(/theme/.test(label))add("theme");
  if(/visualiz/.test(label))add("visualize");
  if(/sequence|beginning.*middle.*end|plot/.test(label))add("sequence");
  if(/caption|text feature/.test(label))add("caption");
  if(/dialogue/.test(label))add("dialogue");
  if(/infer/.test(label))add("inference");
  if(/cause.*effect|effect.*cause/.test(label))add("cause-effect");
  if(/setting/.test(label))add("setting");
  if(/genre/.test(label))add("genre");
  if(/character/.test(label)&&/feeling/.test(label))add("character-feelings");
  if(/main character/.test(label))add("main-character");
  if(/subtraction/.test(label)){
    const exact=[...available].find(id=>/^subtraction-within-\d+$/.test(id));
    if(exact)add(exact);
  }
  if(/addition/.test(label)){
    const exact=[...available].find(id=>/^addition-within-\d+$/.test(id));
    if(exact)add(exact);
  }
  if(/place value/.test(label))add("place-value");
  if(/money|coin/.test(label))add("money");
  return wanted;
}
function testReadyMode(pack,test){
  const skills=assessmentSkillIds(pack,test);
  if(!test||!skills.length)return null;
  return Object.freeze({
    id:"test-ready",title:"Test Ready",subjects:[],skills,preferredSkills:skills,count:5,
    copy:"Five questions focused only on the verified skills for "+text(test.x?.label||"this week’s test")+"."
  });
}
function targetDifficultyFor(skillStats,skill){
  const row=skillStats?.[skill]||{};
  if((Number(row.ConsecutiveCorrect)||0)>=2)return 3;
  if((Number(row.ConsecutiveWrong)||0)>=2)return 2;
  return Math.max(2,Math.min(3,Number(row.TargetDifficulty)||2));
}
function reviewPriority(skillStats,skill,now=Date.now()){
  const row=skillStats?.[skill]||{};
  const seen=Number(row.Seen)||0;
  if(!seen)return 1.5;
  const hasEvidenceFields=Object.prototype.hasOwnProperty.call(row,"IndependentCorrect")||Object.prototype.hasOwnProperty.call(row,"CorrectAfterRetry");
  const independent=hasEvidenceFields?(Number(row.IndependentCorrect)||0):(Number(row.Correct)||0);
  const recovered=hasEvidenceFields?(Number(row.CorrectAfterRetry)||0):0;
  const wrong=Number(row.Wrong)||0;
  const effectiveCorrect=independent+(recovered*0.5);
  const mastery=(effectiveCorrect+1)/(Math.max(seen,independent+recovered+wrong)+2);
  const last=Number(row.LastIndependentAt)||Number(row.LastSeenAt)||0;
  const ageDays=last?Math.max(0,(now-last)/86400000):3;
  const intervalDays=mastery>=0.85?4:mastery>=0.7?2:1;
  const overdue=Math.min(3,ageDays/intervalDays);
  const need=(1-mastery)*2;
  const missBonus=(Number(row.ConsecutiveWrong)||0)>0?1:0;
  const supportedBonus=(Number(row.CorrectAfterRetry)||0)>0&&!(Number(row.LastIndependentCorrectAt)||0)?0.5:0;
  return overdue+need+missBonus+supportedBonus;
}
const RECENT_VARIANTS_KEY="abvm-study-recent-variants:v1";
function variantKey(question){return text(question?.variantFingerprint||question?.contentFingerprint||(question?.id?String(hash(question.id)):""))}
function readRecentVariants(sourceKey){
  try{
    const parsed=JSON.parse(localStorage.getItem(RECENT_VARIANTS_KEY)||"{}");
    return parsed?.sourceKey===sourceKey&&Array.isArray(parsed?.variants)?parsed.variants:[];
  }catch{return []}
}
function rememberSelectedVariants(sourceKey,questions){
  if(!sourceKey)return [];
  const prior=readRecentVariants(sourceKey),next=[...prior,...(questions||[]).map(variantKey).filter(Boolean)];
  const variants=[...new Set(next.slice(-24))];
  try{localStorage.setItem(RECENT_VARIANTS_KEY,JSON.stringify({sourceKey,variants}))}catch{}
  return variants;
}
function pickBalanced(pool,count,seed,skillStats,preferredSkills=[],recentVariants=[]){
  const selected=[],used=new Set(),skillCounts={},preferred=new Set(preferredSkills||[]),recent=new Set(recentVariants||[]),now=Date.now();
  const skillTotal=new Set(pool.map(q=>q.skill)).size,maxPerSkill=skillTotal>=3?2:skillTotal===2?Math.min(3,count):Math.max(1,count);
  const ordered=[...pool].sort((a,b)=>{
    if(a.tier!==b.tier)return a.tier==="material"?-1:1;
    if(preferred.has(a.skill)!==preferred.has(b.skill))return preferred.has(a.skill)?-1:1;
    const ra=reviewPriority(skillStats,a.skill,now),rb=reviewPriority(skillStats,b.skill,now);
    if(ra!==rb)return rb-ra;
    const ar=recent.has(variantKey(a)),br=recent.has(variantKey(b));if(ar!==br)return ar?1:-1;
    const ta=Math.abs(a.difficulty-targetDifficultyFor(skillStats,a.skill));
    const tb=Math.abs(b.difficulty-targetDifficultyFor(skillStats,b.skill));
    if(ta!==tb)return ta-tb;
    return hash(seed+"|"+a.id)-hash(seed+"|"+b.id);
  });
  while(selected.length<Math.min(count,ordered.length)){
    const underCap=ordered.filter(q=>!used.has(q.id)&&(skillCounts[q.skill]||0)<maxPerSkill);
    const remaining=underCap.length?underCap:ordered.filter(q=>!used.has(q.id));
    if(!remaining.length)break;
    const material=remaining.filter(q=>q.tier==="material"),tierPool=material.length?material:remaining;
    let candidate=tierPool.find(q=>{
      const last=selected[selected.length-1],lastTwo=selected.slice(-2);
      if(last&&last.skill===q.skill&&tierPool.some(other=>other.skill!==q.skill))return false;
      if(lastTwo.length===2&&lastTwo[0].questionType===lastTwo[1].questionType&&q.questionType===last.questionType&&tierPool.some(other=>other.questionType!==q.questionType))return false;
      return true;
    });
    if(!candidate)candidate=tierPool[0];
    selected.push(candidate);used.add(candidate.id);skillCounts[candidate.skill]=(skillCounts[candidate.skill]||0)+1;
  }
  return selected;
}
function selectQuestions(catalog,{subjects,skills,count=8,seed="session",skillStats={},preferredSkills=[]}={}){
  let pool=[...(catalog?.questions||[])];
  const wanted=Array.isArray(subjects)?subjects.map(text).filter(Boolean):[];
  const wantedSkills=Array.isArray(skills)?skills.map(text).filter(Boolean):[];
  if(wanted.length)pool=pool.filter(q=>wanted.includes(q.subject));
  if(wantedSkills.length)pool=pool.filter(q=>wantedSkills.includes(q.skill));
  if(wanted.length||wantedSkills.length)pool=pool.filter(q=>q.tier==="material");
  return pickBalanced(pool,count,seed,skillStats,preferredSkills,readRecentVariants(catalog?.sourceKey));
}
function supportQuestion(catalog,current,{skillStats={},seed="support"}={}){
  if(!current)return null;
  const candidates=(catalog?.questions||[])
    .filter(q=>q.id!==current.id&&q.skill===current.skill&&q.difficulty<=2)
    .sort((a,b)=>hash(seed+a.id)-hash(seed+b.id));
  return candidates[0]||null;
}

function teachCardFor(question){
  if(!question?.skill)return null;
  const cards={
    "sentence-types":["Ask what job the sentence does.","A statement tells, a question asks, a command directs, and an exclamation shows strong feeling."],
    "consonant-blends":["Listen for both beginning consonant sounds.","In “flag,” you can hear both /f/ and /l/."],
    "cvc-structure":["Check the three letter types from left to right.","“Map” is consonant-vowel-consonant: m-a-p."],
    "long-short-a":["Compare the vowel sound and the spelling pattern.","Short a: cat. Long a with a_e: game."],
    "suffix-ed-ing":["Use the sentence’s time clue to choose the ending.","-ed often marks a finished action; -ing often marks an action happening now."],
    "high-frequency-word-use":["Read the whole sentence with each choice.","Choose the current high-frequency word that makes both the grammar and meaning work."],
    "theme":["Look for the lesson shown by the whole story.","A theme is bigger than one small detail."],
    "visualize":["Turn the describing words into a mental picture.","Use only details the text actually gives."],
    "sequence":["Track what happens first, next, and last.","A strong sequence has an order supported by the events, not just a random arrangement."],
    "caption":["Match a short text feature to what a picture or diagram actually shows.","A useful caption directly describes or explains the visual."],
    "inference":["Combine a text clue with what you already know.","The answer still has to be supported by the clue."],
    "cause-effect":["Find what happened first and what happened because of it.","The cause leads to the effect."],
    "main-character":["Ask who the story follows most.","The main character is the person or animal whose actions drive most of the story."],
    "setting":["Find both where and when.","A setting can be “at the lake at sunset”: place plus time."],
    "character-feelings":["Use what the character says and does as clues.","Actions such as smiling or hiding can show feelings."],
    "genre":["Look for the features that tell what kind of text it is.","Magic and impossible creatures are clues for fantasy."],
    "place-value":["Name the digit’s place before its value.","In 347, the 4 is in the tens place, so it is worth 40."],
    "compare-numbers":["Compare the greatest place first.","If the hundreds match, compare tens next."],
    "time":["Read the minute hand before deciding the hour.","A minute hand on 6 means 30 minutes past the hour."],
    "money":["Name each coin value before adding.","Quarter 25¢ + dime 10¢ = 35¢."],
    "religion-trinity":["Use the exact current lesson statement.","The lesson names Father, Son, and Holy Spirit as the three Persons of the Trinity."],
    "religion-creation-care":["Choose the action that protects rather than harms creation.","Caring for a park is an example of caring for creation."],
    "religion-image-likeness":["Connect the lesson to thinking, choosing, and loving.","Use the current lesson wording rather than guessing about a person’s character."],
    "religion-jesus-savior":["Use the current lesson’s Savior and grace statement.","Answer from the Religion lesson, not from an unrelated fact."],
    "religion-disciples":["Use the current lesson’s definition of disciple.","A disciple is described as a friend and follower of Jesus."],
    "religion-mary-church":["Use the exact titles for Mary in the current lesson.","The lesson identifies Mary as Jesus’ mother and the mother of the Church."],
    "religion-seed-new-life":["Connect the seed comparison to the lesson’s phrase about new life in grace.","The lesson compares a seed producing new growth after dying with Jesus giving new life in grace."],
    "religion-gifts-choices":["Apply the current lesson by choosing a helpful, responsible use of a gift.","The best example should clearly serve or help another person."],
    "religion-five-senses":["Connect the five senses with noticing creation.","Seeing, hearing, smelling, tasting, and touching help us notice the world around us."]
  };
  const row=cards[question.skill];
  if(row)return{instruction:row[0],example:row[1]};
  if(/^subtraction-within-\d+$/.test(question.skill))return{instruction:"Subtraction means taking away or finding what remains.",example:"Example: 8 − 3 = 5."};
  if(/^addition-within-\d+$/.test(question.skill))return{instruction:"Addition joins amounts to find a total.",example:"Example: 5 + 4 = 9."};
  return{instruction:text(question.hint||"Use the key rule for this skill before answering."),example:""};
}

function comebackQuestion(catalog,current,{seed="comeback",seenIds=[]}={}){
  if(!current)return null;
  const seen=new Set(Array.isArray(seenIds)?seenIds:[]);
  const candidates=(catalog?.questions||[])
    .filter(q=>q.id!==current.id&&q.skill===current.skill)
    .sort((a,b)=>{
      const aSeen=seen.has(a.id),bSeen=seen.has(b.id);
      if(aSeen!==bSeen)return aSeen?1:-1;
      const aType=a.questionType===current.questionType,bType=b.questionType===current.questionType;
      if(aType!==bType)return aType?1:-1;
      const aDistance=Math.abs((Number(a.difficulty)||2)-(Number(current.difficulty)||2));
      const bDistance=Math.abs((Number(b.difficulty)||2)-(Number(current.difficulty)||2));
      if(aDistance!==bDistance)return aDistance-bDistance;
      return hash(seed+"|"+a.id)-hash(seed+"|"+b.id);
    });
  return candidates[0]||null;
}

const GAME_RECORD_PREFIX="abvm-study-games:";
function gameRecordKey(sourceKey,modeId){return GAME_RECORD_PREFIX+String(sourceKey||"current")+":"+String(modeId||"quick")}
function loadGameRecord(sourceKey,modeId){
  try{
    const value=JSON.parse(localStorage.getItem(gameRecordKey(sourceKey,modeId))||"{}");
    return {best:Number(value.best)||0,plays:Number(value.plays)||0,totalCorrect:Number(value.totalCorrect)||0,totalAnswered:Number(value.totalAnswered)||0};
  }catch{return {best:0,plays:0,totalCorrect:0,totalAnswered:0}}
}
function saveGameRecord(sourceKey,modeId,{score=0,total=0}={}){
  const record=loadGameRecord(sourceKey,modeId);
  const next={best:Math.max(record.best,Number(score)||0),plays:record.plays+1,totalCorrect:record.totalCorrect+(Number(score)||0),totalAnswered:record.totalAnswered+(Number(total)||0)};
  try{localStorage.setItem(gameRecordKey(sourceKey,modeId),JSON.stringify(next))}catch{}
  return next;
}
const LEARNING_STORAGE_KEY="abvm-study-learning:v2";
const COMEBACK_STORAGE_KEY="abvm-study-comebacks:v1";
const ITEM_QUALITY_STORAGE_KEY="abvm-study-item-quality:v1";
const itemShownAt=new Map();
function loadItemQuality(){
  try{
    const parsed=JSON.parse(localStorage.getItem(ITEM_QUALITY_STORAGE_KEY)||"{}");
    return parsed&&parsed.schemaVersion===1&&parsed.items&&typeof parsed.items==="object"?parsed:{schemaVersion:1,items:{}};
  }catch{return {schemaVersion:1,items:{}}}
}
function writeItemQuality(data){
  const source=data?.items&&typeof data.items==="object"?data.items:{};
  const entries=Object.entries(source).sort((a,b)=>(Number(b[1]?.LastUpdatedAt)||0)-(Number(a[1]?.LastUpdatedAt)||0)).slice(0,250);
  const safe={schemaVersion:1,items:Object.fromEntries(entries)};
  try{localStorage.setItem(ITEM_QUALITY_STORAGE_KEY,JSON.stringify(safe))}catch{}
  return safe;
}
function itemQualityKey(question){
  const stable=String(question?.variantFingerprint||question?.contentFingerprint||question?.id||"");
  return stable?"q"+hash(stable).toString(36):"";
}
function markQuestionShown(question){
  const key=itemQualityKey(question);if(!key)return;
  const previous=itemShownAt.get(key),now=Date.now();
  if(!previous||now-previous>600000)itemShownAt.set(key,now);
}
function responseTimeBand(start,now){
  const ms=Math.max(0,Number(now)-Number(start));
  return ms<5000?"lt5":ms<15000?"5to15":ms<30000?"15to30":"gte30";
}
function itemQualityRow(data,question){
  const id=itemQualityKey(question);
  const row=data.items[id]||{
    Skill:String(question?.skill||""),Subject:String(question?.subject||""),Resolved:0,Correct:0,Wrong:0,
    NormalResolved:0,NormalCorrect:0,NormalWrong:0,FirstTryCorrect:0,ChoicePositions:[0,0,0],Misconceptions:{},
    ResponseBands:{lt5:0,"5to15":0,"15to30":0,gte30:0},HintsUsed:0,SupportSeen:0,ComebackSeen:0,ComebackCorrect:0,
    AbilityN:0,AbilitySum:0,AbilitySumSq:0,FirstTryAbilitySum:0
  };
  return {id,row};
}
function noteItemAttempt(question,index){
  if(!itemQualityKey(question)||!Number.isInteger(index)||index<0||index>2)return null;
  const data=loadItemQuality(),{id,row}=itemQualityRow(data,question);
  row.ChoicePositions[index]=(Number(row.ChoicePositions[index])||0)+1;
  const choice=question.choices?.[index];
  if(choice!==question.answer){
    const tag=choice?question.choiceDiagnostics?.[choice]?.misconception:null;
    if(tag)row.Misconceptions[tag]=(Number(row.Misconceptions[tag])||0)+1;
  }
  row.LastUpdatedAt=Date.now();data.items[id]=row;writeItemQuality(data);return row;
}
function pointBiserial(row){
  const n=Number(row?.AbilityN)||0,c=Number(row?.FirstTryCorrect)||0,w=n-c;
  if(n<2||c<1||w<1)return null;
  const sum=Number(row.AbilitySum)||0,sumSq=Number(row.AbilitySumSq)||0,correctSum=Number(row.FirstTryAbilitySum??row.CorrectAbilitySum)||0;
  const variance=Math.max(0,(sumSq/n)-Math.pow(sum/n,2)),sd=Math.sqrt(variance);
  if(!sd)return null;
  const p=c/n,q=1-p;if(!p||!q)return null;
  const mean1=correctSum/c,mean0=(sum-correctSum)/w;
  return (mean1-mean0)/sd*Math.sqrt(p*q);
}
function recordItemQuality(question,correct,{attemptCount=1,incorrectCount=correct?0:1,hintCount=0,kind="normal",priorMastery=.5}={}){
  const key=itemQualityKey(question);if(!key)return null;
  const data=loadItemQuality(),{id,row}=itemQualityRow(data,question),now=Date.now(),start=itemShownAt.get(key);itemShownAt.delete(key);
  row.Resolved=(Number(row.Resolved)||0)+1;correct?row.Correct=(Number(row.Correct)||0)+1:row.Wrong=(Number(row.Wrong)||0)+1;
  const attempts=Math.max(1,Number(attemptCount)||1),incorrect=Math.max(0,Number(incorrectCount)||0),hints=Math.max(0,Number(hintCount)||0);
  row.HintsUsed=(Number(row.HintsUsed)||0)+hints;
  if(kind==="normal"){
    row.NormalResolved=(Number(row.NormalResolved)||0)+1;correct?row.NormalCorrect=(Number(row.NormalCorrect)||0)+1:row.NormalWrong=(Number(row.NormalWrong)||0)+1;
    const firstTry=!!correct&&attempts===1&&incorrect===0&&hints===0;
    if(firstTry)row.FirstTryCorrect=(Number(row.FirstTryCorrect)||0)+1;
    if(start)row.ResponseBands[responseTimeBand(start,now)]=(Number(row.ResponseBands[responseTimeBand(start,now)])||0)+1;
    const ability=Math.max(0,Math.min(1,Number(priorMastery)||0));
    row.AbilityN=(Number(row.AbilityN)||0)+1;row.AbilitySum=(Number(row.AbilitySum)||0)+ability;row.AbilitySumSq=(Number(row.AbilitySumSq)||0)+ability*ability;
    if(firstTry)row.FirstTryAbilitySum=(Number(row.FirstTryAbilitySum)||0)+ability;
  }else if(kind==="support")row.SupportSeen=(Number(row.SupportSeen)||0)+1;
  else if(kind==="comeback"){row.ComebackSeen=(Number(row.ComebackSeen)||0)+1;if(correct)row.ComebackCorrect=(Number(row.ComebackCorrect)||0)+1}
  row.LastUpdatedAt=now;data.items[id]=row;writeItemQuality(data);return row;
}
function reviewItemQuality(data=loadItemQuality()){
  const out=[];
  for(const [id,row] of Object.entries(data?.items||{})){
    const n=Number(row.NormalResolved??row.Resolved)||0;if(!n)continue;
    const correct=Number(row.NormalCorrect??row.Correct)||0,accuracy=correct/n,firstTry=(Number(row.FirstTryCorrect)||0)/n;
    const flags=[],bands=row.ResponseBands||{},slow=Number(bands.gte30)||0,mis=Object.entries(row.Misconceptions||{}).sort((a,b)=>Number(b[1])-Number(a[1]));
    if(n>=8&&firstTry>=.95)flags.push("too-easy");
    if(n>=8&&firstTry<=.35)flags.push("too-hard");
    if(n>=6&&slow/n>=.5)flags.push("slow-response");
    const wrongAttempts=mis.reduce((sum,item)=>sum+Number(item[1]||0),0);
    if(wrongAttempts>=4&&mis[0]&&Number(mis[0][1])/wrongAttempts>=.6)flags.push("dominant-misconception");
    if(wrongAttempts>=6&&firstTry>.35&&firstTry<.7&&mis[1]&&Number(mis[0][1])/wrongAttempts>=.25&&Number(mis[1][1])/wrongAttempts>=.25)flags.push("possible-ambiguity");
    const discrimination=pointBiserial(row),discriminationReady=n>=12&&discrimination!==null;
    if(discriminationReady&&discrimination<.1)flags.push("low-discrimination");
    out.push({id,skill:row.Skill,subject:row.Subject,resolved:n,accuracy,firstTryRate:firstTry,discrimination,discriminationEvidence:discriminationReady?"reviewable":"insufficient-evidence",method:"classical-longitudinal-proxy",irtUsed:false,comebackRate:(Number(row.ComebackSeen)||0)?(Number(row.ComebackCorrect)||0)/(Number(row.ComebackSeen)||1):null,flags,dominantMisconception:mis[0]?.[0]||null});
  }
  return out.sort((a,b)=>b.flags.length-a.flags.length||b.resolved-a.resolved||a.id.localeCompare(b.id));
}
function loadLearning(){
  try{
    const parsed=JSON.parse(localStorage.getItem(LEARNING_STORAGE_KEY)||"{}");
    return parsed&&typeof parsed==="object"?parsed:{};
  }catch{return {}}
}
function writeLearning(all){try{localStorage.setItem(LEARNING_STORAGE_KEY,JSON.stringify(all))}catch{};return all}
function priorAbility(all,exclude){
  let seen=0,correct=0;
  for(const [skill,row] of Object.entries(all||{})){
    if(skill===exclude)continue;
    const n=Math.max(0,Number(row?.Seen)||0);if(!n)continue;
    seen+=n;correct+=Math.min(n,Math.max(0,Number(row?.IndependentCorrect)||Number(row?.Correct)||0));
  }
  return seen?correct/seen:.5;
}
function recordLearning(question,correct,{attemptCount=1,incorrectCount=correct?0:1,hintCount=0}={}){
  if(!question?.skill)return null;
  const all=loadLearning(),row=all[question.skill]||{Seen:0,Correct:0,Wrong:0,ConsecutiveCorrect:0,ConsecutiveWrong:0,TargetDifficulty:2},now=Date.now(),priorMastery=priorAbility(all,question.skill);
  const attempts=Math.max(1,Number(attemptCount)||1),incorrect=Math.max(0,Number(incorrectCount)||0),hints=Math.max(0,Number(hintCount)||0);
  const independent=!!correct&&incorrect===0&&hints===0;
  row.Seen=(Number(row.Seen)||0)+1;
  row.Attempts=(Number(row.Attempts)||0)+attempts;
  row.IncorrectAttempts=(Number(row.IncorrectAttempts)||0)+incorrect;
  row.HintsUsed=(Number(row.HintsUsed)||0)+hints;
  row.LastSeenAt=now;
  if(correct){
    row.Correct=(Number(row.Correct)||0)+1;
    if(independent){
      row.FirstTryCorrect=(Number(row.FirstTryCorrect)||0)+1;
      row.IndependentCorrect=(Number(row.IndependentCorrect)||0)+1;
      row.ConsecutiveCorrect=(Number(row.ConsecutiveCorrect)||0)+1;
      row.ConsecutiveWrong=0;
      row.LastIndependentAt=now;
      row.LastIndependentCorrectAt=now;
      if(row.ConsecutiveCorrect>=2)row.TargetDifficulty=3;
    }else{
      row.CorrectAfterRetry=(Number(row.CorrectAfterRetry)||0)+1;
      if(hints>0)row.HintedCorrect=(Number(row.HintedCorrect)||0)+1;
      row.ConsecutiveCorrect=0;
      row.ConsecutiveWrong=0;
    }
  }else{
    row.Wrong=(Number(row.Wrong)||0)+1;
    row.ConsecutiveWrong=(Number(row.ConsecutiveWrong)||0)+1;
    row.ConsecutiveCorrect=0;
    if(row.ConsecutiveWrong>=2)row.TargetDifficulty=2;
  }
  row.LastResolution={correct:!!correct,independent,attemptCount:attempts,incorrectCount:incorrect,hintCount:hints,resolvedAt:now};
  recordItemQuality(question,correct,{attemptCount:attempts,incorrectCount:incorrect,hintCount:hints,kind:"normal",priorMastery});
  all[question.skill]=row;writeLearning(all);return row;
}
function recordAuxLearning(question,correct,kind){
  if(!question?.skill)return null;
  const all=loadLearning(),row=all[question.skill]||{Seen:0,Correct:0,Wrong:0,ConsecutiveCorrect:0,ConsecutiveWrong:0,TargetDifficulty:2},now=Date.now(),priorMastery=priorAbility(all,question.skill);
  row.LastSeenAt=now;
  if(kind==="support"){row.SupportSeen=(Number(row.SupportSeen)||0)+1;row.LastSupportAt=now;correct?row.SupportedCorrect=(Number(row.SupportedCorrect)||0)+1:row.SupportedWrong=(Number(row.SupportedWrong)||0)+1;}
  else{row.ComebackSeen=(Number(row.ComebackSeen)||0)+1;row.LastComebackAt=now;correct?row.RememberedLater=(Number(row.RememberedLater)||0)+1:row.ComebackWrong=(Number(row.ComebackWrong)||0)+1;}
  recordItemQuality(question,correct,{kind,priorMastery});
  all[question.skill]=row;writeLearning(all);return row;
}
function recordSupport(question,correct){return recordAuxLearning(question,correct,"support")}
function recordComeback(question,correct){return recordAuxLearning(question,correct,"comeback")}
function nextSessionSeed(sourceKey,modeId){
  const key="abvm-study-games-session:"+String(sourceKey||"current")+":"+String(modeId||"quick");
  let next=1;
  try{next=(Number(localStorage.getItem(key))||0)+1;localStorage.setItem(key,String(next))}catch{}
  return String(sourceKey||"current")+"|"+String(modeId||"quick")+"|"+next;
}
function readComebacks(){
  try{
    const parsed=JSON.parse(localStorage.getItem(COMEBACK_STORAGE_KEY)||"[]");
    return Array.isArray(parsed)?parsed.filter(row=>row&&row.sourceKey&&row.questionId&&row.skill):[];
  }catch{return []}
}
function writeComebacks(rows){
  const safe=(Array.isArray(rows)?rows:[]).slice(-20);
  try{localStorage.setItem(COMEBACK_STORAGE_KEY,JSON.stringify(safe))}catch{}
  return safe;
}
function scheduleComeback(catalog,current,{sourceKey,seenIds=[],seed="comeback",remaining=2}={}){
  if(!catalog||!current||!sourceKey)return null;
  const rows=readComebacks();
  if(rows.some(row=>row.sourceKey===sourceKey&&row.originQuestionId===current.id))return null;
  const sibling=comebackQuestion(catalog,current,{seed,seenIds});
  if(!sibling)return null;
  const row={
    key:sourceKey+"|"+String(current.id||"origin")+"|"+String(sibling.id||"sibling"),
    sourceKey,questionId:sibling.id,originQuestionId:current.id,skill:current.skill,
    remaining:Math.max(0,Number(remaining)||0)
  };
  rows.push(row);writeComebacks(rows);
  return {row,question:sibling};
}
function tickComebacks(sourceKey){
  const rows=readComebacks();let changed=false;
  for(const row of rows){
    if(row.sourceKey!==sourceKey||Number(row.remaining)<=0)continue;
    row.remaining=Math.max(0,Number(row.remaining)-1);changed=true;
  }
  if(changed)writeComebacks(rows);
  return rows;
}
function deferComebacksToNextSession(sourceKey){
  const rows=readComebacks();let changed=false;
  for(const row of rows){
    if(row.sourceKey===sourceKey&&Number(row.remaining)>0){row.remaining=0;changed=true;}
  }
  if(changed)writeComebacks(rows);
  return rows;
}
function dueComeback(catalog,sourceKey){
  const rows=readComebacks();
  const row=rows.find(item=>item.sourceKey===sourceKey&&Number(item.remaining)<=0);
  if(!row)return null;
  const question=(catalog?.questions||[]).find(item=>item.id===row.questionId);
  if(!question){writeComebacks(rows.filter(item=>item!==row));return null}
  return {row,question};
}
function resolveComeback(key){
  if(!key)return readComebacks();
  return writeComebacks(readComebacks().filter(row=>row.key!==key));
}
function sourceKeyFromEnvelope(pack,envelope){
  const hashes=(envelope?.sourcePages||[]).map(row=>row.contentHash).filter(Boolean).join("|");
  const source=hashes||text(pack?.sourceHash||pack?.sourceCheckedAt||pack?.weekLabel||"abvm-current");
  const bank=text(pack?.contentPipeline?.bankFingerprint||"legacy-bank");
  return source+"|bank:"+bank;
}
window.ABVMStudyGames=Object.freeze({
  VERSION,SOURCE_TRANSFORM,MATERIAL_PROVENANCE,FALLBACK_PROVENANCE,FORBIDDEN,
  buildCatalog,validateCatalog,selectQuestions,rememberSelectedVariants,readRecentVariants,supportQuestion,teachCardFor,comebackQuestion,scheduleComeback,tickComebacks,deferComebacksToNextSession,dueComeback,resolveComeback,loadLearning,recordLearning,recordSupport,recordComeback,nextSessionSeed,loadGameRecord,saveGameRecord,sourceKeyFromEnvelope,targetDifficultyFor,reviewPriority,testReadyMode,markQuestionShown,note:noteItemAttempt,loadItemQuality,reviewItemQuality,itemQualityKey
});
})();