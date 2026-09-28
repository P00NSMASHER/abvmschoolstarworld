(()=>{"use strict";
const VERSION="abvm-starblox-study-engine-v1";
const SOURCE_TRANSFORM="skill-only-equivalent-item-v1";
const EQUIVALENT_PROVENANCE="original-practice-derived-from-verified-abvm-skills";
const BASE_PROVENANCE="verified-abvm-study-pack";

function text(value){return String(value??"").trim()}
function slug(value){return text(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"item"}
function hash(value){
  let h=2166136261>>>0;
  for(const ch of String(value)){
    h^=ch.charCodeAt(0);
    h=Math.imul(h,16777619)>>>0;
  }
  return h>>>0;
}
function variantFor(sourceKey){return (hash(sourceKey)%2)+1}
function rowFor(rows,variant){return rows[Math.max(0,(Math.floor(Number(variant)||1)-1)%rows.length)]}
function makeQuestion({id,subject,skill,type,prompt,choices,answer,explanation,hint,variant,sourceFact,base=false}){
  return {
    id,subject,skill,
    questionType:type||"practice",
    format:"multiple_choice",
    prompt:text(prompt),
    choices:[...choices].map(text),
    answer:text(answer),
    explanation:text(explanation),
    hint:text(hint||"Think about the skill, then choose the best answer."),
    provenance:base?BASE_PROVENANCE:EQUIVALENT_PROVENANCE,
    sourceFact:text(sourceFact||skill),
    generationVariant:base?0:variant,
    sourceTransform:base?null:SOURCE_TRANSFORM,
    originalEquivalent:!base
  };
}
function triad(prefix,subject,skill,variant,sourceFact,items){
  return items.map((item,index)=>makeQuestion({
    id:prefix+"-"+["direct","transfer","reasoning"][index]+"-v"+variant,
    subject,skill,type:["direct","transfer","reasoning"][index],
    prompt:item.prompt,choices:item.choices,answer:item.answer,
    explanation:item.explanation,hint:item.hint,variant,sourceFact
  }));
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
function pickDistinct(pool,count,seed){
  const unique=[...new Set(pool.map(text).filter(Boolean))];
  return unique.sort((a,b)=>hash(seed+a)-hash(seed+b)).slice(0,count);
}
function normalizeBaseQuestion(row,index){
  let choices=Array.isArray(row.choices)?row.choices.map(text).filter(Boolean):[];
  let prompt=text(row.prompt),answer=text(row.answer);
  if(row.format==="true_false"&&choices.length===0){
    choices=["True","False"];
  }
  if(!choices.includes(answer)&&answer)choices.unshift(answer);
  choices=[...new Set(choices)].slice(0,4);
  if(choices.length<2||!answer||!prompt)return null;
  return makeQuestion({
    id:"verified-"+slug(row.id||index),
    subject:text(row.subject||"Current material"),
    skill:"Verified current material",
    type:"source",
    prompt,choices,answer,
    explanation:text(row.explanation||"This answer matches the current verified school material."),
    hint:text(row.hint||"Use this week's study material."),
    variant:0,
    sourceFact:"Current verified ABVM study-pack question",
    base:true
  });
}
function mathFactory(pack,variant){
  if(!topicMatch(pack,"Math",/subtraction\s+to\s+12/i))return [];
  const row=rowFor([
    {a:9,b:4,c:12,d:7,storyA:10,storyB:3},
    {a:8,b:3,c:11,d:6,storyA:12,storyB:8}
  ],variant);
  const direct=row.a-row.b,transfer=row.c-row.d,story=row.storyA-row.storyB;
  return triad("math-subtraction-12","Math","Subtraction to 12",variant,"Verified topic: Subtraction to 12",[
    {
      prompt:`What is ${row.a} − ${row.b}?`,
      choices:[String(direct),String(Math.max(0,direct-1)),String(direct+2)],
      answer:String(direct),
      explanation:`${row.a} take away ${row.b} leaves ${direct}.`
    },
    {
      prompt:`Solve ${row.c} − ${row.d}.`,
      choices:[String(transfer),String(transfer+1),String(Math.max(0,transfer-2))],
      answer:String(transfer),
      explanation:`Count back ${row.d} from ${row.c} to get ${transfer}.`
    },
    {
      prompt:`A student has ${row.storyA} crayons and gives away ${row.storyB}. How many are left?`,
      choices:[String(story),String(story+1),String(Math.max(0,story-1))],
      answer:String(story),
      explanation:`“Gives away” means subtract: ${row.storyA} − ${row.storyB} = ${story}.`
    }
  ]);
}
function blendFactory(pack,variant){
  if(!topicMatch(pack,"Reading / ELA",/2-letter consonant blends/i)&&!topicMatch(pack,"Spelling / Handwriting",/2-letter blends/i))return [];
  const row=rowFor([
    {direct:"frog",transfer:"blue",reason:"stop",blend:"st",wrong:["apple","oven"],transferWrong:["sun","kite"]},
    {direct:"clap",transfer:"grape",reason:"flag",blend:"fl",wrong:["eagle","under"],transferWrong:["moon","easy"]}
  ],variant);
  return triad("phonics-consonant-blends","Spelling / Handwriting","2-letter consonant blends",variant,"Verified skill: 2-letter consonant blends",[
    {
      prompt:"Which word begins with a 2-letter consonant blend?",
      choices:[row.direct,...row.wrong],answer:row.direct,
      explanation:"A consonant blend keeps the sound of both consonants."
    },
    {
      prompt:"Which word begins with a consonant blend?",
      choices:[row.transfer,...row.transferWrong],answer:row.transfer,
      explanation:"Listen to the first two consonant sounds."
    },
    {
      prompt:`Why is “${row.blend}” in “${row.reason}” a consonant blend?`,
      choices:["You can hear both consonant sounds.","It has only one consonant sound.","It is a vowel team."],
      answer:"You can hear both consonant sounds.",
      explanation:"In a blend, both consonant sounds can still be heard."
    }
  ]);
}
function sentenceFactory(pack,variant){
  if(!topicMatch(pack,"Reading / ELA",/types of sentences/i))return [];
  const row=rowFor([
    {direct:"Please close the door.",directAnswer:"command",transfer:"Where is my pencil?",transferAnswer:"question",reason:"What a huge pumpkin!"},
    {direct:"The dog is sleeping.",directAnswer:"statement",transfer:"Watch out for the puddle!",transferAnswer:"exclamation",reason:"Can you help me?"}
  ],variant);
  const distractors=["statement","question","command","exclamation"];
  function choicesFor(answer){return [answer,...distractors.filter(x=>x!==answer)].slice(0,3)}
  return triad("grammar-sentence-types","Reading / ELA","Types of sentences",variant,"Verified skill: grammar — types of sentences",[
    {
      prompt:`What type of sentence is “${row.direct}”?`,
      choices:choicesFor(row.directAnswer),answer:row.directAnswer,
      explanation:"Look at what the sentence is doing and the punctuation it uses."
    },
    {
      prompt:`What type of sentence is “${row.transfer}”?`,
      choices:choicesFor(row.transferAnswer),answer:row.transferAnswer,
      explanation:"Decide whether the sentence tells, asks, commands, or shows strong feeling."
    },
    {
      prompt:`What clue best helps identify “${row.reason}”?`,
      choices:["Its purpose and ending punctuation.","The number of letters.","Whether it has a long word."],
      answer:"Its purpose and ending punctuation.",
      explanation:"Sentence type depends on purpose and punctuation."
    }
  ]);
}
function sightWordFactory(pack,variant){
  const words=listFromTopic(pack,"Sight words");
  if(words.length<4)return [];
  const picked=pickDistinct(words,4,"sight-"+variant);
  const wrongPool=["jump","yellow","train","window","after","plant"].filter(w=>!words.includes(w));
  const wrong=pickDistinct(wrongPool,3,"sight-wrong-"+variant);
  return triad("reading-sight-words","Reading / ELA","Current sight words",variant,"Verified current sight-word list",[
    {
      prompt:"Which word is one of this week's sight words?",
      choices:[picked[0],wrong[0],wrong[1]],answer:picked[0],
      explanation:`“${picked[0]}” is on the current sight-word list.`
    },
    {
      prompt:"Which pair contains two current sight words?",
      choices:[picked[1]+" and "+picked[2],picked[1]+" and "+wrong[0],wrong[1]+" and "+wrong[2]],
      answer:picked[1]+" and "+picked[2],
      explanation:"Both words in the correct pair are on the current list."
    },
    {
      prompt:"Which word belongs in this week's sight-word practice?",
      choices:[picked[3],wrong[1],wrong[2]],answer:picked[3],
      explanation:`“${picked[3]}” is part of the current practice list.`
    }
  ]);
}
function vocabularyFactory(pack,variant){
  const words=(pack?.vocabulary||[]).map(v=>text(v.term)).filter(Boolean);
  if(words.length<3)return [];
  const picked=pickDistinct(words,4,"vocab-"+variant);
  const wrongPool=["planet","triangle","engine","museum","winter","garden"].filter(w=>!words.includes(w));
  const wrong=pickDistinct(wrongPool,3,"vocab-wrong-"+variant);
  return triad("reading-current-vocabulary","Reading / ELA","Current vocabulary",variant,"Verified current vocabulary list",[
    {
      prompt:"Which word is on the current vocabulary list?",
      choices:[picked[0],wrong[0],wrong[1]],answer:picked[0],
      explanation:`“${picked[0]}” appears on the current Reading Work vocabulary list.`
    },
    {
      prompt:"Which pair contains two current vocabulary words?",
      choices:[picked[1]+" and "+picked[2],picked[1]+" and "+wrong[0],wrong[1]+" and "+wrong[2]],
      answer:picked[1]+" and "+picked[2],
      explanation:"Both words in the correct pair are current vocabulary words."
    },
    {
      prompt:"Which word should be included in this week's vocabulary review?",
      choices:[picked[3]||picked[0],wrong[1],wrong[2]],answer:picked[3]||picked[0],
      explanation:"That word is part of the current verified vocabulary list."
    }
  ]);
}
function religionChapterFactory(pack,variant){
  const source=subjectText(pack,"Religion");
  if(!/disciples|savior|Jesus died for our sins/i.test(source))return [];
  const row=rowFor([
    {scenario:"A student tries to follow Jesus by helping a classmate who is alone.",reason:"The student is choosing to live as a friend and follower of Jesus."},
    {scenario:"A student forgives a friend and chooses kindness after an argument.",reason:"The student is trying to follow Jesus through loving action."}
  ],variant);
  return triad("religion-chapter-2","Religion","Jesus is God's Best Gift",variant,"Verified Religion Chapter 2 material",[
    {
      prompt:"What are friends and followers of Jesus called?",
      choices:["disciples","captions","blends"],answer:"disciples",
      explanation:"The current religion material says we are called to be disciples, friends of Jesus."
    },
    {
      prompt:`${row.scenario} Which idea from the lesson best matches this choice?`,
      choices:["Being a disciple","Choosing a sentence type","Practicing subtraction"],answer:"Being a disciple",
      explanation:row.reason
    },
    {
      prompt:"Why is Jesus called our Savior in the current lesson?",
      choices:["He died for our sins and gives us new life.","He teaches only math facts.","He is a name for a school subject."],
      answer:"He died for our sins and gives us new life.",
      explanation:"The current Chapter 2 notes identify Jesus as Savior and connect his death with new life in grace."
    }
  ]);
}
function trinityFactory(pack,variant){
  if(!topicMatch(pack,"Religion",/Trinity:\s*3 persons in one God/i))return [];
  const row=rowFor([
    {direct:"Which statement best describes the Trinity?",transfer:"Which names identify the three Persons of the Trinity?"},
    {direct:"Which sentence matches the Christian teaching about one God in three Persons?",transfer:"Which group belongs together in a lesson about the Trinity?"}
  ],variant);
  return triad("religion-trinity","Religion","The Trinity",variant,"Verified Religion topic: Trinity — 3 persons in one God",[
    {
      prompt:row.direct,
      choices:["One God in three Persons: Father, Son, and Holy Spirit.","Three separate gods.","One Person with three unrelated jobs."],
      answer:"One God in three Persons: Father, Son, and Holy Spirit.",
      explanation:"The Trinity teaches one God in three divine Persons."
    },
    {
      prompt:row.transfer,
      choices:["Father, Son, and Holy Spirit","Teacher, student, and principal","Angel, prophet, and king"],
      answer:"Father, Son, and Holy Spirit",
      explanation:"Those are the three Persons named in the Trinity."
    },
    {
      prompt:"Why is “three separate gods” different from the Trinity?",
      choices:["The Trinity teaches one God, not three gods.","The Trinity has only two Persons.","The Trinity means three separate religions."],
      answer:"The Trinity teaches one God, not three gods.",
      explanation:"Christian teaching describes one God in three Persons."
    }
  ]);
}
function giftsFactory(pack,variant){
  if(!topicMatch(pack,"Religion",/Gifts from God|Giver of Gifts|God's gifts/i))return [];
  const row=rowFor([
    {direct:"A student is good at music. Which action best uses that gift to help others?",directAnswer:"Playing a cheerful song for residents at a care home.",transfer:"A student is good at math. Which action best uses that gift to serve someone?",transferAnswer:"Helping a classmate understand a practice problem."},
    {direct:"A student enjoys drawing. Which action best uses that gift kindly?",directAnswer:"Making a welcome card for a new student.",transfer:"A student is a patient reader. Which action best uses that gift to help?",transferAnswer:"Reading a story with a younger child."}
  ],variant);
  return triad("religion-gifts","Religion","Gifts from God",variant,"Verified Religion topic: Gifts from God",[
    {
      prompt:row.direct,
      choices:[row.directAnswer,"Using the skill only to brag.","Refusing to use the skill when help is needed."],
      answer:row.directAnswer,
      explanation:"A gift can be used to help and encourage another person."
    },
    {
      prompt:row.transfer,
      choices:[row.transferAnswer,"Hiding the skill from everyone.","Using the skill only when a prize is offered."],
      answer:row.transferAnswer,
      explanation:"The ability is being used in service of someone else."
    },
    {
      prompt:"Why can ordinary talents be treated as gifts in a religion lesson?",
      choices:["They can be received gratefully and used to love and serve others.","They make one person more important than everyone else.","They matter only when they win a prize."],
      answer:"They can be received gratefully and used to love and serve others.",
      explanation:"The lesson connects gifts with gratitude, love, and service."
    }
  ]);
}
function validateQuestion(question){
  const issues=[];
  if(!question||typeof question!=="object")return ["question-missing"];
  if(!text(question.id))issues.push("id-missing");
  if(text(question.prompt).length<10)issues.push("prompt-too-short");
  if(!Array.isArray(question.choices)||question.choices.length<2||question.choices.length>4)issues.push("choices-invalid");
  else{
    if(new Set(question.choices).size!==question.choices.length)issues.push("choices-duplicate");
    if(!question.choices.includes(question.answer))issues.push("answer-not-in-choices");
  }
  if(!text(question.explanation))issues.push("explanation-missing");
  if(question.originalEquivalent===true){
    if(!["direct","transfer","reasoning"].includes(question.questionType))issues.push("question-type-invalid");
    if(question.sourceTransform!==SOURCE_TRANSFORM)issues.push("source-transform-invalid");
    if(!Number.isInteger(question.generationVariant)||question.generationVariant<1)issues.push("variant-invalid");
  }
  return issues;
}
function validateCatalog(catalog){
  const issues=[],ids=new Set();
  for(const question of catalog?.questions||[]){
    if(ids.has(question.id))issues.push({id:question.id,issue:"duplicate-id"});
    ids.add(question.id);
    for(const issue of validateQuestion(question))issues.push({id:question.id,issue});
  }
  return issues;
}
function buildCatalog(pack,{sourceKey}={}){
  const key=text(sourceKey||pack?.sourceHash||pack?.sourceCheckedAt||pack?.weekLabel||"abvm-current");
  const variant=variantFor(key);
  const questions=[];
  for(const [index,row] of (pack?.questions||[]).entries()){
    const normalized=normalizeBaseQuestion(row,index);
    if(normalized)questions.push(normalized);
  }
  for(const factory of [mathFactory,blendFactory,sentenceFactory,sightWordFactory,vocabularyFactory,religionChapterFactory,trinityFactory,giftsFactory]){
    questions.push(...factory(pack,variant));
  }
  const deduped=[],seen=new Set();
  for(const question of questions){
    const signature=question.prompt+"|"+question.answer;
    if(seen.has(signature))continue;
    seen.add(signature);deduped.push(question);
  }
  const catalog={
    schemaVersion:1,engineVersion:VERSION,sourceTransform:SOURCE_TRANSFORM,
    sourceKey:key,generationVariant:variant,questionCount:deduped.length,questions:deduped
  };
  const issues=validateCatalog(catalog);
  if(issues.length)throw new Error("ABVM study-game catalog validation failed: "+JSON.stringify(issues));
  return catalog;
}
function seededOrder(question,seed){return hash(seed+"|"+question.id)}
function selectQuestions(catalog,{subjects,count=8,seed="session"}={}){
  let pool=[...(catalog?.questions||[])];
  const wanted=Array.isArray(subjects)?subjects.map(text).filter(Boolean):[];
  if(wanted.length)pool=pool.filter(q=>wanted.includes(q.subject));
  const types=["direct","transfer","reasoning","source"];
  pool.sort((a,b)=>{
    const ta=types.indexOf(a.questionType),tb=types.indexOf(b.questionType);
    const aa=ta<0?99:ta,bb=tb<0?99:tb;
    if(aa!==bb)return aa-bb;
    return seededOrder(a,seed)-seededOrder(b,seed);
  });
  const buckets=new Map(types.map(type=>[type,pool.filter(q=>q.questionType===type)]));
  const selected=[],used=new Set();
  while(selected.length<Math.min(count,pool.length)){
    let added=false;
    for(const type of types){
      const bucket=buckets.get(type)||[];
      const next=bucket.find(q=>!used.has(q.id));
      if(next&&selected.length<count){selected.push(next);used.add(next.id);added=true}
    }
    if(!added)break;
  }
  if(selected.length<count){
    for(const q of pool.sort((a,b)=>seededOrder(a,seed+"fill")-seededOrder(b,seed+"fill"))){
      if(selected.length>=count)break;
      if(!used.has(q.id)){selected.push(q);used.add(q.id)}
    }
  }
  return selected;
}
function sourceKeyFromEnvelope(pack,envelope){
  const hashes=(envelope?.sourcePages||[]).map(row=>row.contentHash).filter(Boolean).join("|");
  return hashes||text(pack?.sourceHash||pack?.sourceCheckedAt||pack?.weekLabel||"abvm-current");
}
window.ABVMStudyGames=Object.freeze({
  VERSION,SOURCE_TRANSFORM,EQUIVALENT_PROVENANCE,
  buildCatalog,validateCatalog,selectQuestions,sourceKeyFromEnvelope
});
})();