import {createNotesLibrary} from './study-notes-library.mjs?v=4';
import {createReadAloud} from './study-room-view.mjs';
import {renderTestStudyGuide,renderTestWorksheet} from './test-study-pair.mjs?v=4';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nonempty = value => typeof value === 'string' && value.trim();
const list = rows => {const clean=(Array.isArray(rows)?rows:[]).filter(nonempty);return clean.length?'<ul>'+clean.map(row=>'<li>'+esc(row)+'</li>').join('')+'</ul>':'';};
const dateLabel = date => {const value=new Date(date+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(date||'')&&Number.isFinite(value.getTime())
  ? new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}).format(value) : '';};
const missingDefinition = value => /teacher page does not provide a definition|no definition supplied/i.test(String(value ?? ''));
export function resolveVocabularyMeaning(row,dictionary = () => '') {
  const supplied = nonempty(row?.meaning) ? String(row.meaning).trim() : '';
  if (supplied && !missingDefinition(supplied)) return supplied;
  const resolved = dictionary(row?.term);
  return nonempty(resolved) ? String(resolved).trim() : '';
}

export function printableStudyGuideHtml(guide, dictionary = () => '') {
  return renderTestStudyGuide(guide, dictionary);
}
export function printableWorksheetHtml(guide, dictionary = () => '') {
  return renderTestWorksheet(guide, dictionary);
}

/** Compact controls only. The existing Games controller owns every round and result. */
export function createMaterialsView({onChange,onRetry,onTest,onGuideRefresh,win=window} = {}) {
  let model = null, notesOpen = /(?:^|[?&])notes(?:=1)?(?:&|$)/.test(String(win?.location?.hash || '').split('?')[1] || ''), testsOpen = false, selectedTest = 0;
  const readAloud = createReadAloud(win);
  const notesLibrary=createNotesLibrary({getModel:()=>model,win,meaning:row=>resolveVocabularyMeaning(row,term=>win?.ABVMStudyGames?.vocabularyDefinition?.(term))});
  let prepOpen = /(?:^|[?&])prep(?:=1)?(?:&|$)/.test(String(win?.location?.hash || '').split('?')[1] || '');
  const selection = () => ({source:'weekly',sources:['weekly']});
  const focus = selector => win.document.querySelector(selector)?.focus({preventScroll:true});
  const change = selector => { onChange?.(); if (selector) focus(selector); };
  // Opening a guide must never launch the OS print sheet.
  async function openGuide(index, upcoming = false, trigger = null, kind = 'guide') {
    const requestedKey = trigger?.dataset.testKey || model?.testGuide?.(index,{upcoming})?.key;
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
    if (matchingIndex < 0) { change('.prep-header h1'); return; } // Never substitute another test.
    const freshGuide = model?.testGuide?.(matchingIndex,{upcoming});
    if (!freshGuide || freshGuide.key !== requestedKey) return;
    const guide = current ? freshGuide : {...freshGuide,warnings:[
      'Live curriculum could not be checked. This is the last saved study material; confirm the announced test topic before studying.',
      ...freshGuide.warnings,
    ].slice(0,3)};
    const isWorksheet = kind === 'worksheet';
    const doc = win.document;
    doc.querySelector('[data-study-guide-dialog]')?.close();
    const dialog = doc.createElement('dialog');
    dialog.className = 'study-guide-dialog';
    dialog.setAttribute('data-study-guide-dialog','');
    dialog.setAttribute('aria-labelledby','study-guide-modal-title');
    dialog.innerHTML = '<header class="study-guide-modal-bar"><button type="button" data-guide-close>Close</button><strong id="study-guide-modal-title">'+esc((isWorksheet?'Worksheet: ':'Study guide: ')+(guide.label || 'Upcoming test'))+'</strong><button type="button" data-guide-print disabled>Print</button></header><iframe class="study-guide-frame" title="'+(isWorksheet?'Practice worksheet':'Study guide')+' preview"></iframe>';
    const closeButton = dialog.querySelector('[data-guide-close]');
    const printButton = dialog.querySelector('[data-guide-print]');
    const frame = dialog.querySelector('.study-guide-frame');
    frame.addEventListener('load', () => { printButton.disabled = false; }, {once:true});
    const createSheet = isWorksheet ? printableWorksheetHtml : printableStudyGuideHtml;
    frame.srcdoc = createSheet(guide, term => win?.ABVMStudyGames?.vocabularyDefinition?.(term));
    closeButton.addEventListener('click', () => dialog.close());
    printButton.addEventListener('click', () => {
      try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch {}
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (trigger?.isConnected) trigger.focus({preventScroll:true});
      else focus('.games-screen h1');
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
    const choices=pending.map((test,index)=>'<button type="button" class="prep-test-choice" data-test-select="'+index+'" data-test-key="'+esc(test.date+'|'+test.label)+'" aria-pressed="'+(index===selectedTest)+'" aria-label="'+esc(test.label+' - '+dateLabel(test.date))+'"><img src="./assets/illustrations/'+testArt(test.subject||test.label)+'.webp" width="40" height="40" alt=""><span><strong>'+esc(shortTestLabel(test.label))+'</strong><small>'+esc(dateLabel(test.date))+'</small></span><b aria-hidden="true">'+(index===selectedTest?'✓':'')+'</b></button>').join('');
    const topics=preview?.topics?.length?list(preview.topics):'<p class="prep-no-topics">Topics will appear when matching practice is verified.</p>';
    return header+'<section class="prep-sheet" aria-labelledby="study-priority-title"><h2 id="study-priority-title">Ready for your test?</h2><article class="prep-topic-card" data-study-tests><div class="prep-topic-heading"><p>'+esc(chosen.subject||'Test Prep')+'</p><span>'+esc(!entry?'Practice unavailable':fallback.some(test=>test.index===selectedTest)?'Grade 2 skill practice':'Verified test practice')+'</span></div><h3>'+esc(chosen.label)+'</h3><time datetime="'+esc(chosen.date)+'">'+esc(dateLabel(chosen.date))+'</time><button type="button" class="prep-jump-tests" data-jump-tests>Change test ↓</button><div class="prep-topics"><div><p>Topics in this practice</p>'+topics+'</div><img src="./assets/illustrations/'+art+'.webp" alt="" width="150" height="150"></div><small class="study-test-history" aria-label="'+esc(history+'. Practice does not predict a test result.')+'">'+esc(history)+'</small>'+ (missing.some(test=>test.index===selectedTest)?'<p class="game-material-status" data-test-missing>No verified questions match this test yet. Use the teacher materials; the app will not guess.</p>':'')+(fallback.some(test=>test.index===selectedTest)?'<p class="game-material-status" data-test-fallback>Using original Grade 2 skill practice because no reviewed test-specific questions are available.</p>':'')+'</article><button type="button" class="prep-start" aria-label="Start test prep" data-test-single="'+selectedTest+'" data-test-key="'+esc(chosen.date+'|'+chosen.label)+'"'+(!entry?' disabled aria-disabled="true"':'')+'>Start '+(preview?.total||'')+' questions <span aria-hidden="true">→</span></button><div class="prep-material-actions" role="group" aria-label="Printable test materials"><button type="button" class="prep-guide" data-test-guide="'+selectedTest+'" data-guide-upcoming="true" data-test-key="'+esc(chosen.date+'|'+chosen.label)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5"/></svg>Study guide</button><button type="button" class="prep-guide prep-worksheet" data-test-worksheet="'+selectedTest+'" data-guide-upcoming="true" data-test-key="'+esc(chosen.date+'|'+chosen.label)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7"/></svg>Practice worksheet</button></div><section class="prep-chooser-panel" aria-labelledby="prep-chooser-title"><h3 id="prep-chooser-title">Choose another test</h3><div class="prep-test-choices" role="group" aria-label="Upcoming tests">'+choices+'</div></section>'+testStatus(tests)+'</section>';
  }
  function testStatus(tests){return tests?.message?'<div class="game-test-status" role="status"><span>'+esc(tests.message)+'</span>'+(tests.canUndo?'<button type="button" data-undo-test>Undo</button>':'')+'</div>':'';}

  function statusHtml({loading=true,error=false} = {}) {
    const partial=model?.status?.partial;
    if(error)return '<div class="game-material-status study-load-status" role="status"><p>Saved materials could not load. Current practice still works.</p><button type="button" data-study-retry>Retry saved materials</button></div>';
    if(!model&&loading)return '<p class="game-material-status study-load-status" role="status">Loading saved materials…</p>';
    if(partial)return '<div class="game-material-status study-load-status" role="status"><p>Some saved materials could not load. Available practice still works.</p><button type="button" data-study-retry>Retry saved materials</button></div>';
    return '';
  }

  const notesContent=()=>notesLibrary.html();

  function secondaryHtml() {
    const tests=model?.tests(),pending=tests?.tests||[],completed=tests?.completed||[];
    const printable=(model?.printableTests?.()?.tests||pending).map((test,index)=>({...test,index}));
    const guideButtons=printable.map(test=>'<article class="study-material-pair"><div class="study-material-pair-heading"><strong>'+esc(test.label)+'</strong><small>'+esc(dateLabel(test.date))+'</small></div><div class="study-material-pair-buttons"><button type="button" class="study-guide-button" data-test-guide="'+test.index+'" data-test-key="'+esc(test.date+'|'+test.label)+'">Study guide</button><button type="button" class="study-guide-button" data-test-worksheet="'+test.index+'" data-test-key="'+esc(test.date+'|'+test.label)+'">Practice worksheet</button></div></article>').join('');
    return '<section class="study-tools" aria-labelledby="study-tools-title"><div class="study-section-heading compact"><span>KEEP LEARNING</span><h2 id="study-tools-title">A little extra help</h2></div><div class="study-tool-list">' +
      '<details class="study-tool-card" data-study-notes'+(notesOpen?' open':'')+'><summary><span class="study-tool-icon notes" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg></span><span class="study-tool-copy"><strong>Notes &amp; study guides</strong><small>Class notes, words &amp; official reviews</small></span><b aria-hidden="true">›</b></summary><div class="study-tool-body" data-study-notes-content>'+(notesOpen?notesContent():'')+'</div></details>' +
      '<details class="study-tool-card" data-study-test-options'+(testsOpen?' open':'')+'><summary><span class="study-tool-icon tests" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4h10a2 2 0 0 1 2 2v15H5V6a2 2 0 0 1 2-2ZM8 2v4M16 2v4M8 10h8M8 14h5"/></svg></span><span class="study-tool-copy"><strong>Guides, worksheets &amp; history</strong><small>Find materials for each test</small></span><b aria-hidden="true">›</b></summary><div class="study-tool-body">' +
      (printable.length?'<section class="study-material-upcoming" aria-label="Materials by test"><h3>Study materials by test</h3><div class="study-guide-tool-list">'+guideButtons+'</div></section>':'')+
      (pending.length||completed.length?'<details class="study-test-history"><summary>Test status &amp; history</summary><div class="study-test-history-body"><p>Finished tests are hidden only on this browser. You can restore them here.</p>'+
      (pending.length?'<h3>Current test list</h3><button type="button" data-complete-test>'+(pending.length>1?'Mark current tests finished':'Mark test finished')+'</button>':'')+
      (completed.length?'<h3>Finished tests</h3>'+completed.map(test=>'<button type="button" data-restore-test="'+esc(test.key)+'">Restore '+esc(test.label)+'</button>').join(''):'')+
      '</div></details>':'')+
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
    host.querySelector('[data-jump-tests]')?.addEventListener('click',()=>{const first=host.querySelector('.prep-chooser-panel [data-test-select]');first?.scrollIntoView({block:'center',behavior:'instant'});first?.focus({preventScroll:true});});
    host.querySelectorAll('[data-test-select]').forEach(button=>button.addEventListener('click',()=>{
      const next=(model?.upcomingTests?.().tests||[]).findIndex(test=>test.date+'|'+test.label===button.dataset.testKey);if(next<0){change('.prep-header h1');return;}
      selectedTest=next;change('[data-test-select="'+next+'"]');
      // The whole test grid is visible; no horizontal carousel offset is needed.
    }));
    const notes=host.querySelector('[data-study-notes]');
    notes?.addEventListener('toggle',()=>{notesOpen=notes.open;});
    notesLibrary.bind(notes);
    host.querySelector('[data-study-test-options]')?.addEventListener('toggle',event=>{testsOpen=event.currentTarget.open;});
    host.querySelector('[data-test]')?.addEventListener('click',async()=>{
      try{await onGuideRefresh?.();}catch{}
      onTest?.();
    });
    host.querySelectorAll('[data-test-single]').forEach(button=>button.addEventListener('click',async()=>{
      const original = (model?.upcomingTests?.().tests||[]).find(test=>test.date+'|'+test.label===button.dataset.testKey);
      if(!original){change('.prep-header h1');return;}
      try{await onGuideRefresh?.();}catch{}
      const key=original.date+'|'+original.label;
      const current=(model?.upcomingTests?.().tests||[]).findIndex(test=>test.date+'|'+test.label===key);
      if(current>=0)onTest?.(current);else change('.prep-header h1');
    }));
    host.querySelectorAll('[data-test-guide]').forEach(button=>button.addEventListener('click',()=>openGuide(Number(button.dataset.testGuide),button.dataset.guideUpcoming==='true',button)));
    host.querySelectorAll('[data-test-worksheet]').forEach(button=>button.addEventListener('click',()=>openGuide(Number(button.dataset.testWorksheet),button.dataset.guideUpcoming==='true',button,'worksheet')));
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
