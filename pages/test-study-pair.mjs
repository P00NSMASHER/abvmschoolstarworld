/** Separate current-curriculum learning notes and assessment-style practice papers. */
import {renderClassroomStudyGuide} from './classroom-test-guide.mjs?v=3';
import {premiumPaperCss,decoratePaper} from './premium-paper-theme.mjs?v=2';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const rows=value=>Array.isArray(value)?value:[];
const unique=value=>[...new Set(rows(value).map(clean).filter(Boolean))];
const when=date=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return '';
  const time=new Date(date+'T12:00:00Z');
  return Number.isFinite(time.getTime())?new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(time):'';
};
const kindOf=guide=>{
  const label=clean(guide?.label).toLowerCase(),subject=clean(guide?.subject).toLowerCase();
  if(/spell|handwriting/.test(label)||/spell|handwriting/.test(subject))return 'spelling';
  if(/grammar|predicate|sentence type|punctuation/.test(label))return 'grammar';
  if(/math|subtraction|addition/.test(label)||subject==='math')return 'math';
  if(/religion|chapter|faith/.test(label)||subject==='religion')return 'religion';
  return 'reading';
};
const baseCss=[
  '@page{size:Letter portrait;margin:.46in}*{box-sizing:border-box}',
  'html,body{margin:0;padding:0;background:#fff;color:#161f27;font-family:Arial,Helvetica,sans-serif}',
  'body{font-size:10.3pt;line-height:1.42}',
  '.sheet{width:100%;max-width:7.58in;margin:0 auto;overflow-wrap:anywhere}',
  '.header{border-top:5px solid #182d3c;border-bottom:1px solid #a7b1b9;padding:.13in 0 .16in}',
  '.eyebrow{display:flex;justify-content:space-between;align-items:center;gap:.12in;font-size:8.5pt;letter-spacing:.075em;font-weight:800;text-transform:uppercase}',
  '.eyebrow .date{font-weight:650;letter-spacing:0;text-transform:none}',
  'h1{font-size:20pt;line-height:1.15;margin:.13in 0 .045in}',
  '.subtitle{margin:0;font-size:9.4pt;color:#3d4e58}',
  '.badge-row{display:flex;gap:8px;margin:.15in 0 .13in;flex-wrap:wrap}',
  '.badge-row span{border:1px solid #9ca9b1;border-radius:20px;padding:4px 9px;font-size:8.25pt;font-weight:800}',
  '.section{break-inside:avoid;margin:.14in 0 0}',
  '.section h2{font-size:11.7pt;margin:0 0 .08in;padding-bottom:.065in;border-bottom:1px solid #a3afb7}',
  '.section h2 .index{font-size:9.5pt;letter-spacing:.06em;color:#536575;margin-right:5px}',
  '.focus-note{border:1px solid #526774;border-left:5px solid #344b5b;padding:.10in .13in;margin:.14in 0;font-size:10pt}',
  '.focus-note strong{display:block;font-size:9pt;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}',
  '.guide-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.08in;margin:.14in 0}',
  '.guide-summary div{border:1px solid #aeb9c0;border-radius:7px;padding:.075in .1in}',
  '.guide-summary b{display:block;font-size:12pt}.guide-summary span{font-size:8.5pt;color:#465761}',
  '.topic-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.11in}',
  '.topic-card{border:1px solid #aeb9c0;border-top:4px solid #344b5b;border-radius:7px;padding:.11in .13in;break-inside:auto}',
  '.topic-card h3{font-size:11.2pt;line-height:1.25;margin:0 0 .055in}.topic-card>p{margin:.035in 0}',
  '.say-it{margin-top:.09in;padding-top:.075in;border-top:1px solid #c4ccd1;break-inside:avoid}',
  '.say-it .prompt-label,.cover-answer span{display:block;font-size:8pt;letter-spacing:.055em;text-transform:uppercase;font-weight:800;color:#52636d}',
  '.say-it p{margin:.035in 0}.cover-answer{background:#f0f3f5;border-left:3px solid #526774;padding:.065in .08in;font-size:9.2pt}',
  '.teacher-checklist{columns:2;column-gap:.25in;margin:.05in 0;padding-left:.2in}',
  '.teacher-checklist li{break-inside:avoid;margin:0 0 .075in}',
  '.study-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.09in;counter-reset:step;list-style:none;padding:0;margin:.04in 0}',
  '.study-steps li{border:1px solid #b7c0c8;border-radius:7px;padding:.08in .1in;counter-increment:step}',
  '.study-steps li:before{content:counter(step);display:inline-grid;place-items:center;width:19px;height:19px;border-radius:50%;background:#182d3c;color:#fff;font-weight:800;font-size:8.5pt;margin-right:6px}',
  '.ready-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.065in .12in}',
  '.ready-item{display:flex;gap:7px;align-items:flex-start;font-size:9.3pt;break-inside:avoid}',
  '.columns{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr);gap:.12in}',
  '.card{border:1px solid #bfc8ce;border-radius:7px;padding:.11in .13in;break-inside:avoid}',
  '.card ul,.card ol{padding-left:.18in;margin:.07in 0 .02in}',
  '.card li{margin-bottom:.065in}.card li:last-child{margin-bottom:0}',
  '.strategy-list{margin:0;padding:0;list-style:none;display:grid;gap:.08in}',
  '.strategy-list li{display:flex;gap:8px;align-items:baseline;margin:0}',
  '.strategy-list b{border:1px solid #73828b;border-radius:50%;width:20px;height:20px;flex:none;text-align:center;line-height:19px;font-size:9pt}',
  '.worked{border:1px solid #8a9ba5;border-radius:7px;padding:.12in .14in;margin:0 0 .09in;break-inside:avoid}',
  '.worked .caption{font-size:8.5pt;letter-spacing:.07em;text-transform:uppercase;font-weight:800;color:#465761}',
  '.worked p{margin:.055in 0}.answer{font-weight:750;padding:.08in .1in;border-left:3px solid #465761;background:#f1f3f4}',
  '.why{font-size:9.5pt;color:#33434c}',
  '.vocabulary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.075in .12in;margin:0}',
  '.vocabulary div{border-bottom:1px solid #c1c8ce;padding-bottom:4px}',
  '.vocabulary dt{font-weight:750}.vocabulary dd{margin:2px 0 0;font-size:9.1pt;color:#3c4b53}',
  '.self-check{display:grid;gap:.1in}',
  '.self-check .question{border-bottom:1px solid #b0b9bf;padding-bottom:.075in}',
  '.self-check .question p{margin:0 0 3px}',
  '.self-check .small-answer{font-size:8.7pt;color:#485860}',
  '.checklist{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:.15in}',
  '.checklist label{font-size:9pt;border:1px solid #b7c0c8;border-radius:6px;padding:7px;display:flex;gap:7px}',
  '.checkbox{border:1.2px solid #394e5c;width:13px;height:13px;flex:none;display:inline-block}',
  '.warning{padding:.085in .1in;border:1px solid #8c8c8c;font-size:8.75pt;margin:.1in 0;break-inside:avoid}',
  '.footer{border-top:1px solid #a7b2ba;padding:.08in 0;margin-top:.16in;font-size:8pt;color:#4c5961}',
  '.writing-lines{display:grid;gap:.19in;margin:.12in 0 .14in}',
  '.writing-lines span{display:block;height:.25in;border-bottom:1px solid #818181}',
  '.organizer-prompt{break-inside:avoid;padding:.13in;border:1px solid #a8b0b7;margin:.12in 0}',
  '.organizer-prompt h2{font-size:11pt;margin:0 0 .1in}',
  '.organizer-prompt p{margin:0}',
  '.dictation-body{display:grid;grid-template-columns:1fr;gap:.04in;margin:.14in 0}',
  '.dictation-item{display:flex;align-items:center;gap:.13in;height:.38in;break-inside:avoid}',
  '.dictation-item .n{font-size:10pt;font-weight:700;width:.32in;flex:none;text-align:right}',
  '.hand-line{display:block;position:relative;flex:1;height:.33in;border-top:1px solid #b8b8b8;border-bottom:1.3px solid #444}',
  '.hand-line:after{content:"";position:absolute;top:50%;left:0;right:0;border-top:1px dashed #b2b2b2}',
  '.name-row{display:flex;gap:.25in;align-items:baseline;margin:.18in 0;font-size:10pt}',
  '.name-row span{flex:1;border-bottom:1px solid #333;height:.25in}',
  '.adult-key{page-break-before:always;break-before:page}',
  '.adult-key h2{font-size:17pt;margin:.14in 0}.adult-key ol{columns:2;font-size:11pt;line-height:1.85}',
  '.adult-key li{break-inside:avoid}',
  '@media screen{body{background:#eef2f4;padding:16px}.sheet{background:#fff;box-shadow:0 5px 25px #0002;padding:.42in;margin-bottom:16px;border-radius:8px}.adult-key{break-before:auto}}',
  '@media screen and (max-width:620px){body{padding:8px}.sheet{padding:14px;box-shadow:none}.columns,.vocabulary,.topic-grid,.guide-summary,.study-steps,.ready-grid{grid-template-columns:1fr}.teacher-checklist{columns:1}.checklist{grid-template-columns:1fr}h1{font-size:19pt}.eyebrow{font-size:8pt}}',
  '@media print{body{background:#fff}.sheet{width:100%;max-width:none}.adult-key{break-before:page}.section,.card,.worked,.organizer-prompt{break-inside:avoid}}',
].join('');
const htmlHead=(guide,title)=>'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+
  esc(title+' · '+clean(guide?.label))+'</title><style>'+baseCss+premiumPaperCss+'</style></head><body>';
const header=(guide,title,subtitle)=>'<header class="header"><div class="eyebrow"><span>ABVM GRADE 2 · TEST PREP</span><span class="date">'+esc(when(guide?.date))+'</span></div>'+
  '<h1>'+esc(title)+'</h1><p class="subtitle">'+esc(subtitle)+'</p></header>';
const footer=guide=>'<footer class="footer">'+esc(guide?.sourceLabel||'Current reviewed class material')+
  (guide?.sourceCheckedAt ? ' · Teacher source checked '+esc(String(guide.sourceCheckedAt).slice(0,10)) : '')+
  ' · Original home practice · Not a school-issued test.</footer>';
const warningHtml=guide=>rows(guide?.warnings).slice(0,3).filter(Boolean).map(w=>'<p class="warning">'+esc(w)+'</p>').join('');
function strategies(guide,kind){
  const label=clean(guide?.label).toLowerCase(),skills=rows(guide?.practice).map(q=>clean(q.skill)).join(' ').toLowerCase();
  if(kind==='math'&&/place.?value|expanded.?form/.test(label+' '+skills))
    return ['Name each digit’s place: hundreds, tens, or ones.','Write expanded form by showing each digit’s value, such as 347 = 300 + 40 + 7.','Check by adding the expanded parts to rebuild the original number.'];
  if(kind==='math'&&/subtraction|subtract|minus/.test(label+' '+skills))
    return ['Read the subtraction problem. Find the starting amount and how much is taken away.','Break apart tens and ones, or count back, to find the difference.','Check by adding the answer to the amount taken away.'];
  if(kind==='math'&&/addition|sum/.test(label+' '+skills))
    return ['Look for the two amounts to join.','Add the ones and tens carefully.','Check by counting on or using the related subtraction fact.'];
  if(kind==='grammar'&&/common.*proper.*nouns?/.test(label+' '+skills))
    return ['Ask whether the noun is a general name or one particular name.','Capitalize a proper noun, such as Sofia, Chicago, or Tuesday.','Read the sentence again and check that ordinary common nouns are not capitalized without a reason.'];
  if(kind==='grammar'&&/subject|predicate/.test(label+' '+skills))
    return ['Ask: Who or what is the sentence about? That is the complete subject.','Ask: What does the subject do or what is it? That is the complete predicate.','Check that you included every word in the whole subject or predicate.'];
  if(kind==='grammar'&&/sentence.?types|punctuation/.test(label+' '+skills))
    return ['Decide whether the sentence tells, asks, directs, or shows strong feeling.','Choose the matching end mark: period, question mark, or exclamation mark.','Read the sentence aloud to double-check.'];
  if(/short.vowels?/.test(label+' '+skills))
    return ['Say the vowel sound slowly in the word.','Remember the five sounds in order: cat (a), bed (e), pig (i), hot (o), sun (u).','Say the whole word again to confirm the sound.'];
  if(kind==='religion')
    return ['Read the chapter facts and important words aloud.','Explain each idea in your own words, without peeking.','Check your explanation against the reviewed class notes.'];
  if(kind==='reading')
    return ['Read the question and identify what it asks.','Find the story detail or phonics clue that supports your answer.','Explain why your answer fits.'];
  return ['Read the announced test topic and class notes.','Explain the key facts in your own words.','Try a matching practice question and check your answer.'];
}
function goal(guide,kind){
  const label=clean(guide?.label),name=label.replace(/\s*\/\s*Handwriting/i,'').trim();
  if(kind==='math'&&/place.?value|expanded.?form/i.test(name))return 'I can name each digit’s value and write a number in expanded form.';
  if(kind==='math')return 'I can solve '+(/subtraction/i.test(name)?'subtraction':/addition/i.test(name)?'addition':'math')+' problems and check my work.';
  if(kind==='grammar'&&/common.*proper.*nouns?/i.test(name))return 'I can tell common and proper nouns apart and capitalize particular names.';
  if(kind==='grammar')return 'I can read a sentence, recognize the skill in '+name+', and explain my answer.';
  if(kind==='religion')return 'I can recall and explain the important ideas in '+name+'.';
  if(/phonics/i.test(name))return 'I can hear and recognize the sounds named in '+name+'.';
  return 'I can use the class skills in '+name+' and explain what I know.';
}
/**
 * A five-anchor picture prompt, only for verified short-vowel test scopes.
 * Never add this activity to an unrelated reading or long-vowel assessment.
 */
const isShortVowelGuide=(guide,topics,questions)=>
  /(^|[^a-z])short[- ]vowels?([^a-z]|$)/i.test([
    clean(guide?.label),...topics.map(topic=>clean(topic?.id||topic?.label)),
    ...questions.map(question=>clean(question?.skill)),
  ].join(' '));
const vowelStory=()=>'<aside class="vowel-story" aria-label="Short vowel memory picture">'+
  '<strong>Picture the five short vowels</strong>'+
  '<p>Imagine a <b>cat</b> on a <b>bed</b>, with a <b>pig</b> underneath, in the <b>hot sun</b>.</p>'+
  '<div class="vowel-cards">'+[
    ['a','cat'],['e','bed'],['i','pig'],['o','hot'],['u','sun'],
  ].map(([letter,word])=>'<span class="vowel-card"><b class="vowel-letter">'+letter.toUpperCase()+
    '</b><span>'+word+'</span></span>').join('')+'</div>'+
  '<small>Say the five words in order: cat, bed, pig, hot, sun.</small></aside>';

export function renderTestStudyGuide(guide,dictionary=()=> ''){
  if(kindOf(guide)==='spelling')return renderClassroomStudyGuide(guide,dictionary);
  const kind=kindOf(guide),facts=unique(guide?.facts);
  const questions=rows(guide?.practice).filter(q=>clean(q?.prompt)&&clean(q?.answer));
  const suppliedTopics=rows(guide?.reviewTopics).filter(topic=>clean(topic?.label));
  const fallbackTopics=new Map();
  for(const q of questions){
    const id=clean(q.skill)||clean(q.prompt),existing=fallbackTopics.get(id);
    const check={prompt:clean(q.prompt),answer:clean(q.answer)};
    if(existing){existing.checks.push(check);existing.questionCount+=1;continue;}
    fallbackTopics.set(id,{id,label:clean(q.skill).replace(/-/g,' ')||'Test topic',
      summary:clean(q.explanation)||clean(q.answer),questionCount:1,check,checks:[check]});
  }
  const topics=suppliedTopics.length?suppliedTopics:[...fallbackTopics.values()];
  const teacherFacts=unique(guide?.teacherFacts);
  const vocabulary=rows(guide?.vocabulary).map(word=>{
    const term=clean(word?.term),supplied=clean(word?.meaning);
    const hasTeacherMeaning=Boolean(supplied&&!/teacher page does not provide a definition|no definition supplied/i.test(supplied));
    const meaning=hasTeacherMeaning?supplied:clean(dictionary(term));
    return {term,meaning,supplemental:!hasTeacherMeaning&&Boolean(meaning)};
  }).filter(word=>word.term);
  const steps=strategies(guide,kind);
  const topicHtml=topics.length?'<div class="topic-grid">'+topics.map(topic=>'<article class="topic-card" data-guide-skill="'+esc(topic.id||topic.label)+'">'+
    '<div class="topic-topline"><h3>'+esc(topic.label)+'</h3><span class="topic-count">'+rows(topic.checks?.length?topic.checks:(topic.check?[topic.check]:[])).length+' check(s)</span></div><p>'+esc(topic.summary||'Review this tested idea in the current class materials.')+'</p>'+
    rows(topic.checks?.length?topic.checks:(topic.check?[topic.check]:[])).map((check,index)=>'<div class="say-it"><span class="prompt-label">'+
      (index?'Try another way':'Say it without looking')+'</span><p>'+esc(check.prompt)+'</p>'+
      '<p class="cover-answer"><span>Cover, then check</span>'+esc(check.answer)+'</p></div>').join('')+'</article>').join('')+'</div>':
    '<p>Use the classroom materials for this announced test. Additional verified facts have not been published yet.</p>';
  const completeFacts=teacherFacts.length?teacherFacts:facts.filter(f=>!/^Verified Grade 2 skill:/i.test(f));
  const checklistHtml=completeFacts.length?'<section class="section"><h2><span class="index">02</span> Complete class checklist</h2>'+
    '<p class="subtitle">Read every line, then explain it in your own words. This list is kept with the matching test.</p><ul class="teacher-checklist">'+
    completeFacts.map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul></section>':'';
  const vocabHtml=vocabulary.length?'<section class="section"><h2><span class="index">03</span> Words to know</h2><dl class="vocabulary">'+
    vocabulary.map(q=>'<div><dt>'+esc(q.term)+'</dt>'+(q.meaning?'<dd>'+esc(q.meaning)+(q.supplemental?'<small>Original study explanation — not supplied by the teacher.</small>':'')+'</dd>':'')+'</div>').join('')+'</dl></section>':'';
  const missing=rows(guide?.coverage?.missingGuideSkills);
  const coverageWarning=missing.length?'<p class="warning">This guide is missing '+missing.length+' tested topic'+(missing.length===1?'':'s')+'. Use the current classroom materials until the guide refreshes.</p>':'';
  return decoratePaper(htmlHead(guide,'Study guide')+'<main class="sheet study-guide">'+
    header(guide,'Study Guide',clean(guide?.label)||'Upcoming class test')+
    '<div class="guide-summary"><div><b>'+topics.length+'</b><span>tested topic'+(topics.length===1?'':'s')+'</span></div><div><b>'+questions.length+'</b><span>matching practice question'+(questions.length===1?'':'s')+'</span></div><div><b>'+esc(when(guide?.date)||'Current')+'</b><span>test date</span></div></div>'+
    '<div class="focus-note"><strong>My learning goal</strong>'+esc(goal(guide,kind))+'</div>'+    (kind==='reading'&&isShortVowelGuide(guide,topics,questions)?vowelStory():'')+
    '<section class="section"><h2><span class="index">01</span> What I need to know</h2>'+topicHtml+'</section>'+checklistHtml+vocabHtml+
    '<section class="section"><h2><span class="index">'+(vocabulary.length?'04':'03')+'</span> How to remember it</h2><ol class="study-steps">'+
    steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol></section>'+
    (topics.length?'<section class="section"><h2><span class="index">'+(vocabulary.length?'05':'04')+'</span> Ready check</h2><div class="ready-grid">'+
      topics.map(topic=>'<label class="ready-item"><i class="checkbox" aria-hidden="true"></i><span>I can explain <b>'+esc(topic.label)+'</b>.</span></label>').join('')+'</div></section>':'')+
    coverageWarning+warningHtml(guide)+footer(guide)+'</main></body></html>',kind);
}
function dictationWorksheet(guide){
  const words=unique(guide?.spellingWords).filter(word=>/^[a-z][a-z'-]*$/i.test(word));
  const count=words.length||15;
  const lines=Array.from({length:count},(_,index)=>'<div class="dictation-item"><span class="n">'+(index+1)+'.</span>'+
    '<span class="hand-line" aria-label="Write word '+(index+1)+'"></span></div>').join('');
  const student='<main class="sheet dictation-sheet">'+header(guide,'Spelling Dictation','Listen to each word. Write each word neatly on the lines.')+
    '<div class="name-row">Name: <span></span> Date: <span></span></div>'+
    '<p class="focus-note"><strong>Practice test</strong>Have an adult read one word at a time. Do not look at your spelling study guide while writing.</p>'+
    '<div class="dictation-body">'+lines+'</div>'+
    (!words.length?'<p class="warning">The current spelling list is not yet confirmed. These are blank practice lines, not a verified test word count.</p>':'')+
    footer(guide)+'</main>';
  const key=words.length?'<section class="sheet adult-key">'+header(guide,'Adult Dictation List','Keep this page separate from the student worksheet.')+
    '<p>Read each verified word aloud. Repeat it once if needed; do not show this sheet until the student finishes.</p>'+
    '<ol>'+words.map(word=>'<li>'+esc(word)+'</li>').join('')+'</ol>'+footer(guide)+'</section>':'';
  return decoratePaper(htmlHead(guide,'Spelling dictation worksheet')+student+key+'</body></html>','spelling');
}
function noBankWorksheet(guide){
  const topic=clean(guide?.label)||'this test';
  const knownFacts=unique(guide?.facts);
  const questions=knownFacts.length
    ? knownFacts.map(fact=>'Explain this verified class idea in your own words: '+fact)
    : ['Write one important fact you learned about '+topic+'.',
      'Write or draw an example from your current class notes.',
      'Explain something about '+topic+' that you could teach someone else.'];
  rows(guide?.vocabulary).forEach(entry=>{
    if(clean(entry?.term))questions.push('What does '+clean(entry.term)+' mean?');
  });
  const paper='<main class="sheet organizer-sheet">'+header(guide,'Topic Practice Worksheet',topic)+
    '<div class="name-row">Name: <span></span> Date: <span></span></div>'+
    '<p class="warning">The matching question bank is not yet available. This is a class-topic organizer, not a reproduction of the teacher test.</p>'+
    questions.map((q,i)=>'<section class="organizer-prompt"><h2>'+(i+1)+'. '+esc(q)+'</h2>'+
      '<div class="writing-lines"><span></span><span></span><span></span></div></section>').join('')+
    warningHtml(guide)+footer(guide)+'</main>';
  return decoratePaper(htmlHead(guide,'Practice worksheet')+paper+'</body></html>',kindOf(guide));
}
export function renderTestWorksheet(guide,dictionary=()=> ''){
  const practice=rows(guide?.practice);
  const hasVerifiedSpellingList=unique(guide?.spellingWords).length>0;
  if(kindOf(guide)==='spelling'&&(!practice.length||hasVerifiedSpellingList))return dictationWorksheet(guide);
  if(!practice.length)return noBankWorksheet(guide);
  return renderClassroomStudyGuide(guide,dictionary,{forcePracticePacket:true});
}
