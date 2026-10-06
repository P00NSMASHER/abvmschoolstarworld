const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = value => typeof value === 'string' ? value.trim() : '';
const array = value => Array.isArray(value) ? value : [];
const PLACEHOLDER_DEFINITION = /teacher page does not provide a definition|no definition supplied|no source definition posted/i;
const STOP = new Set(['test','tests','quiz','assessment','friday','monday','tuesday','wednesday','thursday','handwriting','chapter','grade','review','short','long','and','the','for','with','from']);

function uniqueText(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const text = clean(row?.text ?? row);
    const key = text.toLowerCase();
    return text && !seen.has(key) && seen.add(key);
  });
}
function subjectNames(test, questions = []) {
  const fromQuestions = [...new Set(array(questions).map(q => clean(q?.subject)).filter(Boolean))];
  if (fromQuestions.length) return fromQuestions;
  const label = clean(test?.label).toLowerCase();
  if (/religion|faith|church|jesus|sacrament|baptism/.test(label)) return ['Religion'];
  if (/spelling|handwriting|phonics|vowel|blend/.test(label)) return ['Spelling / Handwriting'];
  if (/grammar|predicate|reading|ela|comprehension|language/.test(label)) return ['Reading / ELA'];
  if (/math|addition|subtraction|place value|measurement|time|money|geometry/.test(label)) return ['Math'];
  return [];
}
function focusTokens(label) {
  return [...new Set(clean(label).toLowerCase().match(/[a-z0-9]+/g) || [])]
    .filter(token => token.length > 2 && !STOP.has(token));
}
function conflictsWithNamedFocus(text, label) {
  const targetChapter = clean(label).match(/chapter\s*(\d+)/i)?.[1];
  const rowChapter = clean(text).match(/chapter\s*(\d+)/i)?.[1];
  if (targetChapter && rowChapter && targetChapter !== rowChapter) return true;
  const targetVowel = clean(label).match(/short\s+([aeiou])[^a-z]+(?:\/|and)?\s*long\s+\1/i)?.[1]?.toLowerCase();
  const rowVowel = clean(text).match(/short\s+([aeiou])[^a-z]+(?:\/|and)?\s*long\s+\1/i)?.[1]?.toLowerCase();
  return !!(targetVowel && rowVowel && targetVowel !== rowVowel);
}
function rankText(row, subjects, tokens, label) {
  const text = clean(row?.text ?? row);
  if (!text || conflictsWithNamedFocus(text,label)) return -Infinity;
  const subject = clean(row?.subject);
  let score = subjects.includes(subject) ? 8 : subjects.length ? 0 : 2;
  const lower = text.toLowerCase();
  for (const token of tokens) if (lower.includes(token)) score += 3;
  if (/remember|means|is |are |practice|compare|ask|look for/i.test(text)) score += 1;
  return score;
}
function normalizedVocabulary(rows, subjects) {
  const seen = new Set();
  return array(rows).filter(row => {
    const term = clean(row?.term), subject = clean(row?.subject);
    const key = term.toLowerCase();
    return term && (!subjects.length || subjects.includes(subject)) && !seen.has(key) && seen.add(key);
  }).slice(0,6).map(row => ({subject:clean(row.subject),term:clean(row.term),meaning:clean(row.meaning)}));
}
function normalizedQuestions(rows) {
  const seen = new Set();
  return array(rows).filter(row => {
    const prompt = clean(row?.prompt), answer = clean(row?.answer), key = (prompt+'|'+answer).toLowerCase();
    return prompt && answer && !seen.has(key) && seen.add(key);
  }).slice(0,4).map(row => ({
    subject:clean(row.subject), prompt:clean(row.prompt), choices:array(row.choices).map(clean).filter(Boolean).slice(0,4),
    answer:clean(row.answer), hint:clean(row.hint), explanation:clean(row.explanation),
  }));
}

export function buildStudyGuide({test, pack = {}, questions = [], notes = [], lessons = [], vocabulary = [], warnings = [], fallback = false} = {}) {
  if (!test || !/^\d{4}-\d{2}-\d{2}$/.test(test.date || '') || !clean(test.label)) return null;
  const subjects = subjectNames(test,questions), tokens = focusTokens(test.label);
  const packNotes = array(pack.subjects).filter(row => !subjects.length || subjects.includes(clean(row?.subject))).flatMap(row => [
    ...array(row?.topics).map(text => ({subject:row.subject,text})),
    ...array(row?.studyNotes).map(text => ({subject:row.subject,text})),
  ]);
  const lessonNotes = array(lessons).filter(row => !subjects.length || subjects.includes(clean(row?.subject))).flatMap(row =>
    array(row?.notes).map(text => ({subject:row.subject,text}))
  );
  const ranked = uniqueText([...packNotes,...array(notes),...lessonNotes])
    .map((row,index) => ({row,index,score:rankText(row,subjects,tokens,test.label)}))
    .filter(item => Number.isFinite(item.score) && item.score > 0)
    .sort((a,b) => b.score-a.score || a.index-b.index)
    .slice(0,6)
    .map(item => clean(item.row?.text ?? item.row));
  const guideWarnings = array(warnings).filter(row => {
    const subject = clean(row?.subject);
    return clean(row?.text) && (!subjects.length || subjects.includes(subject));
  }).map(row => clean(row.text)).slice(0,2);
  return {
    key:test.date+'|'+test.label,
    date:test.date,
    label:clean(test.label),
    subjects,
    notes:ranked,
    vocabulary:normalizedVocabulary(vocabulary,subjects),
    questions:normalizedQuestions(questions),
    warnings:guideWarnings,
    fallback:!!fallback,
    generatedFrom:'Reviewed ABVM teacher material and saved schoolwork',
  };
}

export function resolvedVocabularyMeaning(row, dictionary = () => '') {
  const supplied = clean(row?.meaning);
  if (supplied && !PLACEHOLDER_DEFINITION.test(supplied)) return supplied;
  return clean(dictionary(row?.term));
}
function prettyDate(date) {
  const value = new Date(date+'T12:00:00Z');
  return Number.isFinite(value.getTime()) ? new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'}).format(value) : date;
}
function guideBodyHtml(guide, dictionary) {
  const notes = array(guide?.notes), vocabulary = array(guide?.vocabulary), questions = array(guide?.questions), warnings = array(guide?.warnings);
  const words = vocabulary.map(row => ({term:row.term,meaning:resolvedVocabularyMeaning(row,dictionary)})).filter(row => row.term);
  const noteHtml = notes.length ? '<ul class="abvm-guide-notes">'+notes.map(text => '<li>'+esc(text)+'</li>').join('')+'</ul>'
    : '<p class="abvm-guide-empty">No reviewed test-specific notes are posted yet. Use the quick check below and verify the newest teacher materials before the test.</p>';
  const wordHtml = words.length ? '<section class="abvm-guide-section"><h2>Words to know</h2><div class="abvm-guide-words">'+words.map(row =>
    '<div><strong>'+esc(row.term)+'</strong>'+(row.meaning?'<span>'+esc(row.meaning)+'</span>':'')+'</div>').join('')+'</div></section>' : '';
  const questionHtml = questions.length ? '<section class="abvm-guide-section"><h2>Quick check</h2><div class="abvm-guide-questions">'+questions.map((row,index) =>
    '<article><strong>'+(index+1)+'. '+esc(row.prompt)+'</strong>'+(row.choices.length?'<ol type="A">'+row.choices.map(choice=>'<li>'+esc(choice)+'</li>').join('')+'</ol>':'')+'</article>').join('')+'</div></section>' : '';
  const answerHtml = questions.length ? '<footer class="abvm-guide-key"><strong>Answer key:</strong> '+questions.map((row,index)=>(index+1)+'. '+esc(row.answer)).join(' · ')+'</footer>' : '';
  const warningHtml = (guide?.fallback || warnings.length) ? '<aside class="abvm-guide-warning">'+
    (guide.fallback?'<p><strong>Practice source:</strong> Original Grade 2 skill practice is included because a reviewed test-specific question bank is not available yet.</p>':'')+
    warnings.map(text=>'<p>'+esc(text)+'</p>').join('')+'</aside>' : '';
  return '<div class="abvm-guide-top"><div><p>ABVM GRADE 2 · ONE-PAGE STUDY GUIDE</p><h1>'+esc(guide.label)+'</h1><span>'+esc(guide.subjects?.join(' + ') || 'Test review')+'</span></div><time datetime="'+esc(guide.date)+'">'+esc(prettyDate(guide.date))+'</time></div>'+
    '<section class="abvm-guide-section"><h2>What to know</h2>'+noteHtml+'</section>'+wordHtml+questionHtml+warningHtml+answerHtml;
}
export function printableStudyGuideHtml(guide, dictionary = () => '') {
  return '<section id="abvm-print-guide" class="abvm-print-guide" aria-label="'+esc(guide?.label || 'Test')+' printable study guide">'+guideBodyHtml(guide,dictionary)+'</section>';
}
function ensurePrintStyle(doc) {
  if (doc.getElementById('abvm-test-guide-print-style')) return;
  const style=doc.createElement('style');style.id='abvm-test-guide-print-style';style.textContent=`
.abvm-print-guide{display:none}
@media print{
  @page{size:letter portrait;margin:.38in}
  html,body{background:#fff!important}
  body>*:not(#abvm-print-guide){display:none!important}
  #abvm-print-guide{display:block!important;box-sizing:border-box;width:100%;max-width:7.74in;height:auto;max-height:10.24in;overflow:hidden;margin:0;color:#172838;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
  .abvm-guide-top{display:grid;grid-template-columns:minmax(0,1fr) 1.55in;gap:.2in;align-items:start;border-bottom:2px solid #173f69;padding-bottom:.11in}
  .abvm-guide-top p{margin:0 0: .03in;color:#5d6c7a;font-size:7.5pt;font-weight:800;letter-spacing:.08em}
  .abvm-guide-top h1{margin:0;font-size:20pt;line-height:1.05;letter-spacing:-.02em}
  .abvm-guide-top span{display:block;margin-top:.04in;font-size:9pt;color:#425568;font-weight:700}
  .abvm-guide-top time{border:1px solid #c8d4df;border-radius:8px;padding:.09in;text-align:center;font-size:9pt;font-weight:800;line-height:1.25}
  .abvm-guide-section{margin-top:.11in;break-inside:avoid}
  .abvm-guide-section h2{margin:0 0 .05in;color:#173f69;font-size:11pt}
  .abvm-guide-notes{columns:2;column-gap:.25in;margin:0;padding-left:.18in;font-size:8.7pt;line-height:1.3}
  .abvm-guide-notes li{break-inside:avoid;margin:0 0 .045in}
  .abvm-guide-empty{margin:0;padding:.08in;border:1px dashed #bdc9d4;border-radius:7px;font-size:8.5pt;line-height:1.35}
  .abvm-guide-words{display:grid;grid-template-columns:1fr 1fr;gap:.045in .12in}
  .abvm-guide-words>div{display:grid;grid-template-columns:.72in minmax(0,1fr);gap:.05in;align-items:baseline;padding:.045in .06in;border-radius:6px;background:#f3f7fa;font-size:8.1pt;line-height:1.25}
  .abvm-guide-words strong{color:#183d63}.abvm-guide-words span{color:#34495d}
  .abvm-guide-questions{display:grid;grid-template-columns:1fr 1fr;gap:.07in .15in}
  .abvm-guide-questions article{break-inside:avoid;padding:.06in .07in;border:1px solid #d4dde5;border-radius:7px;font-size:8.1pt;line-height:1.23}
  .abvm-guide-questions article>strong{display:block;margin-bottom:.025in}
  .abvm-guide-questions ol{margin:.025in 0 0;padding-left:.2in}.abvm-guide-questions li{margin:.01in 0}
  .abvm-guide-warning{margin-top:.09in;padding:.065in .08in;border-left:3px solid #b98a22;background:#fff8df;font-size:7.4pt;line-height:1.25}
  .abvm-guide-warning p{margin:0}.abvm-guide-warning p+p{margin-top:.03in}
  .abvm-guide-key{margin-top:.09in;border-top:1px solid #cbd5de;padding-top:.055in;font-size:7.7pt;line-height:1.25;color:#3a4a59}
}
`;doc.head.append(style);
}
export function printStudyGuide(win, guide, dictionary = () => '') {
  if (!win?.document || typeof win.print !== 'function' || !guide) return false;
  ensurePrintStyle(win.document);
  win.document.getElementById('abvm-print-guide')?.remove();
  win.document.body.insertAdjacentHTML('beforeend',printableStudyGuideHtml(guide,dictionary));
  win.print();
  return true;
}
