/** Print-friendly, photo-informed original Grade 2 practice, never teacher test copies. */
import {premiumPaperCss,decoratePaper} from './premium-paper-theme.mjs?v=2';
import {teacherTestReferenceForGuide,canRenderTeacherLetterChoice,checkedBubblePaperFormat,checkedBubbleQuestionForGuide} from './teacher-test-format.mjs';
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
  if (/grammar|predicate|punctuation|sentence types|common.{0,8}proper nouns|proper nouns/.test(name)) return 'grammar';
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
'.teacher-word-bank{border:1.5px solid #444;padding:.09in .12in;margin:.1in 0 .16in;break-inside:avoid}'+
'.teacher-word-bank h3,.math-visual h3{font-size:10pt;margin:0 0 .05in}'+
'.word-bank-words{display:flex;flex-wrap:wrap;gap:.055in .16in;font-size:11pt;font-weight:600;list-style:none;padding:0;margin:0}'+
'.word-bank-words li{padding:.025in .06in;border-bottom:1px solid #aaa}'+
'.word-bank-problems{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.03in .22in}'+
'.word-bank-item{min-height:.8in}.word-bank-answer{display:flex;gap:.12in;align-items:baseline;font-size:9.5pt}'+
'.word-bank-answer .answer-rule{flex:1;display:block;min-width:.6in;height:.27in;border-bottom:1px solid #333}'+
'.math-visual{margin:.1in 0 .13in;padding:.085in .12in;border:1px solid #777;break-inside:avoid}'+
'.math-visual p{margin:0 0 .06in;font-size:9pt}.place-value-cells{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.08in}'+
'.place-value-cell{display:grid;text-align:center;border:1px solid #777;font-size:9pt;font-weight:700}'+
'.place-value-cell span{height:.27in;border-top:1px dashed #bbb}'+
'.number-line{display:grid;grid-template-columns:repeat(21,minmax(0,1fr));margin:.12in 0 0;border-top:1.5px solid #333}'+
'.number-tick{height:.27in;position:relative;text-align:center;font-size:7pt;padding-top:.08in}'+
'.number-tick:before{content:"";position:absolute;top:-.05in;left:50%;height:.09in;border-left:1px solid #333}'+
'.number-tick:nth-child(even){font-size:0}'+
'@media screen and (max-width:640px){.word-bank-problems{grid-template-columns:1fr}.place-value-cells{gap:.025in}}'+
'.problem:last-child{border-bottom:0}.prompt{margin:0 0 .08in;line-height:1.43;font-size:11pt}.number{font-weight:700;padding-right:.05in}'+
'.instruction{font-size:9.5pt;margin:0 0 .075in;color:#333}.choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.06in .18in;margin-left:.18in}'+
'.choice{display:flex;align-items:baseline;gap:.05in;font-size:10.5pt;min-width:0}.bubble{width:.13in;height:.13in;border:1.4px solid #111;border-radius:50%;display:inline-block;flex:none;align-self:center}'+
'.sentence-task{padding:.08in 0 .24in}.sentence-task .prompt{font-size:12pt;margin:.03in 0 .12in}.sentence-answer{display:flex;gap:.4in;margin:.13in 0 .08in .24in;font-size:10pt}'+
'.work-area{min-height:.5in;display:flex;align-items:flex-end;justify-content:flex-end;padding:0 .1in .08in}.answer-rule{width:1.6in;border-bottom:1px solid #111}'+
'.math-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-top:1px solid #777;border-left:1px solid #777}'+
'.math-grid .problem{border-right:1px solid #777;border-bottom:1px solid #777;padding:.12in;min-height:1.23in}.math-grid .work-area{min-height:.45in}'+
'.adult-key{break-before:page;page-break-before:always}.adult-key h2{font-size:12pt}.key-list{list-style:none;columns:2;column-gap:.25in;line-height:1.5;padding-left:.24in;font-size:10.5pt}'+
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
'.story-practice{margin:.18in 0}.story-practice>p{font-size:9.5pt}.story-response{break-inside:avoid;page-break-inside:avoid;border:1px solid #888;border-radius:10px;padding:.12in;margin:.11in 0}'+
'.story-response h3{font-size:11pt;margin:0 0 .07in}.story-response label{display:block;font-size:9pt;font-weight:700;margin:.08in 0 .02in}.response-line{display:block;height:.3in;border-bottom:1px solid #777}'+
'@media screen{body{background:#edf0f3;padding:20px}.sheet{background:#fff;padding:.46in;box-shadow:0 5px 22px #0002;margin:0 auto 16px}.adult-key{margin-top:16px;break-before:auto}}'+
'@media screen and (max-width:640px){body{padding:9px;font-size:11pt}.sheet{width:100%;padding:13px;box-shadow:none;border-radius:8px}.paper-topline{font-size:8pt}.sheet-header h1{font-size:18pt}.field-line{width:1.1in}.field-line.date{width:.8in}.student-fields{gap:.11in;font-size:9pt}.choices{grid-template-columns:minmax(0,1fr)}.math-grid{grid-template-columns:minmax(0,1fr)}.word-list{grid-template-columns:repeat(2,minmax(0,1fr))}.activity-steps{grid-template-columns:minmax(0,1fr)}.key-list{columns:1}}'+
'@media print{body{background:#fff}.sheet{max-width:none;width:100%}.adult-key{break-before:page}.problem,.memory-section{break-inside:avoid}}';
const teacherExamPatternCss = [
  '.handwriting-answer{height:.48in;position:relative;margin:.2in 0 .09in;border-top:1px solid #888;border-bottom:1.4px solid #333}',
  '.handwriting-answer:after{content:"";position:absolute;width:100%;top:50%;border-top:1px dashed #999}',
  '.teacher-letter-choice-problems{columns:2;column-gap:.3in;column-fill:auto;display:block!important;list-style:none!important}',
  '.teacher-letter-choice-problems .teacher-letter-choice-item{break-inside:avoid;page-break-inside:avoid;display:flex;align-items:flex-start;gap:.1in;min-height:1.2in;margin:0 0 .14in;padding:.1in .04in!important;border:0!important;background:transparent!important}',
  '.teacher-letter-choice-item .teacher-answer-blank{display:block;flex:0 0 .24in;border-bottom:1px solid #222;height:.27in;margin-top:.18in}',
  '.teacher-letter-choice-item .teacher-prompt-and-options{min-width:0;flex:1}',
  '.teacher-letter-choice-item .prompt{font-size:11.2pt!important;line-height:1.35!important;margin:0 0 .07in!important}',
  '.teacher-letter-choice-item .teacher-vertical-choices{display:block!important;margin-left:.12in}',
  '.teacher-letter-choice-item .teacher-choice-row{display:flex;gap:.08in;padding:.025in 0;font-size:10.4pt;line-height:1.26}',
  '.teacher-letter-choice-item .teacher-choice-letter{width:.22in;flex:0 0 .22in;font-weight:500}',
  '.teacher-bubble-choice-problems{columns:2;column-gap:.26in;display:block!important;list-style:none!important}',
  '.teacher-bubble-choice-item{display:block!important;break-inside:avoid;page-break-inside:avoid;min-height:1.05in;margin:0 0 .10in!important;padding:.1in .06in!important;border:0!important}',
  '.teacher-bubble-choice-item .prompt{font-size:10.6pt!important;margin:0 0 .08in!important}',
  '.teacher-bubble-options{display:grid!important;grid-template-columns:1fr;gap:.04in;padding-left:.12in}',
  '.teacher-bubble-choice-item .teacher-bubble-option{display:flex;gap:.07in;align-items:baseline;font-size:10.1pt;line-height:1.25}',
  '.teacher-bubble-option .teacher-bubble-mark{display:inline-block;flex:none;width:.16in;height:.16in;border:1.4px solid #222;border-radius:50%;background:transparent;align-self:center}',
  '.teacher-bubble-option .teacher-bubble-letter{flex:none;width:.19in}',
  '@media screen and (max-width:700px){.teacher-letter-choice-problems,.teacher-bubble-choice-problems{columns:1}}',
  '@media print{',
  '  .premium-paper .student-test .question-topline{display:none}',
  '  .premium-paper .student-test .teacher-letter-choice-problems{column-fill:balance}',
  '  .premium-paper .compact-problems{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.09in}',
  '  .premium-paper .compact-problems .problem{margin:0!important;padding:.08in .10in!important}',
  '  .premium-paper .compact-problems .choices{grid-template-columns:1fr}',
  '  .premium-paper .student-test.teacher-letter-choice{background:#fff!important;color:#111!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:0!important}',
  '  .premium-paper .student-test.teacher-letter-choice .sheet-header{background:#fff!important;border:0!important;border-bottom:2px solid #222!important;border-radius:0!important;padding:.05in 0!important;min-height:0!important}',
  '  .premium-paper .student-test.teacher-letter-choice .sheet-header h1{color:#111!important;font-family:Arial,Helvetica,sans-serif!important;font-size:18pt!important}',
  '  .premium-paper .student-test.teacher-letter-choice .sheet-header .premium-paper-hero{display:none!important}',
  '  .premium-paper .student-test.teacher-letter-choice .section-title{background:#fff!important;border:0!important;border-bottom:1px solid #999!important;border-radius:0!important;color:#111!important;padding:0!important}',
  '  .premium-paper .student-test.teacher-letter-choice .section-title .premium-mini-art{display:none!important}',
  '  .premium-paper .student-test.teacher-letter-choice .directions{background:#fff!important;color:#111!important;border:0!important;border-radius:0!important;padding:0!important;font-weight:600!important}',
  '  .premium-paper .student-test.teacher-letter-choice .teacher-letter-choice-item{background:#fff!important;border:0!important;color:#111!important}',
  '  .premium-paper .student-test.teacher-letter-choice .teacher-letter-choice-problems{columns:2!important}',
  '  .premium-paper .student-test.teacher-letter-choice .teacher-choice-row{color:#111!important}',
  '  .premium-paper .student-test.teacher-bubble-choice .teacher-bubble-choice-problems{columns:2!important}',
  '  .premium-paper .student-test.teacher-bubble-choice .teacher-bubble-mark{border:1.5px solid #222!important;background:transparent!important}',
  '}'
].join('\n');

function teacherLetterChoiceHtml(item,index) {
  return '<li class="problem teacher-letter-choice-item">' +
    '<span class="teacher-answer-blank" aria-label="Write one answer letter"></span>' +
    '<div class="teacher-prompt-and-options"><p class="prompt"><span class="number">'+(index+1)+'.</span> '+
      escape(clean(item?.prompt))+'</p>' +
    '<div class="teacher-vertical-choices">'+arr(item?.choices).map((choice,j)=>
      '<div class="teacher-choice-row"><span class="teacher-choice-letter">'+String.fromCharCode(65+j)+'.</span>'+
      '<span>'+escape(choice)+'</span></div>').join('')+'</div></div></li>';
}

/** Realistic original bubble layout; full question content is never changed or dropped. */
function teacherBubbleChoiceHtml(item,index) {
  return '<li class="problem teacher-bubble-choice-item"><p class="prompt"><span class="number">'+
    (index+1)+'.</span> '+escape(clean(item?.prompt))+'</p>'+
    '<div class="teacher-bubble-options">'+arr(item?.choices).map((choice,j)=>
      '<div class="teacher-bubble-option"><span class="teacher-bubble-mark" aria-hidden="true"></span>'+
      '<span class="teacher-bubble-letter">'+String.fromCharCode(65+j)+'.</span>'+
      '<span>'+escape(choice)+'</span></div>').join('')+'</div></li>';
}
/** Only reproduce an observed word-bank arrangement with original, checked content. */
function checkedWordBank(guide,questions,kind) {
  if(kind!=='religion'||teacherTestReferenceForGuide(guide)?.kind!=='word-bank'||questions.length<2)return null;
  const answers=questions.map(item=>clean(item?.answer));
  if(answers.some(answer=>answer.length>44||!/^[-\p{L}][\p{L}\p{M}'’ -]*$/u.test(answer)))return null;
  const normalized=answers.map(answer=>answer.toLocaleLowerCase('en-US'));
  if(new Set(normalized).size!==answers.length)return null;
  if(questions.some((item,i)=>clean(item.prompt).toLocaleLowerCase('en-US').includes(normalized[i])))return null;
  const words=[...answers].sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base'}));
  if(words.every((word,i)=>word===answers[i]))words.push(words.shift());
  return words;
}
function wordBankHeader(words) {
  return '<aside class="teacher-word-bank" aria-label="Words to choose from"><h3>Word Bank · Use each answer once</h3>'+
    '<ul class="word-bank-words">'+words.map(word=>'<li>'+escape(word)+'</li>').join('')+'</ul></aside>';
}
function wordBankQuestionHtml(item,index) {
  return '<li class="problem word-bank-item"><p class="prompt"><span class="number">'+(index+1)+'.</span> '+
    escape(clean(item.prompt))+'</p><div class="word-bank-answer">Answer <span class="answer-rule" aria-label="Write an answer from the word bank"></span></div></li>';
}
/** Blank visuals support current, checked math skills without supplying answers. */
function mathVisual(guide,questions) {
  const skills=[clean(guide?.label),...questions.map(item=>clean(item.skill))].join(' ').toLowerCase();
  const values=questions.flatMap(item=>[clean(item.prompt),clean(item.answer)]
    .flatMap(row=>[...row.matchAll(/\b\d{1,5}\b/g)].map(match=>Number(match[0]))));
  if(!values.length)return '';
  if(/place[- ]value|expanded[- ]form/.test(skills) && values.every(value=>value<=999))
    return '<aside class="math-visual" aria-label="Empty place-value chart"><h3>Scratch chart · Place value</h3>'+
      '<p>Use the empty columns to organize a number. Work out each question yourself.</p>'+
      '<div class="place-value-cells">'+['Hundreds','Tens','Ones'].map(label=>
        '<div class="place-value-cell">'+label+'<span aria-hidden="true"></span></div>').join('')+'</div></aside>';
  if(/subtract|subtraction/.test(skills) && values.every(value=>value<=20) &&
    questions.every(item=>/[-−]|subtract|minus|left/i.test(clean(item.prompt))))
    return '<aside class="math-visual" aria-label="Number line from zero to twenty"><h3>Scratch chart · Number line</h3>'+
      '<p>Start at a number. Count backward for subtraction.</p><div class="number-line">'+
      Array.from({length:21},(_,n)=>'<span class="number-tick">'+n+'</span>').join('')+'</div></aside>';
  return '';
}
function pageHeader(title,guide,adult=false) {
  return '<header class="sheet-header"><div class="paper-topline"><span>ABVM · GRADE 2 · PRACTICE</span><span>'+escape(dateText(guide?.date))+'</span></div>'+
    '<h1>'+escape(title)+'</h1><p class="test-label">'+(adult?'Parent answer key — keep separate':'Parent-created practice based on school topics')+'</p></header>';
}
function sourceNote(guide) {
  return '<footer class="source-note">'+escape(guide?.sourceLabel || 'Current reviewed material and original practice')+
    (guide?.sourceCheckedAt ? ' · Teacher source checked '+escape(String(guide.sourceCheckedAt).slice(0,10)) : '')+
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
function questionSkill(item) {
  const skill=clean(item?.skill).replace(/[-_]+/g,' ').replace(/\s+/g,' ');
  if (!skill) return '';
  return '<div class="question-topline"><span class="question-skill">'+escape(skill)+'</span></div>';
}
function questionHtml(item,index,kind) {
  if(item.handwritingPractice)return '<li class="problem handwriting-item"><p class="prompt"><span class="number">'+
    (index+1)+'.</span> Listen to the practice word. Write it on the lines.</p><div class="handwriting-answer" aria-label="Write the word"></div></li>';
  const mode=itemMode(item,kind);
  const text='<p class="prompt"><span class="number">'+(index+1)+'.</span> '+escape(mode.prompt)+'</p>';
  const skill=questionSkill(item);
  if(mode.mode==='sentence-type')return '<li class="problem sentence-task">'+skill+text+
    '<p class="instruction">'+escape(mode.detail)+'</p>'+
    '<div class="sentence-answer"><span>End mark: ______</span><span>Type: ______</span></div></li>';
  if(mode.mode==='underline')return '<li class="problem sentence-task">'+skill+
    '<p class="instruction">'+escape(mode.detail)+'</p>'+text+'</li>';
  if(mode.mode==='write'&&kind==='math')return '<li class="problem math-problem">'+skill+text+
    '<p class="instruction">'+escape(mode.detail||'Show your thinking.')+'</p>'+
    '<div class="work-area math-work-area"><div class="math-work-canvas" aria-hidden="true"></div>'+
    '<div class="math-answer">Answer <span class="answer-rule"></span></div></div></li>';
  if(mode.mode==='write'){
    const extended=/\b(explain|why|describe|tell|how|sentence|detail|compare)\b/i.test(mode.prompt)||
      clean(item?.answer).length>36;
    const numberOfLines=extended?3:1;
    return '<li class="problem write-problem">'+skill+text+
      (mode.detail?'<p class="instruction">'+escape(mode.detail)+'</p>':'')+
      '<div class="response-lines'+(extended?' extended':'')+'" aria-label="Write your answer">'+
      Array.from({length:numberOfLines},()=>'<span aria-hidden="true"></span>').join('')+'</div></li>';
  }
  return '<li class="problem pick-problem">'+skill+text+
    '<p class="instruction">Circle one answer.</p><div class="choices">'+arr(item?.choices).map((choice,j)=>
    '<div class="choice"><span class="bubble" aria-hidden="true"></span><span>'+
      String.fromCharCode(65+j)+'. '+escape(choice)+'</span></div>').join('')+'</div></li>';
}
function keyHtml(item,index,kind,markedChoice) {
  const mode=itemMode(item,kind);
  const letters={statement:'S / .',question:'Q / ?',command:'C / .',exclamation:'E / !'};
  const answer=markedChoice?String.fromCharCode(65+item.choices.indexOf(item.answer))+'. '+clean(item.answer):mode.mode==='sentence-type'
    ? letters[clean(item?.answer).toLowerCase()] || clean(item?.answer)
    : clean(item?.answer);
  const explanation=item.handwritingPractice?'Read this original practice word aloud. Check its spelling and letter formation.':clean(item?.explanation);
  return '<li><b>'+(index+1)+'.</b> '+escape(answer)+
    (explanation&&explanation!==clean(item?.answer)?'<small class="answer-why">'+(item.handwritingPractice?'Adult: ':'Why: ')+escape(explanation)+'</small>':'')+'</li>';
}
// Prefer uncovered chapters, then skills and explicitly taught endings. A
// paper can sample several rules even when they share one curriculum skill ID.
function worksheetSample(bank,limit){
  if(bank.length<=limit)return bank;
  const remaining=bank.map(question=>{
    const skills=new Set([question.skill,...arr(question.assessedSkillIds)].filter(Boolean));
    const endings=[...clean(question.explanation).matchAll(/(?:^|\s)(-[a-z]{1,5})\b/gi)]
      .map(match=>question.skill+' '+match[1].toLowerCase());
    return {question,chapters:arr(question.sourceChapters),skills:[...skills],endings:[...new Set(endings)]};
  });
  const seen=new Set(),types=new Map(),result=[];
  const unseen=values=>values.filter(value=>!seen.has(value)).length;
  while(result.length<limit){
    const best=remaining.reduce((left,right)=>{
      const priority=unseen(right.chapters)-unseen(left.chapters)||
        unseen(right.skills)-unseen(left.skills)||unseen(right.endings)-unseen(left.endings)||
        (types.get(left.question.questionType)||0)-(types.get(right.question.questionType)||0);
      return priority>0?right:left;
    });
    remaining.splice(remaining.indexOf(best),1);
    for(const value of [...best.chapters,...best.skills,...best.endings])seen.add(value);
    types.set(best.question.questionType,(types.get(best.question.questionType)||0)+1);
    result.push(best.question);
  }
  return result;
}

export function renderClassroomStudyGuide(guide) {
  const kind=subjectKind(guide),titles={math:'Math Practice Test',grammar:'Grammar Practice Test',reading:'Reading Practice Test',religion:'Religion Practice Test',spelling:'Spelling Pattern Practice'};
  const head='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+
    escape(guide?.label || 'Practice worksheet')+'</title><style>'+styles+premiumPaperCss+teacherExamPatternCss+'</style></head><body>';
  const bank=arr(guide?.practice);
  const storyTitles=kind==='reading'&&bank.some(row=>row.skill==='main-idea-details')
    ? unique(guide?.facts).filter(fact=>/^Story:\s*\S/i.test(fact)).map(fact=>fact.replace(/^Story:\s*/i,''))
    : [];
  const sample=worksheetSample(bank,storyTitles.length?5:6);
  // Only a checked whole-word answer can serve as original dictation. Keep it
  // out of every other printed prompt and choice so the student cannot copy it.
  const dictatedWord=kind==='spelling'&&/handwriting/i.test(guide.label)&&sample.find(row=>
    /^[a-z][a-z'-]+$/i.test(row.answer)&&/\bwhich (?:of these )?word\b/i.test(row.prompt)&&
    !sample.some(other=>other!==row&&[other.prompt,...arr(other.choices)].some(text=>
      clean(text).toLowerCase().split(/[^a-z'-]+/).includes(row.answer.toLowerCase()))));
  const questions=sample.map(row=>row===dictatedWord?{...row,handwritingPractice:true}:row);
  const count=questions.length+(storyTitles.length?1:0);
  const teacherLetterChoice=kind==='religion' && canRenderTeacherLetterChoice(guide,questions);
  const fullBubbleFormat=!teacherLetterChoice?checkedBubblePaperFormat(guide,questions):null;
  const firstBubble=teacherLetterChoice?null:questions.find(row=>checkedBubbleQuestionForGuide(guide,row));
  const bubbleFormat=fullBubbleFormat||(firstBubble&&checkedBubbleQuestionForGuide(guide,firstBubble));
  const eligibleBubbles=bubbleFormat?questions.filter(row=>checkedBubbleQuestionForGuide(guide,row)).length:0;
  const mixedBubbles=bubbleFormat&&eligibleBubbles<questions.length;
  const wordBank=!teacherLetterChoice&&!bubbleFormat?checkedWordBank(guide,questions,kind):null;
  const instructions={math:'Solve each problem. Show your work in the boxes.',
    grammar:'Read each question and follow its directions.',
    reading:'Read each question and follow its directions.',
    religion:'Read each question and follow its directions.',
    spelling:dictatedWord?'Choose an answer or write the word your adult reads.':'Read each question and choose your answer.'};
  const storyPractice=storyTitles.length?'<section class="story-practice"><article class="story-response"><h3>'+count+
    '. Read '+(storyTitles.length>1?'one of these stories':'this story')+'</h3><p>'+storyTitles.map(escape).join(' · ')+'</p>'+
    '<label>Main idea</label><span class="response-line"></span><span class="response-line"></span>'+
    '<label>One detail that supports it</label><span class="response-line"></span><span class="response-line"></span></article></section>':'';
  const student='<main class="sheet student-test'+(teacherLetterChoice?' teacher-letter-choice':bubbleFormat?' teacher-bubble-choice':'')+'">'+pageHeader(titles[kind],guide)+
    '<div class="student-fields"><span>Name: <i class="field-line"></i></span><span>Date: <i class="field-line date"></i></span>'+
    '<span>Score: <i class="field-line score"></i> / '+count+'</span></div>'+
    '<div class="directions"><strong>Directions:</strong> '+escape(wordBank?'Read each question. Choose the best word or phrase from the word bank. Use each answer once.':teacherLetterChoice?'Read each question. Write the letter of the best answer on the line.':mixedBubbles?'Follow the directions for each item. For a bubble question, fill in one bubble.':bubbleFormat?'Read each question. Fill in one bubble next to the best answer.':instructions[kind])+'</div>'+
    (guide?.scopeNotice?'<p class="caution scope-notice">'+escape(guide.scopeNotice)+'</p>':'')+
    (bubbleFormat?'<p class="caution format-evidence">'+escape(
      bubbleFormat.origin==='prior-actual-teacher-test'?
        'Mode: Practice like my teacher. Prior actual teacher-test layout; future format is not guaranteed.':
        'Mode: Practice like my teacher. Prior teacher-marked publisher practice; the next test format is unverified.'
    )+(mixedBubbles?' '+escape(eligibleBubbles+' of '+questions.length+' items use the observed bubble layout; other items retain their original response format.'):'')+'</p>':'')+
    (wordBank?'<p class="caution format-evidence">Practice layout from a previous actual teacher test; the next test format is not guaranteed.</p>'+wordBankHeader(wordBank):'')+
    (kind==='math' && !bubbleFormat && questions.length<=4 ? mathVisual(guide,questions) : '')+
    (questions.length?'<h2 class="section-title">'+escape(clean(guide.label)||'Practice questions')+'</h2><ol class="paper-problems '+(teacherLetterChoice?'teacher-letter-choice-problems ':wordBank?'word-bank-problems ':bubbleFormat?'teacher-bubble-choice-problems ':kind==='math'?'math-grid':'compact-problems')+'">'+
      questions.map((row,i)=>teacherLetterChoice?teacherLetterChoiceHtml(row,i):wordBank?wordBankQuestionHtml(row,i):bubbleFormat&&checkedBubbleQuestionForGuide(guide,row)?teacherBubbleChoiceHtml(row,i):questionHtml(row,i,kind)).join('')+'</ol>'
      :'<p class="caution">No matching original-practice questions are available for this assessment. Review the available class notes.</p>')+
    storyPractice+
    '<div class="student-self-check"><strong>Before I finish</strong><span>□ I answered every question.</span><span>□ I checked my work.</span></div>'+
    sourceNote(guide)+'</main>';
  if(!questions.length)return decoratePaper(head+student+'</body></html>',kind);
  const storyKey=storyTitles.length?'<li><b>'+count+'.</b> The main idea tells what the chosen story is mostly about. The detail must come from the story and support that idea.</li>':'';
  const key='<section class="sheet adult-key">'+pageHeader('Parent Answer Key',guide,true)+
    '<p class="instruction">Keep this sheet separate. Check each answer after the student finishes.</p>'+
    (dictatedWord?'<p class="instruction">Use the original example word below for handwriting practice. A matching teacher word list is unavailable.</p>':'')+
    '<h2>Answers</h2><ol class="key-list" role="list">'+questions.map((row,i)=>keyHtml(row,i,kind,teacherLetterChoice||checkedBubbleQuestionForGuide(guide,row))).join('')+storyKey+'</ol>'+
    arr(guide?.warnings).filter(note=>note!==guide.scopeNotice).slice(0,3).map(note=>'<p class="caution">'+escape(note)+'</p>').join('')+
    sourceNote(guide)+'</section>';
  return decoratePaper(head+student+key+'</body></html>',kind);
}
