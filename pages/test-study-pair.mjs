/** Separate current-curriculum learning notes and assessment-style practice papers. */
import {renderClassroomStudyGuide} from './classroom-test-guide.mjs?v=2';
import {premiumPaperCss,decoratePaper} from './premium-paper-theme.mjs?v=1';

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
  '@media screen and (max-width:620px){body{padding:8px}.sheet{padding:14px;box-shadow:none}.columns,.vocabulary{grid-template-columns:1fr}.checklist{grid-template-columns:1fr}h1{font-size:19pt}.eyebrow{font-size:8pt}}',
  '@media print{body{background:#fff}.sheet{width:100%;max-width:none}.adult-key{break-before:page}.section,.card,.worked,.organizer-prompt{break-inside:avoid}}',
].join('');
const htmlHead=(guide,title)=>'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+
  esc(title+' · '+clean(guide?.label))+'</title><style>'+baseCss+premiumPaperCss+'</style></head><body>';
const header=(guide,title,subtitle)=>'<header class="header"><div class="eyebrow"><span>ABVM GRADE 2 · TEST PREP</span><span class="date">'+esc(when(guide?.date))+'</span></div>'+
  '<h1>'+esc(title)+'</h1><p class="subtitle">'+esc(subtitle)+'</p></header>';
const footer=guide=>'<footer class="footer">'+esc(guide?.sourceLabel||'Current reviewed class material')+
  ' · Original home practice · Not a school-issued test.</footer>';
const warningHtml=guide=>rows(guide?.warnings).slice(0,3).filter(Boolean).map(w=>'<p class="warning">'+esc(w)+'</p>').join('');
function strategies(guide,kind){
  const label=clean(guide?.label).toLowerCase(),skills=rows(guide?.practice).map(q=>clean(q.skill)).join(' ').toLowerCase();
  if(kind==='math'&&/subtraction|subtract|minus/.test(label+' '+skills))
    return ['Read the subtraction problem. Find the starting amount and how much is taken away.','Break apart tens and ones, or count back, to find the difference.','Check by adding the answer to the amount taken away.'];
  if(kind==='math'&&/addition|sum/.test(label+' '+skills))
    return ['Look for the two amounts to join.','Add the ones and tens carefully.','Check by counting on or using the related subtraction fact.'];
  if(kind==='grammar'&&/subject|predicate/.test(label+' '+skills))
    return ['Ask: Who or what is the sentence about? That is the complete subject.','Ask: What does the subject do or what is it? That is the complete predicate.','Check that you included every word in the whole subject or predicate.'];
  if(kind==='grammar'&&/sentence.?types|punctuation/.test(label+' '+skills))
    return ['Decide whether the sentence tells, asks, directs, or shows strong feeling.','Choose the matching end mark: period, question mark, or exclamation mark.','Read the sentence aloud to double-check.'];
  if(/short.vowels?/.test(label+' '+skills))
    return ['Say the vowel sound slowly in the word.','Compare the sound to a short-vowel anchor: apple, egg, itch, octopus, up.','Say the whole word again to confirm the sound.'];
  if(kind==='religion')
    return ['Read the chapter facts and important words aloud.','Explain each idea in your own words, without peeking.','Check your explanation against the reviewed class notes.'];
  if(kind==='reading')
    return ['Read the question and identify what it asks.','Find the story detail or phonics clue that supports your answer.','Explain why your answer fits.'];
  return ['Read the announced test topic and class notes.','Explain the key facts in your own words.','Try a matching practice question and check your answer.'];
}
function goal(guide,kind){
  const label=clean(guide?.label),name=label.replace(/\s*\/\s*Handwriting/i,'').trim();
  if(kind==='math')return 'I can solve '+(/subtraction/i.test(name)?'subtraction':/addition/i.test(name)?'addition':'math')+' problems and check my work.';
  if(kind==='grammar')return 'I can read a sentence, recognize the skill in '+name+', and explain my answer.';
  if(kind==='religion')return 'I can recall and explain the important ideas in '+name+'.';
  if(/phonics/i.test(name))return 'I can hear and recognize the sounds named in '+name+'.';
  return 'I can use the class skills in '+name+' and explain what I know.';
}
export function renderTestStudyGuide(guide,dictionary=()=> ''){
  if(kindOf(guide)==='spelling')return renderClassroomStudyGuide(guide,dictionary);
  const kind=kindOf(guide),facts=unique(guide?.facts);
  const questions=rows(guide?.practice).filter(q=>clean(q?.prompt)&&clean(q?.answer));
  const first=questions.slice(0,Math.min(2,questions.length));
  const recall=questions.slice(2,4);
  const vocabulary=rows(guide?.vocabulary).map(word=>{
    const term=clean(word?.term),supplied=clean(word?.meaning);
    const meaning=supplied&&!/teacher page does not provide a definition|no definition supplied/i.test(supplied)?supplied:clean(dictionary(term));
    return {term,meaning};
  }).filter(word=>word.term);
  const steps=strategies(guide,kind);
  const factContent=facts.length?'<ul>'+facts.map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul>':
    '<p>Use the classroom materials for this announced test. Additional verified facts have not been published yet.</p>';
  const howTo='<ol class="strategy-list">'+steps.map((step,index)=>'<li><b>'+(index+1)+'</b><span>'+esc(step)+'</span></li>').join('')+'</ol>';
  const exampleHtml=first.length?first.map((q,index)=>'<article class="worked"><div class="caption">Worked example '+(index+1)+'</div>'+
    '<p>'+esc(q.prompt)+'</p><p class="answer">Answer: '+esc(q.answer)+'</p>'+
    (clean(q.explanation)?'<p class="why"><b>Why:</b> '+esc(q.explanation)+'</p>':clean(q.hint)?'<p class="why"><b>Clue:</b> '+esc(q.hint)+'</p>':'')+
    '</article>').join(''):'<div class="worked"><p>Practice a classroom example with an adult. The app will add a solved example when current matching questions are available.</p></div>';
  const recallHtml=recall.length?'<section class="section"><h2><span class="index">04</span> Cover and recall</h2><div class="self-check">'+
    recall.map(q=>'<div class="question"><p>'+esc(q.prompt)+'</p><p class="small-answer">Check after answering: <b>'+esc(q.answer)+'</b></p></div>').join('')+
    '</div></section>':'';
  // The remaining verified practice must be represented in the study guide too.
  // It is intentionally not truncated at a page count: print CSS paginates it.
  const remaining=questions.slice(4);
  const extraReview=remaining.length?'<section class="section full-review"><h2>More matching practice to know</h2><ol class="review-list">'+
    remaining.map(q=>'<li class="review-item"><strong>'+esc(q.prompt)+'</strong><p>Answer: '+esc(q.answer)+'</p>'+
      (clean(q.explanation)?'<small>'+esc(q.explanation)+'</small>':'')+'</li>').join('')+'</ol></section>':'';
  const vocabHtml=vocabulary.length?'<section class="section"><h2><span class="index">03</span> Words to know</h2><dl class="vocabulary">'+
    vocabulary.map(q=>'<div><dt>'+esc(q.term)+'</dt>'+(q.meaning?'<dd>'+esc(q.meaning)+'</dd>':'')+'</div>').join('')+'</dl></section>':'';
  return decoratePaper(htmlHead(guide,'Study guide')+'<main class="sheet study-guide">'+
    header(guide,'Study Guide',clean(guide?.label)||'Upcoming class test')+
    '<div class="badge-row"><span>01 LEARN</span><span>02 SEE AN EXAMPLE</span><span>03 PRACTICE</span></div>'+
    '<div class="focus-note"><strong>My learning goal</strong>'+esc(goal(guide,kind))+'</div>'+
    '<div class="columns"><section class="section card"><h2><span class="index">01</span> What I need to know</h2>'+factContent+'</section>'+
    '<section class="section card"><h2><span class="index">02</span> How to remember it</h2>'+howTo+'</section></div>'+
    '<section class="section"><h2><span class="index">03</span> Learn from a worked example</h2>'+exampleHtml+'</section>'+
    vocabHtml+recallHtml+extraReview+
    '<div class="checklist"><label><i class="checkbox" aria-hidden="true"></i>I can explain the main idea.</label>'+
    '<label><i class="checkbox" aria-hidden="true"></i>I can solve an example.</label>'+
    '<label><i class="checkbox" aria-hidden="true"></i>I am ready for my worksheet.</label></div>'+
    warningHtml(guide)+footer(guide)+'</main></body></html>',kind);
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
  if(kindOf(guide)==='spelling')return dictationWorksheet(guide);
  if(!rows(guide?.practice).length)return noBankWorksheet(guide);
  return renderClassroomStudyGuide(guide,dictionary);
}
