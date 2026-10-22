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
 return [{subject,topic:topics.find(topic=>/\bsubtraction\b|\bsubtract(?:ing)?\b/i.test(topic)),title:'Subtraction, step by step',label:'ABVM worked example',paragraphs:[
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
  const linked=allTopics.map(topic=>({subject,topic,title:topic,label:'Class notes',paragraphs:unique(source.filter(row=>row.kind!=='topic'&&(row.topic===topic||row.topics?.includes(topic))).map(row=>row.text))})).filter(row=>row.paragraphs.length);
  const sections=[...linked,...(data.explanations||[]).filter(row=>row.subject===subject&&allTopics.includes(row.topic)),...mathExplanations(subject,allTopics)];
  const explanations=sections.map(row=>({...row,paragraphs:(Array.isArray(row.paragraphs)?row.paragraphs:[]).filter(value=>all||matches(subject+' '+row.title+' '+(row.topic||'')+' '+value))})).filter(row=>row.paragraphs.length);
  const topics=allTopics.filter(value=>keep(value)||explanations.some(row=>row.topic===value));
  const review=unique(source.filter(row=>row.kind!=='topic'&&!allTopics.some(topic=>row.topic===topic||row.topics?.includes(topic))).map(row=>row.text)).filter(keep);
  const subjectWords=words.filter(row=>wordSubject(row)===subject&&keep(row.term+' '+meaning(row)));
  const saved=lessons.filter(row=>row.subject===subject&&keep([row.title,...(row.notes||[])].join(' ')));
  const references=links.filter(row=>row.subject===subject&&keep(row.label));
  const notices=warnings.filter(row=>row.subject===subject&&keep(row.text));
  return {subject,index,original,topics,explanations,review,words:subjectWords,lessons:saved,links:references,warnings:notices,count:explanations.reduce((sum,row)=>sum+row.paragraphs.length,0)+topics.length+review.length+subjectWords.length+saved.length+references.length+notices.length};
 }).filter(row=>!tokens.length||row.count>0);
}

// Conservative presentation-only collapse: original school wording remains
// available in the disclosure and in the source model. No chapter attribution
// or teacher evidence is inferred from these comparisons.
const noteStopWords=new Set(['the','and','for','with','that','this','from','are','was','were','which','their','they','has','have','will','into','about','when','then','also','your','you','our','after','before']);
const noteKeywords=value=>new Set(normalized(value).replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(word=>word.length>=3&&!noteStopWords.has(word)));
function sameTeachingPoint(a,b){
 const left=noteKeywords(a),right=noteKeywords(b);
 if(left.size<5||right.size<5)return false;
 const shared=[...left].filter(word=>right.has(word)).length;
 return shared>=5&&shared/Math.min(left.size,right.size)>=0.80&&shared/Math.max(left.size,right.size)>=0.60;
}

function detailHtml(row,{source,meaning,query=''}) {
 // A source note without an explicit topic association stays in its subject's
 // Class notes card. Never guess a chapter from keywords or source order.
 const paragraphs=section=>'<div class="notes-explanation"><small>'+esc(section.label)+'</small>'+list(section.paragraphs)+'</div>';
 const seenAcrossTopics=[];
 const topics=row.topics.map((topic,i)=>{
  const sections=row.explanations.filter(section=>section.topic===topic);
  if(!sections.length)return '';
  const seenInThisTopic=[],alternative=[];
  const body=sections.map(section=>{
   const kept=section.paragraphs.filter(paragraph=>{
    // Search matches must stay immediately readable, even if similar.
    if(!query&&seenInThisTopic.some(prior=>sameTeachingPoint(prior,paragraph))){
     alternative.push({label:section.label,text:paragraph});return false;
    }
    seenInThisTopic.push(paragraph);seenAcrossTopics.push(paragraph);return true;
   });
   return kept.length?paragraphs({...section,paragraphs:kept}):'';
  }).join('');
  const alternateHtml=alternative.length?'<details class="study-note-source-variants" data-note-disclosure="'+row.index+'-variants-'+i+'"><summary>Alternative original wording ('+alternative.length+')</summary><div class="study-note-body">'+list(alternative.map(item=>item.text))+'</div></details>':'';
  return '<details class="study-note-topic" data-note-disclosure="'+row.index+'-topic-'+i+'" open><summary><strong>'+esc(topic)+'</strong></summary><div class="study-note-body">'+
   body+alternateHtml+'</div></details>';
 }).join('');
 const topicOnly=row.topics.filter(topic=>!row.explanations.some(section=>section.topic===topic));
 const topicList=topicOnly.length?'<details class="study-note-topic" data-note-disclosure="'+row.index+'-topics" open><summary><strong>Topics from class</strong></summary><div class="study-note-body">'+list(topicOnly)+'</div></details>':'';
 const separate=row.review.filter(paragraph=>query||!seenAcrossTopics.some(prior=>sameTeachingPoint(prior,paragraph)));
 const duplicates=query?[]:row.review.filter(paragraph=>!separate.includes(paragraph));
 const classNotes=separate.length?'<details class="study-note-topic" data-note-disclosure="'+row.index+'-class-notes" open><summary><strong>'+(seenAcrossTopics.length?'Additional class notes':'Class notes')+'</strong></summary><div class="study-note-body">'+list(separate)+'</div></details>':'';
 const originalWording=duplicates.length?'<details class="study-note-topic study-note-source-variants" data-note-disclosure="'+row.index+'-original"><summary><strong>Original classroom wording</strong><small>'+duplicates.length+' similar '+(duplicates.length===1?'note':'notes')+'</small></summary><div class="study-note-body">'+list(duplicates)+'</div></details>':'';
 const words=row.words.length?'<details class="study-note-topic study-vocabulary" data-note-disclosure="'+row.index+'-words" open><summary><strong>Words to know</strong><small>'+row.words.length+' '+(row.words.length===1?'word':'words')+'</small></summary><div class="study-note-body"><ul>'+row.words.map(word=>{const definition=meaning(word),supplemental=Boolean(definition)&&(!text(word.meaning)||/teacher page does not provide a definition|no definition supplied/i.test(text(word.meaning)));return '<li><strong>'+esc(word.term)+'</strong>'+(definition?' — '+esc(definition):'')+(supplemental?'<small> Original Grade 2 explanation, not from the teacher.</small>':'')+'</li>';}).join('')+'</ul></div></details>':'';
 const saved=row.lessons.map((lesson,i)=>'<details class="study-note-topic game-material-lesson" data-note-disclosure="'+row.index+'-saved-'+i+'" open><summary><strong>'+esc(lesson.title)+'</strong><small>'+esc(dateLabel(lesson.studiedOn))+'</small></summary><div class="study-note-body">'+list((lesson.notes||[]).filter(text))+'</div></details>').join('');
 return '<header class="study-note-heading"><img src="./assets/illustrations/'+art(row.subject)+'.webp" alt="" width="64" height="64"><div><small>'+esc(source==='saved'?'Cumulative learning':'This week’s confirmed material')+'</small><h3 id="study-notes-title-'+row.index+'" tabindex="-1">'+esc(row.subject)+'</h3></div></header>'+
  row.warnings.map(value=>'<p class="game-note-warning">'+esc(value.text)+'</p>').join('')+
  '<div class="study-note-topic-grid">'+topics+classNotes+originalWording+topicList+words+saved+'</div>'+
  '<div class="study-note-references">'+row.links.map(link=>'<a data-religion-review href="'+esc(link.url)+'" target="_blank" rel="noopener">'+esc(link.label)+'</a>').join('')+'</div>';
}

export function renderNotesLibrary(data,{source='weekly',subject='',query='',overview=false,meaning=row=>row.meaning||''}={}) {
 const rows=notesLibraryData(data,{query,meaning}),selected=rows.find(row=>row.subject===subject)||(!overview&&rows.length===1&&!query.trim()?rows[0]:null);
 const queryText=query.slice(0,120),count=rows.reduce((sum,row)=>sum+row.count,0);
 const cards=rows.map(row=>{
  const parts=[row.explanations.length?row.explanations.reduce((sum,section)=>sum+section.paragraphs.length,0)+' study notes':'',row.topics.length?row.topics.length+' '+(row.topics.length===1?'topic':'topics'):'',row.words.length?row.words.length+' '+(row.words.length===1?'word':'words'):'',row.lessons.length?row.lessons.length+' saved '+(row.lessons.length===1?'lesson':'lessons'):''].filter(Boolean);
  const caption=parts.slice(0,2).join(' · ')||(row.review.length?row.review.length+' class '+(row.review.length===1?'note':'notes'):row.links.length?'Official reviews':'Source information');
  return '<button type="button" class="notes-subject-card" data-notes-subject="'+row.index+'" aria-pressed="'+Boolean(selected?.subject===row.subject)+'" aria-controls="study-notes-panel-'+row.index+'" aria-label="'+esc(row.subject)+'"><img src="./assets/illustrations/'+art(row.subject)+'.webp" alt="" width="64" height="64"><span><strong>'+esc(shortSubject(row.subject))+'</strong><small>'+esc(caption)+'</small></span><b aria-hidden="true">›</b></button>';
 }).join('');
 return '<div class="notes-library"><div class="notes-library-heading"><h3>Study library</h3></div>'+
  '<div class="study-note-scope" role="group" aria-label="Notes to review">'+['weekly','saved'].map(key=>'<button type="button" data-notes-source="'+key+'" aria-pressed="'+(source===key)+'">'+(key==='weekly'?'This week':'Cumulative')+'</button>').join('')+'</div>'+
  '<div class="notes-search"><label class="visually-hidden" for="study-notes-search">Search study notes</label><input id="study-notes-search" type="search" data-notes-search placeholder="Search notes, words or topics" value="'+esc(queryText)+'" maxlength="120" autocomplete="off" enterkeyhint="search">'+(queryText?'<button type="button" data-notes-clear aria-label="Clear note search">Clear</button>':'')+'</div>'+
  '<p class="notes-search-status" role="status" aria-live="polite">'+esc(queryText?count+' '+(count===1?'match':'matches')+' across '+rows.length+' '+(rows.length===1?'subject':'subjects'):source==='saved'?'Includes saved lessons. Undated work stays here, not in This week.':'Confirmed for this school week. Undated and earlier material stays in Cumulative.')+'</p>'+
  '<div class="notes-subject-browser"'+(selected?' hidden':'')+'><div class="study-note-subjects notes-subject-grid" role="group" aria-label="Choose a subject">'+cards+'</div>'+(!rows.length?'<p class="study-tools-empty">'+(queryText?'No matching notes. Try another word or clear your search.':'No lesson notes are included in this selection.')+'</p>':'')+'</div>'+
  '<div class="notes-reader"'+(!selected?' hidden':'')+'><button type="button" class="notes-back" data-notes-back>‹ Back to subjects</button><div class="study-notes-grid">'+rows.map(row=>'<section class="study-note-panel" id="study-notes-panel-'+row.index+'" data-note-subject="'+esc(row.subject)+'"'+(row.subject!==selected?.subject?' hidden':'')+' aria-labelledby="study-notes-title-'+row.index+'">'+detailHtml(row,{source,meaning,query:queryText})+'</section>').join('')+'</div></div></div>';
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
