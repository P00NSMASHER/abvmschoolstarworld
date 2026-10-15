/** Print-friendly, photo-informed original Grade 2 practice, never teacher test copies. */
import {premiumPaperCss,decoratePaper} from './premium-paper-theme.mjs?v=1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = value => String(value ?? '').replace(/\s+/g,' ').trim();
const arr = value => Array.isArray(value) ? value : [];
const unique = rows => [...new Set(arr(rows).map(clean).filter(Boolean))];
const dateText = date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return '';
  const value = new Date(date+'T12:00:00Z');
  return Number.isFinite(value.getTime()) ? new Intl.DateTimeFormat('en-US',
    {weekday:'long',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(value) : '';
};
const subjectKind = guide => {
  const name=clean(guide?.label).toLowerCase(),subject=clean(guide?.subject).toLowerCase();
  if (/spelling|handwriting/.test(name) || /spelling|handwriting/.test(subject)) return 'spelling';
  if (/grammar|predicate|punctuation|sentence types/.test(name)) return 'grammar';
  if (/math|subtraction|addition/.test(name) || subject==='math') return 'math';
  if (/religion|chapter|faith/.test(name) || subject==='religion') return 'religion';
  return 'reading';
};
const styles = '@page{size:Letter portrait;margin:.46in}'+
'*{box-sizing:border-box}html,body{margin:0;padding:0;color:#111;background:#fff;font-family:Arial,Helvetica,sans-serif}'+
'body{font-size:11pt;line-height:1.38}.sheet{max-width:7.5in;margin:0 auto;min-width:0;overflow-wrap:anywhere}'+
'.sheet-header{border-bottom:2px solid #111;padding-bottom:.12in}.paper-topline{display:flex;justify-content:space-between;gap:.12in;font-size:9pt;font-weight:700}'+
'.sheet-header h1{text-align:center;font-size:20pt;line-height:1.17;margin:.16in 0 .04in}.test-label{text-align:center;font-size:9pt;margin:0 0 .1in}'+
'.student-fields{display:flex;align-items:baseline;gap:.16in;flex-wrap:wrap;margin:.18in 0 .12in;font-size:10.5pt}.student-fields span{white-space:nowrap}'+
'.field-line{display:inline-block;width:2.35in;border-bottom:1px solid #111;height:.2in;vertical-align:baseline}.field-line.date{width:1.3in}.field-line.score{width:.56in}'+
'.directions{border:1px solid #222;padding:.09in .12in;margin:.12in 0 .18in;font-size:10pt}'+
'.section-title{font-size:12pt;margin:.1in 0 .12in;border-bottom:1px solid #777;padding-bottom:.06in}'+
'.paper-problems{list-style:none;padding:0;margin:0}.problem{break-inside:avoid;page-break-inside:avoid;padding:.06in 0 .16in;border-bottom:1px solid #ccc}'+
'.problem:last-child{border-bottom:0}.prompt{margin:0 0 .08in;line-height:1.43;font-size:11pt}.number{font-weight:700;padding-right:.05in}'+
'.instruction{font-size:9.5pt;margin:0 0 .075in;color:#333}.choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.06in .18in;margin-left:.18in}'+
'.choice{display:flex;align-items:baseline;gap:.05in;font-size:10.5pt;min-width:0}.bubble{width:.13in;height:.13in;border:1.4px solid #111;border-radius:50%;display:inline-block;flex:none;align-self:center}'+
'.sentence-task{padding:.08in 0 .24in}.sentence-task .prompt{font-size:12pt;margin:.03in 0 .12in}.sentence-answer{display:flex;gap:.4in;margin:.13in 0 .08in .24in;font-size:10pt}'+
'.work-area{min-height:.5in;display:flex;align-items:flex-end;justify-content:flex-end;padding:0 .1in .08in}.answer-rule{width:1.6in;border-bottom:1px solid #111}'+
'.math-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-top:1px solid #777;border-left:1px solid #777}'+
'.math-grid .problem{border-right:1px solid #777;border-bottom:1px solid #777;padding:.12in;min-height:1.23in}.math-grid .work-area{min-height:.45in}'+
'.adult-key{break-before:page;page-break-before:always}.adult-key h2{font-size:12pt}.key-list{columns:2;column-gap:.25in;line-height:1.5;padding-left:.24in;font-size:10.5pt}'+
'.key-list li{break-inside:avoid;margin-bottom:.1in}.key-notes{margin-top:.15in;border:1px solid #888;padding:.12in}.key-notes h3{font-size:11pt;margin:0 0 .07in}'+
'.key-notes ul{margin:.02in 0 .09in;padding-left:.22in;font-size:10pt}.key-notes li{margin-bottom:.04in}'+
'.source-note{font-size:8.25pt;color:#444;margin-top:.18in;border-top:1px solid #888;padding-top:.1in}'+
'.caution{border:1px solid #888;padding:.1in;margin:.14in 0;font-size:9pt}'+
'.word-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.09in .14in;list-style:none;margin:.17in 0;padding:0}'+
'.word-list li{display:flex;align-items:center;gap:.075in;border-bottom:1px solid #888;padding:.08in .02in;font-size:13pt}.word-number{font-size:9pt;color:#444;min-width:.2in}.word-check{margin-left:auto;font-size:11pt}'+
'.memory-section{margin-top:.16in;break-inside:avoid}.memory-section h2{font-size:12pt;margin:.12in 0 .08in;border-bottom:1px solid #888}'+
'.memory-section ul{margin:.03in 0;padding-left:.25in}.memory-section li{margin:.06in 0}'+
'.activity-steps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.12in;margin:.15in 0}.activity{border:1px solid #888;padding:.11in;font-size:9.5pt}'+
'.activity h3{font-size:10pt;margin:0 0 .04in}.activity p{margin:0}'+
'@media screen{body{background:#edf0f3;padding:20px}.sheet{background:#fff;padding:.46in;box-shadow:0 5px 22px #0002;margin:0 auto 16px}.adult-key{margin-top:16px;break-before:auto}}'+
'@media screen and (max-width:640px){body{padding:9px;font-size:11pt}.sheet{width:100%;padding:13px;box-shadow:none;border-radius:8px}.paper-topline{font-size:8pt}.sheet-header h1{font-size:18pt}.field-line{width:1.1in}.field-line.date{width:.8in}.student-fields{gap:.11in;font-size:9pt}.choices{grid-template-columns:minmax(0,1fr)}.math-grid{grid-template-columns:minmax(0,1fr)}.word-list{grid-template-columns:repeat(2,minmax(0,1fr))}.activity-steps{grid-template-columns:minmax(0,1fr)}.key-list{columns:1}}'+
'@media print{body{background:#fff}.sheet{max-width:none;width:100%}.adult-key{break-before:page}.problem,.memory-section{break-inside:avoid}}';
function pageHeader(title,guide,adult=false) {
  return '<header class="sheet-header"><div class="paper-topline"><span>ABVM · GRADE 2 · PRACTICE</span><span>'+escape(dateText(guide?.date))+'</span></div>'+
    '<h1>'+escape(title)+'</h1><p class="test-label">'+(adult?'Parent answer key — keep separate':'Parent-created practice based on school topics')+'</p></header>';
}
function sourceNote(guide) {
  return '<footer class="source-note">'+escape(guide?.sourceLabel || 'Current reviewed material and original practice')+
    ' · Not a school-issued assessment. Automatically generated for this test.</footer>';
}
function itemMode(item,kind) {
  const prompt=clean(item?.prompt),answer=clean(item?.answer);
  const quoted=[...prompt.matchAll(/["“]([^"”]{6,230})["”]/g)].map(match=>match[1]);
  const sentence=answer.length>1&&quoted.find(row=>row.toLowerCase().includes(answer.toLowerCase()));
  if(kind==='grammar'&&sentence&&/(?:complete\s+)?(?:subject|predicate)/i.test(prompt))return {
    mode:'underline',prompt:sentence,detail:/predicate/i.test(prompt)?'Underline the complete predicate.':'Underline the complete subject.'};
  if(kind==='grammar'&&/^(statement|question|command|exclamation)$/i.test(answer)&&quoted.length)
    return {mode:'sentence-type',prompt:quoted[0].replace(/[.?!]\s*$/,''),detail:'Write the end mark and the letter: S, Q, C, or E.'};
  if(kind==='math'&&/^\d+(?:\.\d+)?$/.test(answer)&&/(?:\d+\s*[+−-]\s*\d+|how many|how much|what is \d+|left\?|altogether\?)/i.test(prompt))
    return {mode:'write',prompt,detail:'Show your work.'};
  if(kind==='religion'&&/_{2,}|fill in the blank|complete the sentence/i.test(prompt)&&answer.length<=48)
    return {mode:'write',prompt,detail:'Write the missing word.'};
  return {mode:arr(item?.choices).length>1?'choices':'write',prompt,detail:''};
}
function questionHtml(item,index,kind) {
  const mode=itemMode(item,kind),text='<p class="prompt"><span class="number">'+(index+1)+'.</span> '+escape(mode.prompt)+'</p>';
  if(mode.mode==='sentence-type')return '<li class="problem sentence-task">'+text+'<p class="instruction">'+escape(mode.detail)+'</p>'+
    '<div class="sentence-answer"><span>End mark: ______</span><span>Type: ______</span></div></li>';
  if(mode.mode==='underline')return '<li class="problem sentence-task"><p class="instruction">'+escape(mode.detail)+'</p>'+text+'</li>';
  if(mode.mode==='write')return '<li class="problem '+(kind==='math'?'math-problem':'write-problem')+'">'+text+
    '<p class="instruction">'+escape(mode.detail)+'</p><div class="work-area"><div class="answer-rule"></div></div></li>';
  return '<li class="problem pick-problem">'+text+'<div class="choices">'+arr(item?.choices).slice(0,4).map((choice,j)=>
    '<div class="choice"><span class="bubble" aria-hidden="true"></span><span>'+String.fromCharCode(65+j)+'. '+escape(choice)+'</span></div>').join('')+'</div></li>';
}
function keyHtml(item,index,kind) {
  if(itemMode(item,kind).mode==='sentence-type'){
    const letters={statement:'S / .',question:'Q / ?',command:'C / .',exclamation:'E / !'};
    return '<li><b>'+(index+1)+'.</b> '+escape(letters[clean(item.answer).toLowerCase()] || item.answer)+'</li>';
  }
  return '<li><b>'+(index+1)+'.</b> '+escape(item.answer)+'</li>';
}
function spellingSheet(guide) {
  const words=unique(guide?.spellingWords).filter(word=>/^[a-z][a-z'-]*$/i.test(word));
  const silent=words.filter(word=>/[aeiou][^aeiou]e$/i.test(word)),shortI=words.filter(word=>/i[^aeiou]+$/i.test(word));
  const tips=[];
  if(silent.length)tips.push('<li><b>Magic e:</b> '+silent.map(escape).join(', ')+'. The final e makes the vowel say its name.</li>');
  if(shortI.length)tips.push('<li><b>Short-i beat:</b> '+shortI.map(escape).join(', ')+'. Say the quick i sound, then spell every letter.</li>');
  if(words.includes('all'))tips.push('<li><b>all:</b> One a, then two l letters. Clap A-L-L.</li>');
  if(words.includes('any'))tips.push('<li><b>any:</b> It sounds like “eh-nee” but starts with a. Say A-N-Y.</li>');
  if(words.includes('says'))tips.push('<li><b>says:</b> It sounds like “sez”; remember the surprising A-Y. Say S-A-Y-S.</li>');
  if(!tips.length)tips.push('<li>Circle the tricky letters. Group words that share a vowel sound or ending.</li>');
  const list=words.length
    ? '<p class="instruction">Words confirmed from matching-week schoolwork. The teacher may dictate them in a different order.</p>'+
      '<ol class="word-list">'+words.map((word,index)=>'<li><span class="word-number">'+(index+1)+'.</span><strong>'+escape(word)+'</strong><span class="word-check" aria-hidden="true">□</span></li>').join('')+'</ol>'
    : '<p class="caution">No confirmed word list is available for this test. Older spelling words are not substituted for the current list.</p>';
  return '<main class="sheet spelling-sheet">'+pageHeader('Spelling Word Study',guide)+
    '<div class="student-fields"><span>Name: <i class="field-line"></i></span><span>Date: <i class="field-line date"></i></span></div>'+
    '<div class="directions"><strong>How to study:</strong> Read. Cover. Write the word on scrap paper. Check your letters. On test day your teacher will read the words aloud.</div>'+
    list+'<section class="memory-section"><h2>Remember the tricky parts</h2><ul>'+tips.join('')+'</ul></section>'+
    '<section class="memory-section"><h2>Make it stick</h2><div class="activity-steps">'+
    '<div class="activity"><h3>Cheer-the-letters</h3><p>Clap once per letter, then spell the whole word without looking.</p></div>'+
    '<div class="activity"><h3>Roblox word builder</h3><p>Draw a block for each letter. Fill the blocks from memory, then check.</p></div>'+
    '</div></section>'+arr(guide?.warnings).slice(0,2).map(note=>'<p class="caution">'+escape(note)+'</p>').join('')+
    sourceNote(guide)+'</main>';
}
export function renderClassroomStudyGuide(guide,dictionary=()=> '') {
  const kind=subjectKind(guide),titles={math:'Math Practice Test',grammar:'Grammar Practice Test',reading:'Reading Practice Test',religion:'Religion Practice Test'};
  const head='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+
    escape(guide?.label || 'Study Guide')+'</title><style>'+styles+premiumPaperCss+'</style></head><body>';
  if(kind==='spelling')return decoratePaper(head+spellingSheet(guide)+'</body></html>',kind);
  // A test packet must not silently drop verified topics or checked practice questions.
  const questions=arr(guide?.practice);
  const instructions={math:'Solve each problem. Show your work in the boxes. Write your answer clearly.',
    grammar:'Read each question. Underline, mark, or circle the answer as directed.',
    reading:'Read each question. Circle the best answer using what you learned.',
    religion:'Read each question. Circle the best answer or write the missing word.'};
  const subjectHeading={math:'Math Maintenance · Solve & show work',grammar:'Sentence and grammar skills',
    reading:'Reading comprehension and word skills',religion:'Religion review'};
  const student='<main class="sheet student-test">'+pageHeader(titles[kind],guide)+
    '<div class="student-fields"><span>Name: <i class="field-line"></i></span><span>Date: <i class="field-line date"></i></span>'+
    '<span>Score: <i class="field-line score"></i> / '+questions.length+'</span></div>'+
    '<div class="directions"><strong>Directions:</strong> '+escape(instructions[kind])+'</div>'+
    (questions.length?'<h2 class="section-title">'+escape(subjectHeading[kind])+'</h2><ol class="paper-problems '+(kind==='math'?'math-grid':'')+'">'+
      questions.map((row,i)=>questionHtml(row,i,kind)).join('')+'</ol>'
      :'<p class="caution">No matching original-practice questions are available for this assessment. Review the available class notes.</p>')+
    arr(guide?.warnings).slice(0,3).map(note=>'<p class="caution">'+escape(note)+'</p>').join('')+sourceNote(guide)+'</main>';
  if(!questions.length)return decoratePaper(head+student+'</body></html>',kind);
  const facts=unique(guide?.facts);
  const words=arr(guide?.vocabulary).map(row=>{
    const term=clean(row?.term),supplied=clean(row?.meaning);
    const meaning=supplied&&!/teacher page does not provide a definition|no definition supplied/i.test(supplied)?supplied:clean(dictionary(term));
    return {term,meaning};
  }).filter(row=>row.term);
  const factsHtml=facts.length?'<h3>Skills and facts to review</h3><ul>'+facts.map(f=>'<li>'+escape(f)+'</li>').join('')+'</ul>':'';
  const wordsHtml=words.length?'<h3>Vocabulary</h3><ul>'+words.map(w=>'<li><b>'+escape(w.term)+'</b>'+(w.meaning?' — '+escape(w.meaning):'')+'</li>').join('')+'</ul>':'';
  const key='<section class="sheet adult-key">'+pageHeader('Parent Answer Key',guide,true)+
    '<p class="instruction">Keep this sheet separate. These are answers to original, class-aligned practice questions—not to the actual school test.</p>'+
    '<h2>Answers</h2><ol class="key-list">'+questions.map((row,i)=>keyHtml(row,i,kind)).join('')+'</ol>'+
    (factsHtml||wordsHtml?'<section class="key-notes">'+factsHtml+wordsHtml+'</section>':'')+
    sourceNote(guide)+'</section>';
  return decoratePaper(head+student+key+'</body></html>',kind);
}
