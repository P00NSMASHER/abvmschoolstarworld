/** Separate current-curriculum learning notes and assessment-style practice papers. */
import {renderClassroomStudyGuide} from './classroom-test-guide.mjs?v=6';
import {premiumPaperCss,decoratePaper} from './premium-paper-theme.mjs?v=2';
import {teacherTestReferenceForGuide,teacherFormatSummary,classroomPracticeFormatSummary} from './teacher-test-format.mjs';

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
  if(/grammar|predicate|sentence type|punctuation|common.{0,8}proper nouns|proper nouns/.test(label))return 'grammar';
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
  '.faith-rules{column-width:2.8in;column-gap:.35in}.faith-rules li{break-inside:avoid}',
  '@media print{.premium-paper .study-guide .section{break-inside:auto;page-break-inside:auto}.study-guide .section h2{break-after:avoid;page-break-after:avoid}}',
  '@media print{.study-guide .quick-rules,.study-guide .quick-words{font-size:12pt;line-height:1.5}}',
  '.quick-rules{margin:.055in 0;padding-left:1.2em}.quick-rules li+li{margin-top:.045in}.quick-words{display:flex;flex-wrap:wrap;gap:.08in;list-style:none;padding:0}.quick-words li{padding:.035in .10in;border:1px solid #aeb9c0;border-radius:6px}.guide-source{font-size:9pt;margin-top:.15in}.guide-source summary{cursor:pointer}.study-guide .topic-grid:has(> :only-child){grid-template-columns:minmax(0,1fr)}',
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
  '@media print{.premium-paper .combined-dictation .dictation-item{min-height:.76in}.combined-dictation .hand-line{height:.54in}}',
  '.combined-dictation{grid-template-columns:repeat(2,minmax(0,1fr));gap:.35in}.dictation-body>div{min-width:0}',
  '@media screen and (max-width:620px){.combined-dictation{grid-template-columns:1fr;gap:0}}',
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

// Shorten reviewed teaching copy by exact match. New or changed facts pass through in full.
const quickCopy=new Map([
  ['A consonant digraph is two consonant letters that work together to make one sound, as in sh, ch, th, and wh.',
    'Two consonants can make one sound. Look for sh, ch, th, and wh.'],
  ['In a digraph, the two letters make one sound. In a blend, you can still hear both consonant sounds.',
    'A digraph makes one sound. In a blend, you hear each sound.'],
  ['“Two letters, one sound.” Box the digraph, tap the box once, and say its sound.',
    '“Two letters, one sound.” Box the letters. Tap once. Say the sound.'],
  ['Some words start with three consonants whose individual sounds can still be heard, such as str in street, spl in splash, and spr in spring.',
    'Hear all three starting sounds in str (street), spl (splash), and spr (spring).'],
  ['A blend keeps the consonant sounds together. A digraph, such as sh in ship, makes one new sound instead.',
    'In a blend, hear each sound. In ship, sh makes just one sound.'],
  ['Tap the first three consonant sounds separately, then blend them smoothly into the whole word.',
    'Tap each sound. Slide the sounds together and say the word.'],
  ['A singular noun names one person, place, animal, or thing. A plural noun names more than one.',
    'A noun names a person, place, animal, or thing. Singular means one. Plural means more than one.'],
  ['Most nouns add -s to become plural; nouns ending in sounds such as s, x, and ch often add -es.',
    'Usually add -s (cat → cats). Words ending in s, x, or ch often add -es (box → boxes).'],
  ['For a consonant followed by y, many plural nouns change y to -ies, as in baby → babies.',
    'After a consonant, y often changes to -ies (baby → babies).'],
]);
// Equivalent wordings from class checklists and lesson notes share one child-facing line.
// A different wording stays intact until it has been reviewed.
const faithPhrases=[
  ['Original sin comes from Adam and Eve’s sin. It makes it hard to choose what is right.',
    "Original sin; human tendency to sin which is the result of Adam & Eve's sin.",
    'Original sin is the human tendency to sin connected with Adam and Eve’s sin.'],
  ['Faith is God’s gift that helps us believe.',
    'Faith: gift from God that helps us believe.', 'Faith is a gift from God that helps us believe.'],
  ['A sacrament is a sacred sign Jesus gave the Church.',
    'Sacrament: sacred sign given to the Church by Jesus.', 'A sacrament is a sacred sign given to the Church by Jesus.'],
  ['Baptism washes away original sin. We receive the Holy Spirit, faith, and new life in grace.',
    'At Baptism, original sin is washed away and we receive the gift of the Holy Spirit and the gift of faith as well as the new life of grace.',
    'At Baptism, original sin is washed away and we receive the Holy Spirit, faith, and new life in grace.'],
  ['The Trinity is one God in three Persons: Father, Son, and Holy Spirit.',
    'Remember: the Trinity is three Persons in one God — Father, Son, and Holy Spirit.',
    'Trinity: 3 persons in one God (Father, Son, Holy Spirit).', 'The Trinity means one God in three Persons.'],
  ['God made us in his image and likeness. We can think, choose, and love.',
    "We are made in God's image and likeness; we can think, choose, love.",
    "Being made in God's image means people can think, choose, and love."],
  ['Our senses help us enjoy God’s gifts.',
    "We use our senses to enjoy God's gifts.", 'The current Religion lesson connects our senses with noticing and enjoying God’s gifts of creation.'],
  ['A seed dies so a new plant can grow. Jesus died so we can have new life in grace.',
    'Jesus is like a seed. A seed dies for a new plant to grow---Jesus died so we can have new life (grace).',
    'The current Religion lesson compares a seed dying so a new plant can grow with Jesus dying so we can have new life in grace.'],
  ['Mary is the mother of Jesus and of the Church.', 'The current Religion lesson identifies Mary as Jesus’ mother and the mother of the Church.'],
  ['Jesus died for us and rose again so we can have new life in grace.',
    'Jesus is our Savior; class notes connect his death and Resurrection with new life in grace.'],
  ['Jesus is God’s greatest gift. He tells us about God and teaches us how to live.',
    "Jesus is God's greatest gift to us; he tell us about God and teaches us how to live."],
  ['We must care for God’s creation.', "It is our responsiblity to take care of God's gifts of creation."],
  ['At Baptism, our ears, mouths, and hearts open to God’s message.',
    "our ears, mouths, and hearts are open to God's message at Baptism", 'At Baptism, our ears, mouths, and hearts are open to God’s message.'],
  ['Jesus is the vine. His disciples are branches. The fruit stands for good deeds.',
    'The public Christ Our Life Grade 2 Chapter 2 sample explains that Jesus is the vine, disciples are branches, and good deeds are pictured as fruit.'],
  ['Grace is sharing in God’s own life.', 'Grace means a share in God’s very own life.'],
  ['The pope and bishops carry on the mission of the Apostles as Church leaders.', 'The pope and bishops lead the Church and carry on the Apostles’ work.'],
  ['The Church is the worldwide community of Jesus’ followers.', 'The Church is the community of Jesus’ followers everywhere.'],
  ['God made each person in his image and likeness.', 'God created every person in his image and likeness.'],
  ['The priest uses water when celebrating Baptism.', 'Water is used during the Rite of Baptism.'],
];
for(const [short,...sources] of faithPhrases)for(const source of sources)quickCopy.set(source,short);
function teachingLine(value){
  const line=clean(value).replace(/^Teacher-style (?:supplemental practice|mnemonic):\s*/i,'');
  // Publisher/author credits belong in the source note. Keep the entire teaching line.
  if(/^verified Grade 2 skill:|^original ABVM teaching explanations \(not teacher-provided\):/i.test(line)||
    /^these (?:explanations|examples|original examples|are not teacher-published).*(?:teacher-provided|not a (?:teacher|school)|not teacher-|original ABVM teaching|not supplied|were not|teacher-supplied questions|without verified meaning evidence)/i.test(line))return '';
  return quickCopy.get(line)??line;
}
function skillTip(id){
  if(/^(?:math-)?(?:place-value|expanded-form)$/.test(id))
    return 'Each digit has a place. In 347, the 3 means 300, the 4 means 40, and the 7 means 7. So 347 = 300 + 40 + 7.';
  if(id==='common-proper-nouns')
    return 'A common noun names any person, place, or thing, like a city. A proper noun names a special one, like Pottsville. Start a proper noun with a capital letter.';
  return '';
}
function spellingWordsHtml(guide){
  const words=unique(guide.spellingWords);
  if(!words.length)return '<p class="warning">No confirmed word list is available for this test yet.</p>';
  const longO=/\blong o\b/i.test(guide.label);
  const examples=longO?words.filter(word=>/^(?:home|cone|nose|poke|rope)$/i.test(word)):[];
  const tips=(examples.length?'<p><b>Magic e:</b> '+examples.map(esc).join(', ')+'. The silent e helps o say its name.</p>':'')+
    (longO&&words.some(word=>/^have$/i.test(word))?'<p><b>Watch out:</b> have ends in e, but its a is short.</p>':'');
  return '<section class="section"><h2>My spelling words</h2><ul class="quick-words">'+
    words.map(word=>'<li><strong>'+esc(word)+'</strong></li>').join('')+'</ul>'+tips+'</section>';
}
export function renderTestStudyGuide(guide={},dictionary=()=> ''){
  const kind=kindOf(guide),questions=rows(guide.practice);
  const bySkill=new Map();
  for(const question of questions){
    const id=clean(question?.skill);
    if(!bySkill.has(id))bySkill.set(id,question);
  }
  const supplied=rows(guide.reviewTopics).filter(topic=>clean(topic?.label));
  const topics=supplied.length?supplied:[...bySkill].map(([id,q])=>({
    id,label:id.replace(/-/g,' ')||'Example',summary:clean(q?.explanation),
  }));
  const seen=new Set();
  function distinct(lines){
    return unique(lines.map(teachingLine)).filter(line=>{
      const key=line.toLowerCase();
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    });
  }
  // Keep all verified facts and skill rules. Repeated exercises stay in the practice bank.
  const chapters=rows(guide.teacherFacts);
  const announced=clean(guide.label).toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ');
  const sourceLines=[...chapters,...rows(guide.classFacts??guide.facts)].filter(line=>{
    if(/^((?:weekly |teacher(?:-posted)? |verified )?spelling words|photo-confirmed practice words|words for spelling test)\b/i.test(line))return false;
    const title=clean(line).match(/^(?:.*?test focus|skill|grammar):\s*(.*?)(?:\s*\(test [^)]+\))?$/i)?.[1];
    return !title||!announced.includes(title.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim());
  });
  const list=lines=>'<ul class="quick-rules">'+lines.map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul>';
  // Cumulative Religion has a separate chapter checklist. Its Unit 1 practice
  // questions rehearse that checklist; render those facts once without Q&A cards.
  const religionList=kind==='religion'&&chapters.length>0;
  const cards=topics.map(topic=>{
    const notes=rows(topic.notes).map(teachingLine).filter(Boolean);
    const tip=skillTip(topic.id);
    const lines=distinct([...(notes.length?notes:[topic.summary]),tip]);
    const example=bySkill.get(topic.id);
    const worked=!notes.length&&!chapters.length&&example?.prompt&&example?.answer
      ? '<p class="say-it"><b>Example</b> '+esc(example.prompt)+' <b>'+esc(example.answer)+'</b></p>':'';
    if(!lines.length&&!worked)return '';
    if(religionList)return lines.map(line=>'<li data-guide-skill="'+esc(topic.id)+'">'+esc(line)+'</li>').join('');
    return '<article class="topic-card" data-guide-skill="'+esc(topic.id||topic.label)+'"><h3>'+esc(topic.label)+'</h3>'+
      (lines.length?list(lines):'')+worked+'</article>';
  }).join('');
  const facts=distinct(sourceLines);
  const words=rows(guide.vocabulary).map(word=>{
    const term=clean(typeof word==='string'?word:word?.term),provided=clean(word?.meaning);
    const meaning=provided&&!/teacher page does not provide a definition|no definition supplied/i.test(provided)?provided:'';
    const teaching=meaning?'':clean(dictionary(term));
    return {term,meaning:meaning||teaching,original:!!teaching};
  }).filter(word=>word.term);
  const wordList=words.length?'<section class="section"><h2>Words to know</h2><dl class="vocabulary">'+words.map(word=>
    '<div><dt>'+esc(word.term)+(word.original?'<sup>*</sup>':'')+'</dt><dd>'+esc(word.meaning||'Look up this word in your class notes.')+'</dd></div>'
  ).join('')+'</dl>'+(words.some(word=>word.original)?'<small>* Original study explanation — not supplied by the teacher.</small>':'')+'</section>':'';
  const actual=teacherFormatSummary(guide),format=actual||classroomPracticeFormatSummary(guide);
  const details='<details class="guide-source"><summary>Original home review · Sources for grown-ups</summary>'+
    (format?'<p><strong>'+(actual?'Previous actual test format (example only)':'Previous publisher practice format (not a teacher-issued test)')+'</strong> '+esc(format)+'</p>':'')+
    warningHtml(guide)+footer(guide)+'</details>';
  const hasScope=cards||facts.length||words.length||rows(guide.spellingWords).length;
  const missing=rows(guide.coverage?.missingGuideSkills);
  return decoratePaper(htmlHead(guide,'Study guide')+'<main class="sheet study-guide">'+
    header(guide,kind==='spelling'?'Spelling Word Study':'Study Guide',clean(guide.label)||'Upcoming class test')+
    (guide.scopeNotice?'<p class="warning scope-notice">'+esc(guide.scopeNotice)+'</p>':'')+
    (kind==='spelling'?spellingWordsHtml(guide):'')+
    (religionList?'<section class="section"><h2>What I need to know</h2><ul class="quick-rules faith-rules">'+cards+facts.map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul></section>':
      cards?'<section class="section"><h2>What I need to know</h2><div class="topic-grid">'+cards+'</div></section>':'')+
    (!religionList&&facts.length?'<section class="section"><h2>'+(!cards?'What I need to know':'Class notes')+'</h2>'+list(facts)+'</section>':'')+
    (kind==='reading'&&isShortVowelGuide(guide,topics,questions)?vowelStory():'')+wordList+
    (kind==='spelling'&&/handwriting/i.test(guide.label)?'<p class="focus-note"><strong>Handwriting</strong>Write on the line. Check tall letters and letters that dip below it.</p>':'')+
    (!hasScope&&!guide.scopeNotice?'<p class="warning">Your teacher has named the test. Check your class notes for what to study. Additional verified facts have not been published yet.</p>':'')+
    (missing.length?'<p class="warning">Also review these topics in your class notes: '+missing.map(id=>esc(clean(id).replace(/-/g,' '))).join(', ')+'.</p>':'')+
    details+'</main></body></html>',kind);
}
function dictationWorksheet(guide,words){
  const lines=words.map((_,index)=>'<div class="dictation-item"><span class="n">'+(index+1)+'.</span>'+
    '<span class="hand-line" aria-label="Write word '+(index+1)+'"></span></div>');
  const combined=teacherTestReferenceForGuide(guide)?.columns===2;
  const split=Math.ceil(lines.length/2);
  const columns=combined?[lines.slice(0,split),lines.slice(split)]:[lines];
  const student='<main class="sheet dictation-sheet">'+header(guide,'Spelling Dictation','Listen to each word. Write it on the next line.')+
    '<div class="name-row">Name: <span></span> Date: <span></span></div>'+
    '<div class="dictation-body'+(combined?' combined-dictation':'')+'">'+columns.map(lines=>'<div>'+lines.join('')+'</div>').join('')+'</div>'+footer(guide)+'</main>';
  const key='<section class="sheet adult-key">'+header(guide,'Adult Dictation List',clean(guide.label))+
    '<p>Read one word at a time. Repeat it once if needed.</p>'+
    '<ol>'+words.map(word=>'<li>'+esc(word)+'</li>').join('')+'</ol>'+footer(guide)+'</section>';
  return decoratePaper(htmlHead(guide,'Spelling dictation worksheet')+student+key+'</body></html>','spelling');
}
export function renderTestWorksheet(guide){
  const words=unique(guide?.spellingWords).filter(word=>/^[a-z][a-z'-]*$/i.test(word));
  if(!guide?.scopePending){
    if(kindOf(guide)==='spelling'&&words.length)return dictationWorksheet(guide,words);
    const practice=rows(guide?.practice).filter(row=>clean(row?.prompt)&&clean(row.answer)&&
      (!rows(row.choices).length||row.choices.filter(choice=>choice===row.answer).length===1));
    if(practice.length)return renderClassroomStudyGuide({...guide,practice});
  }
  const message=guide?.scopePending?'The teacher has announced the test. Check your class notes for the topics to review.':
    'Check your class materials for this test. Matching practice questions are not available yet.';
  return decoratePaper(htmlHead(guide,'Practice worksheet')+'<main class="sheet">'+
    header(guide,'Practice worksheet',clean(guide?.label))+'<p class="focus-note">'+esc(message)+'</p>'+
    footer(guide)+'</main></body></html>',kindOf(guide));
}
