import {createReadAloud} from './study-room-view.mjs';
import {renderClassroomStudyGuide} from './classroom-test-guide.mjs?v=1';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nonempty = value => typeof value === 'string' && value.trim();
const distinctNoteText = rows => {const seen=new Set();return rows.filter(text=>{const key=text.trim();if(seen.has(key))return false;seen.add(key);return true;});};
const list = rows => {const clean=(Array.isArray(rows)?rows:[]).filter(nonempty);return clean.length?'<ul>'+clean.map(row=>'<li>'+esc(row)+'</li>').join('')+'</ul>':'';};
const dateLabel = date => {const value=new Date(date+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(date||'')&&Number.isFinite(value.getTime())
  ? new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}).format(value) : '';};
const dateParts = date => {
  const value=new Date(date+'T12:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(value.getTime()))return{weekday:'',day:'',label:''};
  return {
    weekday:new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:'UTC'}).format(value),
    day:new Intl.DateTimeFormat('en-US',{day:'numeric',timeZone:'UTC'}).format(value),
    label:dateLabel(date),
  };
};
const safeUrl = value => {try{return ['https:','http:'].includes(new URL(value).protocol);}catch{return false;}};
const missingDefinition = value => /teacher page does not provide a definition|no definition supplied/i.test(String(value ?? ''));
export function resolveVocabularyMeaning(row,dictionary = () => '') {
  const supplied = nonempty(row?.meaning) ? String(row.meaning).trim() : '';
  if (supplied && !missingDefinition(supplied)) return supplied;
  const resolved = dictionary(row?.term);
  return nonempty(resolved) ? String(resolved).trim() : '';
}
const referenceHtml = link => '<a data-religion-review href="'+esc(link.url)+'" target="_blank" rel="noopener">'+esc(link.label)+'</a>';

export function printableStudyGuideHtml(guide, dictionary = () => '') {
  return renderClassroomStudyGuide(guide, dictionary);
}

/** Compact controls only. The existing Games controller owns every round and result. */
export function createMaterialsView({onChange,onRetry,onTest,onGuideRefresh,win=window} = {}) {
  let model = null, notesOpen = /(?:^|[?&])notes(?:=1)?(?:&|$)/.test(String(win?.location?.hash || '').split('?')[1] || ''), testsOpen = false, selectedTest = 0, notesSource = 'weekly', notesSubject = '';
  const readAloud = createReadAloud(win);
  let prepOpen = /(?:^|[?&])prep(?:=1)?(?:&|$)/.test(String(win?.location?.hash || '').split('?')[1] || '');
  const selection = () => ({source:'weekly',sources:['weekly']});
  const focus = selector => win.document.querySelector(selector)?.focus({preventScroll:true});
  const change = selector => { onChange?.(); if (selector) focus(selector); };
  // Opening a guide must never launch the OS print sheet.
  async function openGuide(index, upcoming = false, trigger = null) {
    const requestedKey = model?.testGuide?.(index,{upcoming})?.key;
    if (!requestedKey) return;
    let current = true;
    if (onGuideRefresh) {
      if (trigger) trigger.disabled = true;
      try { current = (await onGuideRefresh()) !== false; }
      catch { current = false; }
      finally { if (trigger?.isConnected) trigger.disabled = false; }
    }
    const currentTests = upcoming ? model?.upcomingTests?.().tests : model?.printableTests?.().tests;
    const matchingIndex = (currentTests || []).findIndex(test => test.date+'|'+test.label === requestedKey);
    if (matchingIndex < 0) return; // The announcement changed: never substitute another test.
    const freshGuide = model?.testGuide?.(matchingIndex,{upcoming});
    if (!freshGuide || freshGuide.key !== requestedKey) return;
    const guide = current ? freshGuide : {...freshGuide,warnings:[
      'Live curriculum could not be checked. This is the last saved study material; confirm the announced test topic before studying.',
      ...freshGuide.warnings,
    ].slice(0,3)};
    const doc = win.document;
    doc.querySelector('[data-study-guide-dialog]')?.close();
    const dialog = doc.createElement('dialog');
    dialog.className = 'study-guide-dialog';
    dialog.setAttribute('data-study-guide-dialog','');
    dialog.setAttribute('aria-labelledby','study-guide-modal-title');
    dialog.innerHTML = '<header class="study-guide-modal-bar"><button type="button" data-guide-close>Close</button><strong id="study-guide-modal-title">'+esc(guide.label || 'Study guide')+'</strong><button type="button" data-guide-print disabled>Print</button></header><iframe class="study-guide-frame" title="Study guide preview"></iframe>';
    const closeButton = dialog.querySelector('[data-guide-close]');
    const printButton = dialog.querySelector('[data-guide-print]');
    const frame = dialog.querySelector('.study-guide-frame');
    frame.addEventListener('load', () => { printButton.disabled = false; }, {once:true});
    frame.srcdoc = printableStudyGuideHtml(guide, term => win?.ABVMStudyGames?.vocabularyDefinition?.(term));
    closeButton.addEventListener('click', () => dialog.close());
    printButton.addEventListener('click', () => {
      try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch {}
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (trigger?.isConnected) trigger.focus({preventScroll:true});
    }, {once:true});
    doc.body.append(dialog);
    dialog.showModal();
    closeButton.focus({preventScroll:true});
  }

  const shortTestLabel = label => String(label||'').replace(/\s*\([^)]*\)/g,'').replace(/\s*\/\s*Handwriting/i,' & handwriting').trim();
  const testArt = subject => /math/i.test(subject)?'math':/religion/i.test(subject)?'religion':/spell|grammar|phonic|handwriting/i.test(subject)?'spelling':'reading';
  function priorityHtml({loading=true} = {}) {
    const tests=model?.upcomingTests?.()||model?.printableTests?.(),pending=tests?.tests||[],missing=tests?.missing||[],fallback=tests?.fallback||[];
    if(!prepOpen){
      const next=pending[0];
      return '<section class="study-priority"><button type="button" class="study-prep-launch" data-open-prep aria-label="Test Prep"><span class="prep-launch-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4h10a2 2 0 0 1 2 2v15H5V6a2 2 0 0 1 2-2ZM8 2v4M16 2v4M8 10h8M8 14h5"/></svg></span><span><strong>Test Prep</strong><small>'+esc(next?next.label+' · '+dateLabel(next.date):!model&&loading?'Checking upcoming tests…':'See what’s coming up')+'</small></span><b aria-hidden="true">›</b></button></section>';
    }
    const header='<header class="prep-header"><button type="button" class="prep-back" data-close-prep aria-label="Back to subjects"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>Study</button><img class="prep-seal" src="./assets/abvm-app-icon-192.png" width="44" height="44" alt="Assumption BVM Catholic School logo"><h1 tabindex="-1">Get ready with<br><span>confidence.</span></h1><p>A little practice. More confidence.</p><img class="prep-eagle" src="./assets/illustrations/eagle.webp" alt="" width="160" height="160"></header>';
    if(!model&&loading)return header+'<section class="prep-sheet"><h2>Checking upcoming tests…</h2><p role="status">Getting your practice ready.</p></section>';
    if(!pending.length)return header+'<section class="prep-sheet"><h2>No upcoming test is listed</h2><p>Choose a subject and keep learning.</p><button type="button" class="prep-start" data-close-prep>Choose a subject</button>'+testStatus(tests)+'</section>';
    if(selectedTest>=pending.length)selectedTest=0;
    const chosen=pending[selectedTest],entry=(tests.supported||[]).find(test=>test.index===selectedTest),preview=model?.testPreview?.(selectedTest),art=testArt(chosen.subject||chosen.label);
    const history=preview?(preview.total?preview.practice.label:'No verified practice yet'):'Practice';
    const choices=pending.map((test,index)=>'<button type="button" class="prep-test-choice" data-test-select="'+index+'" aria-pressed="'+(index===selectedTest)+'" aria-label="'+esc(test.label+' - '+dateLabel(test.date))+'"><img src="./assets/illustrations/'+testArt(test.subject||test.label)+'.webp" width="40" height="40" alt=""><span><strong>'+esc(shortTestLabel(test.label))+'</strong><small>'+esc(dateLabel(test.date))+'</small></span><b aria-hidden="true">'+(index===selectedTest?'✓':'')+'</b></button>').join('');
    const topics=preview?.topics?.length?list(preview.topics):'<p class="prep-no-topics">Topics will appear when matching practice is verified.</p>';
    return header+'<section class="prep-sheet" aria-labelledby="study-priority-title"><h2 id="study-priority-title">Choose a test to prepare for</h2><div class="prep-test-choices" role="group" aria-label="Upcoming tests">'+choices+'</div><article class="prep-topic-card" data-study-tests><div class="prep-topic-heading"><p>'+esc(chosen.subject||'Test Prep')+'</p><span>'+esc(!entry?'Practice unavailable':fallback.some(test=>test.index===selectedTest)?'Grade 2 skill practice':'Verified test practice')+'</span></div><h3>'+esc(chosen.label)+'</h3><time datetime="'+esc(chosen.date)+'">'+esc(dateLabel(chosen.date))+'</time><div class="prep-topics"><div><p>Topics in this practice</p>'+topics+'</div><img src="./assets/illustrations/'+art+'.webp" alt="" width="150" height="150"></div><small class="study-test-history" aria-label="'+esc(history+'. Practice does not predict a test result.')+'">'+esc(history)+'</small>'+ (missing.some(test=>test.index===selectedTest)?'<p class="game-material-status" data-test-missing>No verified questions match this test yet. Use the teacher materials; the app will not guess.</p>':'')+(fallback.some(test=>test.index===selectedTest)?'<p class="game-material-status" data-test-fallback>Using original Grade 2 skill practice because no reviewed test-specific questions are available.</p>':'')+'</article><button type="button" class="prep-start" aria-label="Start test prep" data-test-single="'+selectedTest+'"'+(!entry?' disabled aria-disabled="true"':'')+'>Start '+(preview?.total||'')+' questions <span aria-hidden="true">→</span></button><button type="button" class="prep-guide" data-test-guide="'+selectedTest+'" data-guide-upcoming="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5"/></svg>View study guide</button>'+testStatus(tests)+'</section>';
  }
  function testStatus(tests){return tests?.message?'<div class="game-test-status" role="status"><span>'+esc(tests.message)+'</span>'+(tests.canUndo?'<button type="button" data-undo-test>Undo</button>':'')+'</div>':'';}

  function statusHtml({loading=true,error=false} = {}) {
    const partial=model?.status?.partial;
    if(error)return '<div class="game-material-status study-load-status" role="status"><p>Saved materials could not load. Current practice still works.</p><button type="button" data-study-retry>Retry saved materials</button></div>';
    if(!model&&loading)return '<p class="game-material-status study-load-status" role="status">Loading saved materials…</p>';
    if(partial)return '<div class="game-material-status study-load-status" role="status"><p>Some saved materials could not load. Available practice still works.</p><button type="button" data-study-retry>Retry saved materials</button></div>';
    return '';
  }

  function notesContent() {
    const data=model?.notes(notesSource);
    if(!data)return '<p class="game-material-status">Notes are still loading.</p>';
    const lessons=data.lessons||[],notes=(data.notes||[]).filter(row=>nonempty(row.text)),vocabulary=(data.vocabulary||[]).filter(row=>nonempty(row.term));
    const links=(data.links||[]).filter(link=>safeUrl(link.url)),warnings=data.warnings||[];
    const wordSubject=row=>nonempty(row.subject)?row.subject:'Words to know';
    const subjects=[...new Set([...notes,...links,...warnings,...lessons,...vocabulary.map(row=>({subject:wordSubject(row)}))].map(row=>row.subject).filter(nonempty))];
    if(!subjects.includes(notesSubject))notesSubject=subjects[0]||'';
    const subjectButtons=subjects.map((subject,index)=>'<button type="button" data-notes-subject="'+index+'" aria-pressed="'+(subject===notesSubject)+'" aria-controls="study-notes-panel-'+index+'">'+esc(subject)+'</button>').join('');
    const noteRows=subjects.map((subject,index)=>{
      const subjectNotes=notes.filter(row=>row.subject===subject),original=distinctNoteText(subjectNotes.map(row=>row.text));
      const topics=subjectNotes.filter(row=>row.kind==='topic'),review=distinctNoteText(subjectNotes.filter(row=>row.kind!=='topic').map(row=>row.text));
      // Group only by an explicit source prefix. No inferred chapter, skill, or date associations.
      const groups=new Map();
      for(const text of distinctNoteText(topics.map(row=>row.text))){
        const prefix=text.match(/^\s*([^:]{1,45}):\s*(.+)$/),label=prefix?prefix[1]:'Class topics';
        if(!groups.has(label))groups.set(label,[]);groups.get(label).push(text);
      }
      const topicHtml=[...groups].map(([label,rows],groupIndex)=>'<details class="study-note-topic"'+(groupIndex===0?' open':'')+'><summary><strong>'+esc(label==='Story'?'Stories':label)+'</strong><small>'+rows.length+' '+(rows.length===1?'topic':'topics')+'</small></summary><div class="study-note-body">'+list(rows)+'</div></details>').join('');
      const reviewHtml=review.length?'<details class="study-note-review"><summary><strong>Practice ideas</strong><small>'+review.length+' '+(review.length===1?'idea':'ideas')+'</small></summary><div class="study-note-review-body"><p>Choose one idea to review.</p>'+review.map(text=>{
        const words=text.trim().split(/\s+/),title=words.slice(0,9).join(' ')+(words.length>9?'…':'');
        return '<details class="study-note-point"><summary>'+esc(title)+'</summary><div class="study-note-body"><p>'+esc(text)+'</p></div></details>';
      }).join('')+'</div></details>':'';
      const saved=lessons.filter(lesson=>lesson.subject===subject);
      const lessonRows=saved.length?'<section class="study-note-schoolwork"><h4>Saved schoolwork</h4>'+saved.map(lesson=>'<details class="game-material-lesson"><summary><span>'+esc(lesson.title)+'</span><small>'+esc(lesson.studiedOn?dateLabel(lesson.studiedOn):'Undated schoolwork')+'</small></summary><div class="study-note-body">'+list(lesson.notes||[])+'</div></details>').join('')+'</section>':'';
      const subjectWords=vocabulary.filter(row=>wordSubject(row)===subject);
      const wordsHtml=subjectWords.length?'<details class="game-material-lesson study-vocabulary"><summary><span>Words to know</span><small>'+subjectWords.length+' words</small></summary><div class="study-note-body"><dl>'+subjectWords.map(row=>{const meaning=resolveVocabularyMeaning(row,term=>win?.ABVMStudyGames?.vocabularyDefinition?.(term));return '<div><dt>'+esc(row.term)+'</dt>'+(meaning?'<dd>'+esc(meaning)+'</dd>':'')+'</div>';}).join('')+'</dl></div></details>':'';
      const sourceHtml=original.length?'<details class="study-notes-original"><summary>Original class notes <small>Full wording, in source order</small></summary><div class="study-note-body">'+list(original)+'</div></details>':'';
      return '<section class="study-note-panel" id="study-notes-panel-'+index+'" data-note-subject="'+esc(subject)+'"'+(subject!==notesSubject?' hidden':'')+' aria-labelledby="study-notes-title-'+index+'"><header class="study-note-heading"><small>'+esc(notesSource==='weekly'?'This week’s class notes':'Current notes & saved learning')+'</small><h3 id="study-notes-title-'+index+'">'+esc(subject)+'</h3></header>'+
        warnings.filter(row=>row.subject===subject).map(row=>'<p class="game-note-warning">'+esc(row.text)+'</p>').join('')+
        '<div class="study-note-topic-grid">'+topicHtml+'</div>'+wordsHtml+reviewHtml+lessonRows+sourceHtml+
        '<div class="study-note-references">'+links.filter(row=>row.subject===subject).map(referenceHtml).join('')+'</div></section>';
    }).join('');
    return '<div class="study-note-scope" role="group" aria-label="Notes to review">'+['weekly','saved'].map(key=>'<button type="button" data-notes-source="'+key+'" aria-pressed="'+(notesSource===key)+'">'+(key==='weekly'?'This week':'All learning')+'</button>').join('')+'</div>'+ (notesSource==='saved'?'<p class="game-material-status">Undated schoolwork stays in All my learning, not This week.</p>':'')+
      '<div class="study-note-subjects" role="group" aria-label="Choose a subject">'+subjectButtons+'</div><div class="study-notes-grid">'+(noteRows||'<p class="study-tools-empty">No lesson notes are included in this selection.</p>')+'</div>';
  }

  function secondaryHtml() {
    const tests=model?.tests(),pending=tests?.tests||[],completed=tests?.completed||[];
    const printable=(model?.printableTests?.()?.tests||pending).map((test,index)=>({...test,index}));
    const guideButtons=printable.map(test=>'<button type="button" class="study-guide-button" data-test-guide="'+test.index+'">View guide: '+esc(test.label)+' · '+esc(dateLabel(test.date))+'</button>').join('');
    return '<section class="study-tools" aria-labelledby="study-tools-title"><div class="study-section-heading compact"><span>KEEP LEARNING</span><h2 id="study-tools-title">A little extra help</h2></div><div class="study-tool-list">' +
      '<details class="study-tool-card" data-study-notes'+(notesOpen?' open':'')+'><summary><span class="study-tool-icon notes" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg></span><span class="study-tool-copy"><strong>Notes &amp; study guides</strong><small>Class notes, words &amp; official reviews</small></span><b aria-hidden="true">›</b></summary><div class="study-tool-body" data-study-notes-content>'+(notesOpen?notesContent():'')+'</div></details>' +
      '<details class="study-tool-card" data-study-test-options'+(testsOpen?' open':'')+'><summary><span class="study-tool-icon tests" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4h10a2 2 0 0 1 2 2v15H5V6a2 2 0 0 1 2-2ZM8 2v4M16 2v4M8 10h8M8 14h5"/></svg></span><span class="study-tool-copy"><strong>Test guides &amp; history</strong><small>Print a guide or manage finished tests</small></span><b aria-hidden="true">›</b></summary><div class="study-tool-body"><p>Finished tests are hidden only on this browser.</p>' +
      (printable.length?'<h3>Printable study guides</h3><div class="study-guide-tool-list">'+guideButtons+'</div>':'')+
      (pending.length?'<h3>Test list</h3><button type="button" data-complete-test>'+(pending.length>1?'Mark current tests finished':'Mark test finished')+'</button>':'')+
      (completed.length?'<h3>Hidden tests</h3>'+completed.map(test=>'<button type="button" data-restore-test="'+esc(test.key)+'">Restore '+esc(test.label)+'</button>').join(''):'')+
      (!printable.length&&!pending.length&&!completed.length?'<p>No tests to manage.</p>':'')+'</div></details></div></section>';
  }

  function homeHtml({gameGrid='',complete=false,loading=true,error=false} = {}) {
    return (prepOpen?priorityHtml({loading}):'<div class="study-launch-layout">'+priorityHtml({loading}) +
      '<section class="study-game-section" aria-labelledby="study-game-section-title"><div class="study-section-heading"><h2 id="study-game-section-title">Choose your subject</h2></div>'+gameGrid+'</section></div>') + statusHtml({loading,error}) + secondaryHtml() +
      '<p class="game-privacy-note">Current classwork comes first, followed by earlier learning and original Grade 2 STAR-style practice. Private answers and grades are not published. STAR-style practice uses original questions.</p>';
  }

  function bind(host) {
    host.querySelector('[data-open-prep]')?.addEventListener('click',()=>{prepOpen=true;change('.prep-header h1');win.document.querySelector('.games-screen')?.scrollTo(0,0);});
    host.querySelectorAll('[data-close-prep]').forEach(button=>button.addEventListener('click',()=>{prepOpen=false;change('[data-open-prep]');win.document.querySelector('.games-screen')?.scrollTo(0,0);}));
    host.querySelectorAll('[data-test-select]').forEach(button=>button.addEventListener('click',()=>{
      const next=Number(button.dataset.testSelect);if(!Number.isInteger(next)||next<0)return;
      selectedTest=next;change('[data-test-select="'+next+'"]');
      const selected=win.document.querySelector('[data-test-select="'+next+'"]'),rail=selected?.parentElement;if(rail)rail.scrollLeft=selected.offsetLeft-rail.offsetLeft;
    }));
    const notes=host.querySelector('[data-study-notes]');
    const refreshNotes=async()=>{
      notesOpen=notes.open;if(!notesOpen)return;
      const owner=model,scope=notesSource,body=notes.querySelector('[data-study-notes-content]');if(!body.hasChildNodes())body.innerHTML=notesContent();
      try{await owner?.loadReferences?.();}catch{}
      if(model!==owner||scope!==notesSource||!notes.isConnected||!notes.open)return;
      const available=(owner?.notes(notesSource).links||[]).filter(link=>safeUrl(link.url));
      const subjects=[...body.querySelectorAll('[data-note-subject]')];
      if(available.some(link=>!subjects.some(row=>row.dataset.noteSubject===link.subject))){body.innerHTML=notesContent();return;}
      for(const subject of subjects){
        const referenceBody=subject.querySelector('.study-note-references');
        if(referenceBody)referenceBody.innerHTML=available.filter(link=>link.subject===subject.dataset.noteSubject).map(referenceHtml).join('');
      }
    };
    notes?.addEventListener('click',event=>{
      const scope=event.target.closest('[data-notes-source]');
      if(scope){notesSource=scope.dataset.notesSource==='saved'?'saved':'weekly';change('[data-notes-source="'+notesSource+'"]');return;}
      const button=event.target.closest('[data-notes-subject]');if(!button)return;
      const panel=notes.querySelector('#'+button.getAttribute('aria-controls'));if(!panel)return;
      notesSubject=panel.dataset.noteSubject;
      notes.querySelectorAll('[data-notes-subject]').forEach(row=>row.setAttribute('aria-pressed',String(row===button)));
      notes.querySelectorAll('[data-note-subject]').forEach(row=>{row.hidden=row!==panel;});
    });
    notes?.addEventListener('toggle',refreshNotes);
    if(notes?.open)refreshNotes();
    host.querySelector('[data-study-test-options]')?.addEventListener('toggle',event=>{testsOpen=event.currentTarget.open;});
    host.querySelector('[data-test]')?.addEventListener('click',async()=>{
      try{await onGuideRefresh?.();}catch{}
      onTest?.();
    });
    host.querySelectorAll('[data-test-single]').forEach(button=>button.addEventListener('click',async()=>{
      const original = model?.upcomingTests?.().tests[Number(button.dataset.testSingle)];
      if(!original)return;
      try{await onGuideRefresh?.();}catch{}
      const key=original.date+'|'+original.label;
      const current=(model?.upcomingTests?.().tests||[]).findIndex(test=>test.date+'|'+test.label===key);
      if(current>=0)onTest?.(current);
    }));
    host.querySelectorAll('[data-test-guide]').forEach(button=>button.addEventListener('click',()=>openGuide(Number(button.dataset.testGuide),button.dataset.guideUpcoming==='true',button)));
    host.querySelector('[data-study-retry]')?.addEventListener('click',()=>onRetry?.());
    host.querySelector('[data-complete-test]')?.addEventListener('click',()=>{
      const result = model?.completeTests(); change(result?.ok?'[data-undo-test]':'[data-complete-test]');
    });
    host.querySelector('[data-undo-test]')?.addEventListener('click',()=>{
      model?.undoTests(); change('[data-test],[data-test-single],[data-complete-test]');
    });
    host.querySelectorAll('[data-restore-test]').forEach(button=>button.addEventListener('click',()=>{
      model?.restoreTest(button.dataset.restoreTest); change('[data-test],[data-test-single],[data-complete-test]');
    }));
  }

  return {isPrep(){return prepOpen;},openNotes(){notesOpen=true;change('[data-study-notes] > summary');},selection,priorityHtml,statusHtml,homeHtml,secondaryHtml,bind,readAloud,setModel(value){model=value;}};
}
