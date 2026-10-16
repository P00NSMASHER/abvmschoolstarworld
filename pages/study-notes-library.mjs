// Presentation only: teacher wording, subject associations and lesson dates stay governed.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=value=>typeof value==='string'&&value.trim();
const unique=rows=>{const seen=new Set();return rows.filter(text).filter(row=>{const key=row.trim();if(seen.has(key))return false;seen.add(key);return true;});};
const normalized=value=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('en-US');
const safeLink=value=>{try{return /^https?:$/.test(new URL(value).protocol);}catch{return false;}};
const wordSubject=row=>text(row.subject)?row.subject:'Words to know';
const list=rows=>'<ul>'+rows.map(row=>'<li>'+esc(row)+'</li>').join('')+'</ul>';
const art=subject=>/math/i.test(subject)?'math':/religion/i.test(subject)?'religion':/spell|handwriting/i.test(subject)?'spelling':'reading';
const shortSubject=subject=>subject==='Reading / ELA'?'Reading':subject==='Spelling / Handwriting'?'Spelling':subject;
const dateLabel=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')):'Undated schoolwork';

// Original teaching support follows only a subtraction topic in this selection.
// It does not claim a teacher question, worksheet range, chapter, or assessment.
function mathExplanations(subject,topics){
 if(subject!=='Math'||!topics.some(topic=>/\bsubtraction\b|\bsubtract(?:ing)?\b/i.test(topic)))return [];
 return [{subject,topic:null,title:'Subtraction, step by step',label:'ABVM worked example',paragraphs:[
  'Subtraction tells how many are left or finds the difference between amounts.',
  'In 12 − 5 = 7, start with 12, take away 5, and 7 are left. The difference is 7.',
  'Count back one number for each item taken away. You can also count up from 5 to 12: seven steps gives the same difference.',
  'Check with addition: 7 + 5 = 12, so 12 − 5 = 7.',
  'For a missing part, use the related addition fact. In 9 − __ = 5, think 5 + 4 = 9. The missing part is 4.',
  'Order matters. Start with the whole when taking away: 12 − 5 and 5 − 12 are different calculations.'
 ]}];
}

export function notesLibraryData(data={}, {query='',meaning=row=>row.meaning||''}={}) {
 const notes=(data.notes||[]).filter(row=>text(row.text));
 const words=(data.vocabulary||[]).filter(row=>text(row.term));
 const lessons=data.lessons||[],links=(data.links||[]).filter(row=>safeLink(row.url)),warnings=data.warnings||[];
 const priority=['Reading / ELA','Spelling / Handwriting','Math','Religion'];
 const rank=subject=>priority.includes(subject)?priority.indexOf(subject):priority.length;
 const subjects=unique([...notes,...links,...warnings,...lessons,...words.map(row=>({...row,subject:wordSubject(row)}))].map(row=>row.subject)).sort((a,b)=>rank(a)-rank(b));
 const tokens=normalized(query.slice(0,120)).trim().split(/\s+/).filter(Boolean);
 const matches=value=>tokens.every(token=>normalized(value).includes(token));
 return subjects.map(subject=>{
  const index=Array.from(subject).map(value=>value.codePointAt(0).toString(16)).join('-');
  const source=notes.filter(row=>row.subject===subject),all=matches(subject),keep=value=>all||matches(subject+' '+value);
  const original=unique(source.map(row=>row.text));
  const allTopics=unique(source.filter(row=>row.kind==='topic').map(row=>row.text));
  const sections=[...(data.explanations||[]).filter(row=>row.subject===subject&&allTopics.includes(row.topic)),...mathExplanations(subject,allTopics)];
  const explanations=sections.map(row=>({...row,paragraphs:(Array.isArray(row.paragraphs)?row.paragraphs:[]).filter(value=>all||matches(subject+' '+row.title+' '+(row.topic||'')+' '+value))})).filter(row=>row.paragraphs.length);
  const topics=allTopics.filter(value=>keep(value)||explanations.some(row=>row.topic===value));
  const review=unique(source.filter(row=>row.kind!=='topic').map(row=>row.text)).filter(keep);
  const subjectWords=words.filter(row=>wordSubject(row)===subject&&keep(row.term+' '+meaning(row)));
  const saved=lessons.filter(row=>row.subject===subject&&keep([row.title,...(row.notes||[])].join(' ')));
  const references=links.filter(row=>row.subject===subject&&keep(row.label));
  const notices=warnings.filter(row=>row.subject===subject&&keep(row.text));
  return {subject,index,original,topics,explanations,review,words:subjectWords,lessons:saved,links:references,warnings:notices,count:explanations.reduce((sum,row)=>sum+row.paragraphs.length,0)+topics.length+review.length+subjectWords.length+saved.length+references.length+notices.length};
 }).filter(row=>!tokens.length||row.count>0);
}

function detailHtml(row,{source,meaning}) {
 const groups=new Map();
 for(const topic of row.topics){const prefix=topic.match(/^\s*([^:]{1,45}):\s*(.+)$/),label=prefix?prefix[1]:'Class topics';if(!groups.has(label))groups.set(label,[]);groups.get(label).push(topic);}
 const explained=row.explanations.filter(section=>section.topic),firstExplained=[...groups].findIndex(([,rows])=>explained.some(section=>rows.includes(section.topic)));
 const paragraphs=section=>'<div class="notes-explanation"><small>'+esc(section.label)+'</small>'+section.paragraphs.map(value=>'<p>'+esc(value)+'</p>').join('')+'</div>';
 const topics=[...groups].map(([label,rows],i)=>'<details class="study-note-topic" data-note-disclosure="'+row.index+'-topic-'+Array.from(label).map(value=>value.codePointAt(0).toString(16)).join('-')+'"'+(i===(firstExplained<0?0:firstExplained)?' open':'')+'><summary><strong>'+esc(label==='Story'?'Stories':label)+'</strong><small>'+rows.length+' '+(rows.length===1?'topic':'topics')+'</small></summary><div class="study-note-body">'+list(rows)+explained.filter(section=>rows.includes(section.topic)).map(paragraphs).join('')+'</div></details>').join('');
 const words=row.words.length?'<details class="study-note-topic study-vocabulary" data-note-disclosure="'+row.index+'-words"><summary><strong>Words to know</strong><small>'+row.words.length+' words</small></summary><div class="study-note-body"><dl>'+row.words.map(word=>{const definition=meaning(word);return '<div><dt>'+esc(word.term)+'</dt>'+(definition?'<dd>'+esc(definition)+'</dd>':'')+'</div>';}).join('')+'</dl></div></details>':'';
 const classNotes=row.review.length?'<div class="study-note-review" aria-label="Class notes"><div class="study-note-review-body">'+row.review.map(value=>'<article class="study-note-point"><p>'+esc(value)+'</p></article>').join('')+'</div></div>':'';
 const saved=row.lessons.length?'<section class="study-note-schoolwork"><h4>Saved schoolwork</h4>'+row.lessons.map((lesson,i)=>'<details class="game-material-lesson" data-note-disclosure="'+row.index+'-saved-'+i+'"><summary><span>'+esc(lesson.title)+'</span><small>'+esc(dateLabel(lesson.studiedOn))+'</small></summary><div class="study-note-body">'+list((lesson.notes||[]).filter(text))+'</div></details>').join('')+'</section>':'';
 const original=row.original.length?'<details class="study-notes-original" data-note-disclosure="'+row.index+'-original"><summary>Original class notes <small>Complete wording, in source order</small></summary><div class="study-note-body">'+list(row.original)+'</div></details>':'';
 return '<header class="study-note-heading"><img src="./assets/illustrations/'+art(row.subject)+'.webp" alt="" width="64" height="64"><div><small>'+esc(source==='saved'?'Current notes & saved learning':'This week’s class notes')+'</small><h3 id="study-notes-title-'+row.index+'" tabindex="-1">'+esc(row.subject)+'</h3></div></header>'+
  '<div class="study-note-references">'+row.links.map(link=>'<a data-religion-review href="'+esc(link.url)+'" target="_blank" rel="noopener">'+esc(link.label)+'</a>').join('')+'</div>'+
  row.warnings.map(value=>'<p class="game-note-warning">'+esc(value.text)+'</p>').join('')+
  row.explanations.filter(section=>!section.topic).map(section=>'<section class="notes-worked-lesson"><h4>'+esc(section.title)+'</h4>'+paragraphs(section)+'</section>').join('')+
  '<div class="study-note-topic-grid">'+topics+'</div>'+words+classNotes+saved+original;
}

export function renderNotesLibrary(data,{source='weekly',subject='',query='',overview=false,meaning=row=>row.meaning||''}={}) {
 const rows=notesLibraryData(data,{query,meaning}),selected=rows.find(row=>row.subject===subject)||(!overview&&rows.length===1&&!query.trim()?rows[0]:null);
 const queryText=query.slice(0,120),count=rows.reduce((sum,row)=>sum+row.count,0);
 const cards=rows.map(row=>{
  const parts=[row.explanations.length?row.explanations.reduce((sum,section)=>sum+section.paragraphs.length,0)+' study notes':'',row.topics.length?row.topics.length+' '+(row.topics.length===1?'topic':'topics'):'',row.words.length?row.words.length+' words':'',row.lessons.length?row.lessons.length+' saved '+(row.lessons.length===1?'lesson':'lessons'):''].filter(Boolean);
  const caption=parts.slice(0,2).join(' · ')||(row.review.length?row.review.length+' class '+(row.review.length===1?'note':'notes'):row.links.length?'Official reviews':'Source information');
  return '<button type="button" class="notes-subject-card" data-notes-subject="'+row.index+'" aria-pressed="'+Boolean(selected?.subject===row.subject)+'" aria-controls="study-notes-panel-'+row.index+'" aria-label="'+esc(row.subject)+'"><img src="./assets/illustrations/'+art(row.subject)+'.webp" alt="" width="64" height="64"><span><strong>'+esc(shortSubject(row.subject))+'</strong><small>'+esc(caption)+'</small></span><b aria-hidden="true">›</b></button>';
 }).join('');
 return '<div class="notes-library"><div class="notes-library-heading"><h3>Study library</h3></div>'+
  '<div class="study-note-scope" role="group" aria-label="Notes to review">'+['weekly','saved'].map(key=>'<button type="button" data-notes-source="'+key+'" aria-pressed="'+(source===key)+'">'+(key==='weekly'?'This week':'All learning')+'</button>').join('')+'</div>'+
  '<div class="notes-search"><label class="visually-hidden" for="study-notes-search">Search study notes</label><input id="study-notes-search" type="search" data-notes-search placeholder="Search notes, words or topics" value="'+esc(queryText)+'" maxlength="120" autocomplete="off" enterkeyhint="search">'+(queryText?'<button type="button" data-notes-clear aria-label="Clear note search">Clear</button>':'')+'</div>'+
  '<p class="notes-search-status" role="status" aria-live="polite">'+esc(queryText?count+' '+(count===1?'match':'matches')+' across '+rows.length+' '+(rows.length===1?'subject':'subjects'):source==='saved'?'Includes saved lessons. Undated work stays here, not in This week.':rows.length+' '+(rows.length===1?'subject':'subjects')+' to explore')+'</p>'+
  '<div class="notes-subject-browser"'+(selected?' hidden':'')+'><div class="study-note-subjects notes-subject-grid" role="group" aria-label="Choose a subject">'+cards+'</div>'+(!rows.length?'<p class="study-tools-empty">'+(queryText?'No matching notes. Try another word or clear your search.':'No lesson notes are included in this selection.')+'</p>':'')+'</div>'+
  '<div class="notes-reader"'+(!selected?' hidden':'')+'><button type="button" class="notes-back" data-notes-back>‹ Back to subjects</button><div class="study-notes-grid">'+rows.map(row=>'<section class="study-note-panel" id="study-notes-panel-'+row.index+'" data-note-subject="'+esc(row.subject)+'"'+(row.subject!==selected?.subject?' hidden':'')+' aria-labelledby="study-notes-title-'+row.index+'">'+detailHtml(row,{source,meaning})+'</section>').join('')+'</div></div></div>';
}

export function createNotesLibrary({getModel,win,meaning}={}) {
 let source='weekly',subject='',query='',overview=false,host=null;
 const bound=new WeakSet();
 const data=()=>getModel?.()?.notes(source);
 const html=()=>{const value=data();return value?renderNotesLibrary(value,{source,subject,query,overview,meaning}):'<p class="game-material-status" role="status">Notes are still loading.</p>';};
 function paint(focusSelector=null){
  const body=host?.querySelector('[data-study-notes-content]');if(!body)return;
  const active=win.document.activeElement,search=active?.matches('[data-notes-search]'),selection=search?[active.selectionStart,active.selectionEnd]:null;
  const states=new Map([...body.querySelectorAll('details[data-note-disclosure]')].map(row=>[row.dataset.noteDisclosure,row.open]));
  const activeId=body.contains(active)?active.id:null,disclosure=active?.closest('[data-note-disclosure]')?.dataset.noteDisclosure;
  body.innerHTML=html();
  for(const row of body.querySelectorAll('[data-note-disclosure]'))if(states.has(row.dataset.noteDisclosure))row.open=states.get(row.dataset.noteDisclosure);
  const target=search?body.querySelector('[data-notes-search]'):focusSelector?body.querySelector(focusSelector):activeId?win.document.getElementById(activeId):disclosure?body.querySelector('[data-note-disclosure="'+disclosure+'"] > summary'):null;
  target?.focus({preventScroll:true});if(search&&selection?.[0]!=null)try{target.setSelectionRange(...selection);}catch{}
 }
 async function references(){
  const owner=getModel?.(),scope=source;try{await owner?.loadReferences?.();}catch{}
  if(getModel?.()!==owner||scope!==source||!host?.isConnected||!host.open)return;
  // Update links without replacing the reader, search caret, or disclosure state.
  const rows=notesLibraryData(data()||{},{query,meaning});
  const subjects=[...host.querySelectorAll('[data-note-subject]')].map(panel=>panel.dataset.noteSubject);
  if(rows.some(row=>!subjects.includes(row.subject))){paint();return;}
  for(const panel of host.querySelectorAll('[data-note-subject]')){
   const row=rows.find(row=>row.subject===panel.dataset.noteSubject),links=panel.querySelector('.study-note-references');
   if(row&&links)links.innerHTML=row.links.map(link=>'<a data-religion-review href="'+esc(link.url)+'" target="_blank" rel="noopener">'+esc(link.label)+'</a>').join('');
  }
 }
 function bind(node){
  host=node;if(!node||bound.has(node))return;bound.add(node);
  let userOpening=false;
  node.addEventListener('toggle',()=>{if(!node.open)return;if(!node.querySelector('[data-study-notes-content]').hasChildNodes())paint();references();if(userOpening){node.scrollIntoView({block:'start',behavior:'auto'});userOpening=false;}});
  node.addEventListener('input',event=>{if(!event.target.matches('[data-notes-search]'))return;query=event.target.value.slice(0,120);subject='';overview=true;paint();});
  node.addEventListener('click',event=>{
   if(event.target.closest('summary')===node.querySelector(':scope > summary')){userOpening=!node.open;return;}
   const scope=event.target.closest('[data-notes-source]');
   if(scope){source=scope.dataset.notesSource==='saved'?'saved':'weekly';subject='';overview=false;paint('[data-notes-source="'+source+'"]');references();return;}
   if(event.target.closest('[data-notes-clear]')){query='';subject='';overview=true;paint('[data-notes-search]');return;}
   if(event.target.closest('[data-notes-back]')){const previous=subject;subject='';const value=data();const rows=notesLibraryData(value||{},{query,meaning});
    overview=true;paint();
    const card=node.querySelector('[data-notes-subject="'+(rows.find(row=>row.subject===previous)?.index??rows[0]?.index)+'"]');
    card?.focus({preventScroll:true});card?.scrollIntoView({block:'nearest',behavior:'auto'});return;}
   const card=event.target.closest('[data-notes-subject]');if(!card)return;
   const row=notesLibraryData(data()||{},{query,meaning}).find(row=>String(row.index)===card.dataset.notesSubject);if(!row)return;
   subject=row.subject;overview=false;paint('#study-notes-title-'+row.index);
   node.querySelector('.notes-reader')?.scrollIntoView({block:'start',behavior:'auto'});
  });
  if(node.open){if(!node.querySelector('[data-study-notes-content]').hasChildNodes())paint();references();}
 }
 return {html,bind};
}
