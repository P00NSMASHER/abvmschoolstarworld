import {createReadAloud} from './study-room-view.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nonempty = value => typeof value === 'string' && value.trim();
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
  const facts = (guide?.facts || []).slice(0,6);
  const vocabulary = (guide?.vocabulary || []).slice(0,8).map(row => ({
    term:String(row?.term || '').trim(),
    meaning:resolveVocabularyMeaning(row,dictionary),
  })).filter(row => row.term);
  const practice = (guide?.practice || []).slice(0,4);
  const warnings = (guide?.warnings || []).slice(0,3);
  const factHtml = facts.length ? '<ul>' + facts.map(row=>'<li>'+esc(row)+'</li>').join('') + '</ul>' : '<p class="empty">No verified facts are available yet.</p>';
  const wordHtml = vocabulary.length ? '<dl>' + vocabulary.map(row=>'<div><dt>'+esc(row.term)+'</dt>'+(row.meaning?'<dd>'+esc(row.meaning)+'</dd>':'')+'</div>').join('') + '</dl>' : '<p class="empty">No test-specific vocabulary is listed.</p>';
  const checkHtml = practice.length ? '<ol>' + practice.map(row=>'<li>'+esc(row.prompt)+'</li>').join('') + '</ol>' : '<p class="empty">Use the teacher materials sent home for the quick check.</p>';
  const answerHtml = practice.length ? practice.map((row,index)=>'<span><b>'+(index+1)+'.</b> '+esc(row.answer)+'</span>').join('') : '<span>Teacher materials required.</span>';
  const warningHtml = warnings.length ? '<aside><strong>Coverage note</strong>' + warnings.map(row=>'<p>'+esc(row)+'</p>').join('') + '</aside>' : '';
  const date = dateLabel(guide?.date) || String(guide?.date || '');
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>'+esc(guide?.label || 'ABVM Study Guide')+'</title><style>' +
    '@page{size:Letter portrait;margin:.32in}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#1c2f45;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{font-size:10.25pt;line-height:1.28}.sheet{max-width:7.86in;margin:0 auto}.top{display:flex;justify-content:space-between;gap:.18in;align-items:flex-start;border-bottom:2px solid #244e76;padding:0 0 .12in}.brand{font-size:8.5pt;font-weight:800;letter-spacing:.08em;color:#526579}.top h1{margin:.025in 0 .02in;font-size:19pt;line-height:1.05;color:#183b5d}.meta{text-align:right;min-width:1.6in}.meta strong{display:block;font-size:11pt}.meta span{display:block;color:#526579;margin-top:2px}.grid{display:grid;grid-template-columns:1.14fr .86fr;gap:.12in;margin-top:.12in}.box{border:1px solid #cfdbe5;border-radius:10px;padding:.11in .12in;break-inside:avoid}.box h2{margin:0 0 .06in;font-size:11.5pt;color:#244e76}.box ul,.box ol{margin:.02in 0 0;padding-left:.2in}.box li{margin:0 0 .045in}.words dl{display:grid;grid-template-columns:1fr 1fr;gap:.045in .1in;margin:0}.words dl>div{break-inside:avoid}.words dt{font-weight:800}.words dd{margin:0;color:#425a70;font-size:9.2pt}.answers{display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;font-size:9.2pt}.plan ol{margin-bottom:0}.empty{margin:0;color:#6a7784;font-style:italic}aside{margin-top:.1in;padding:.08in .1in;border-left:4px solid #d1a44c;background:#fff8e9;font-size:8.8pt;line-height:1.25;break-inside:avoid}aside strong{color:#6e511a}aside p{margin:2px 0}.footer{display:flex;justify-content:space-between;gap:.1in;margin-top:.09in;padding-top:.07in;border-top:1px solid #d8e1e9;color:#607080;font-size:7.8pt}.footer span:last-child{text-align:right}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{width:100%}}@media screen{body{padding:20px;background:#eef3f7}.sheet{background:#fff;padding:.32in;box-shadow:0 8px 28px #0002}}' +
    '</style></head><body><main class="sheet"><header class="top"><div><div class="brand">ABVM · GRADE 2 · ONE-PAGE STUDY GUIDE</div><h1>'+esc(guide?.label || 'Upcoming test')+'</h1><span>'+esc(guide?.subject || 'Test review')+'</span></div><div class="meta"><strong>'+esc(date)+'</strong><span>Read · Recall · Check</span></div></header>' +
    warningHtml + '<div class="grid"><section class="box"><h2>What to know</h2>'+factHtml+'</section><section class="box words"><h2>Words to know</h2>'+wordHtml+'</section>' +
    '<section class="box"><h2>Quick check</h2>'+checkHtml+'</section><section class="box plan"><h2>3-step review</h2><ol><li>Read the key facts aloud.</li><li>Cover them and explain each one in your own words.</li><li>Answer the quick check, then use the key below.</li></ol></section>' +
    '<section class="box" style="grid-column:1/-1"><h2>Answer key</h2><div class="answers">'+answerHtml+'</div></section></div>' +
    '<footer class="footer"><span>'+esc(guide?.sourceLabel || 'ABVM reviewed study material')+'</span><span>Automatically generated for this test · Print at 100% scale</span></footer></main></body></html>';
}

/** Compact controls only. The existing Games controller owns every round and result. */
export function createMaterialsView({onChange,onRetry,onTest,win=window} = {}) {
  let model = null, notesOpen = /(?:^|[?&])notes(?:=1)?(?:&|$)/.test(String(win?.location?.hash || '').split('?')[1] || ''), testsOpen = false, selectedTest = 0, notesSource = 'weekly';
  const readAloud = createReadAloud(win);
  const selection = () => ({source:'weekly',sources:['weekly']});
  const focus = selector => win.document.querySelector(selector)?.focus({preventScroll:true});
  const change = selector => { onChange?.(); if (selector) focus(selector); };
  function printGuide(index) {
    const guide = model?.testGuide?.(index);
    if (!guide) return;
    const popup = win.open?.('','_blank');
    if (!popup?.document) return;
    popup.document.open();
    popup.document.write(printableStudyGuideHtml(guide,term=>win?.ABVMStudyGames?.vocabularyDefinition?.(term)));
    popup.document.close();
    const run = () => { try { popup.focus(); popup.print(); } catch {} };
    if (popup.document.readyState === 'complete') win.setTimeout(run,30);
    else popup.addEventListener('load',()=>win.setTimeout(run,30),{once:true});
  }

  function priorityHtml({loading=true} = {}) {
    const tests=model?.upcomingTests?.()||model?.printableTests?.(),pending=tests?.tests||[],missing=tests?.missing||[],fallback=tests?.fallback||[];
    if(!model&&loading){
      return '<section class="study-priority" aria-labelledby="study-priority-title"><div class="study-section-heading"><h2 id="study-priority-title">Test Prep</h2></div><div class="study-test-card is-loading" data-study-tests role="status"><div class="study-test-date" aria-hidden="true"><span>…</span><strong>–</strong><em>…</em></div><div class="study-test-copy"><small class="study-test-history">Checking practice…</small><strong>Checking tests…</strong><p class="study-test-topics" aria-hidden="true">Checking topics…</p></div><div class="study-test-actions"><label class="study-test-picker"><span class="study-test-picker-label">Loading upcoming tests</span><select disabled aria-label="Loading upcoming tests"><option>Loading tests…</option></select></label><button type="button" disabled>Loading practice…</button></div></div></section>';
    }
    if(!pending.length){
      return '<section class="study-priority" aria-labelledby="study-priority-title"><div class="study-section-heading"><h2 id="study-priority-title">Test Prep</h2></div><div class="study-test-card is-clear" data-study-tests><div class="study-test-mark" aria-hidden="true">✓</div><div class="study-test-copy"><strong>No upcoming test is listed</strong><p>Choose a subject below and keep learning.</p></div></div>' +
        (tests?.message?'<div class="game-test-status" role="status"><span>'+esc(tests.message)+'</span>'+(tests.canUndo?'<button type="button" data-undo-test>Undo</button>':'')+'</div>':'')+'</section>';
    }
    if(selectedTest>=pending.length)selectedTest=0;
    const chosen=pending[selectedTest],entry=(tests.supported||[]).find(test=>test.index===selectedTest),date=dateParts(chosen.date);
    const preview=model?.testPreview?.(selectedTest),history=preview?(preview.total?preview.practice.label:'No verified practice yet'):'COMING UP';
    const topics=preview?.topics?.length?'<p class="study-test-topics">'+preview.topics.map(topic=>'<span>'+esc(topic)+'</span>').join(' · ')+'</p>':'';
    const options=pending.map((test,index)=>'<option value="'+index+'"'+(index===selectedTest?' selected':'')+'>'+esc(test.label)+' - '+esc(dateLabel(test.date))+'</option>').join('');
    const practiceButtons='<label class="study-test-picker"><span class="study-test-picker-label">Choose a test</span><select data-test-select aria-label="Choose an upcoming test">'+options+'</select></label><button type="button" class="study-test-primary" data-test-single="'+selectedTest+'"'+(!entry?' disabled aria-disabled="true"':'')+'>Start test prep</button>';
    return '<section class="study-priority" aria-labelledby="study-priority-title"><div class="study-section-heading"><h2 id="study-priority-title">Test Prep</h2></div>' +
      '<article class="study-test-card" data-study-tests><time class="study-test-date" datetime="'+esc(chosen.date)+'"><span>'+esc(date.weekday)+'</span><strong>'+esc(date.day)+'</strong><em>'+esc(date.label.replace(/^\w+,\s*/,''))+'</em></time><div class="study-test-copy"><small class="study-test-history" aria-label="'+esc(preview?.practice?.plays?history+'. Includes hints and retries; practice does not predict a test result.':history)+'">'+esc(history)+'</small><h3>'+esc(chosen.label)+'</h3>'+topics+'</div><div class="study-test-actions">'+practiceButtons+'</div>' +
      (missing.some(test=>test.index===selectedTest)?'<p class="game-material-status" data-test-missing>No verified questions match this test yet. Use the teacher materials; the app will not guess.</p>':'') +
      (fallback.some(test=>test.index===selectedTest)?'<p class="game-material-status" data-test-fallback>Using original Grade 2 skill practice because no reviewed test-specific questions are available.</p>':'') +
      '</article>'+(tests?.message?'<div class="game-test-status" role="status"><span>'+esc(tests.message)+'</span>'+(tests.canUndo?'<button type="button" data-undo-test>Undo</button>':'')+'</div>':'')+'</section>';
  }

  function statusHtml({loading=true,error=false} = {}) {
    const partial=model?.status?.partial;
    if(error)return '<div class="game-material-status study-load-status" role="status"><p>Saved materials could not load. Current Games are still available.</p><button type="button" data-study-retry>Retry saved materials</button></div>';
    if(!model&&loading)return '<p class="game-material-status study-load-status" role="status">Loading saved materials…</p>';
    if(partial)return '<div class="game-material-status study-load-status" role="status"><p>Some saved materials could not load. Available practice still works.</p><button type="button" data-study-retry>Retry saved materials</button></div>';
    return '';
  }

  function notesContent() {
    const data=model?.notes(notesSource);
    if(!data)return '<p class="game-material-status">Notes are still loading.</p>';
    const lessons=data.lessons||[],notes=(data.notes||[]).filter(row=>nonempty(row.text)),vocabulary=(data.vocabulary||[]).filter(row=>nonempty(row.term));
    const links=(data.links||[]).filter(link=>safeUrl(link.url)),warnings=data.warnings||[];
    const subjects=[...new Set([...notes,...links,...warnings].map(row=>row.subject).filter(nonempty))];
    const lessonRows=lessons.map(lesson=>'<details class="game-material-lesson"><summary><span>'+esc(lesson.title)+'</span><small>'+esc(lesson.subject)+(lesson.studiedOn?' · '+esc(dateLabel(lesson.studiedOn)):'')+'</small></summary><div class="study-note-body">'+list(lesson.notes||[])+'</div></details>').join('');
    const noteRows=subjects.map(subject=>'<details class="game-material-lesson" data-note-subject="'+esc(subject)+'"><summary><span>'+esc(subject)+'</span><small>Class notes</small></summary><div class="study-note-body">'+
      list(notes.filter(row=>row.subject===subject).map(row=>row.text))+
      warnings.filter(row=>row.subject===subject).map(row=>'<p class="game-note-warning">'+esc(row.text)+'</p>').join('')+
      links.filter(row=>row.subject===subject).map(referenceHtml).join('')+'</div></details>').join('');
    const words=vocabulary.length?'<details class="game-material-lesson study-vocabulary"><summary><span>Words to know</span><small>'+vocabulary.length+' word'+(vocabulary.length===1?'':'s')+'</small></summary><div class="study-note-body"><dl>'+vocabulary.map(row=>{const meaning=resolveVocabularyMeaning(row,term=>win?.ABVMStudyGames?.vocabularyDefinition?.(term));return '<div><dt>'+esc(row.term)+'</dt>'+(meaning?'<dd>'+esc(meaning)+'</dd>':'')+'</div>';}).join('')+'</dl></div></details>':'';
    const body=lessonRows+noteRows+words;
    return '<div class="study-note-scope" role="group" aria-label="Notes to review">'+['weekly','saved'].map(key=>'<button type="button" data-notes-source="'+key+'" aria-pressed="'+(notesSource===key)+'">'+(key==='weekly'?'This week':'All learning')+'</button>').join('')+'</div>'+ (notesSource==='saved'?'<p class="game-material-status">Undated schoolwork stays in All my learning, not This week.</p>':'')+
      '<div class="study-notes-grid">'+(body||'<p class="study-tools-empty">No lesson notes are included in this selection.</p>')+'</div>';
  }

  function secondaryHtml() {
    const tests=model?.tests(),pending=tests?.tests||[],completed=tests?.completed||[];
    const printable=(model?.printableTests?.()?.tests||pending).map((test,index)=>({...test,index}));
    const guideButtons=printable.map(test=>'<button type="button" class="study-guide-button" data-test-guide="'+test.index+'">Print guide: '+esc(test.label)+' · '+esc(dateLabel(test.date))+'</button>').join('');
    return '<section class="study-tools" aria-labelledby="study-tools-title"><div class="study-section-heading compact"><span>KEEP LEARNING</span><h2 id="study-tools-title">A little extra help</h2></div><div class="study-tool-list">' +
      '<details class="study-tool-card" data-study-notes'+(notesOpen?' open':'')+'><summary><span class="study-tool-icon notes" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg></span><span class="study-tool-copy"><strong>Notes &amp; lessons</strong><small>Subjects, vocabulary, and reviewed links</small></span><b aria-hidden="true">›</b></summary><div class="study-tool-body" data-study-notes-content>'+(notesOpen?notesContent():'')+'</div></details>' +
      '<details class="study-tool-card" data-study-test-options'+(testsOpen?' open':'')+'><summary><span class="study-tool-icon tests" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4h10a2 2 0 0 1 2 2v15H5V6a2 2 0 0 1 2-2ZM8 2v4M16 2v4M8 10h8M8 14h5"/></svg></span><span class="study-tool-copy"><strong>Test guides &amp; history</strong><small>Print a guide or manage finished tests</small></span><b aria-hidden="true">›</b></summary><div class="study-tool-body"><p>Finished tests are hidden only on this browser.</p>' +
      (printable.length?'<h3>Printable study guides</h3><div class="study-guide-tool-list">'+guideButtons+'</div>':'')+
      (pending.length?'<h3>Test list</h3><button type="button" data-complete-test>'+(pending.length>1?'Mark current tests finished':'Mark test finished')+'</button>':'')+
      (completed.length?'<h3>Hidden tests</h3>'+completed.map(test=>'<button type="button" data-restore-test="'+esc(test.key)+'">Restore '+esc(test.label)+'</button>').join(''):'')+
      (!printable.length&&!pending.length&&!completed.length?'<p>No tests to manage.</p>':'')+'</div></details></div></section>';
  }

  function homeHtml({gameGrid='',complete=false,loading=true,error=false} = {}) {
    return '<div class="study-launch-layout">'+priorityHtml({loading}) +
      '<section class="study-game-section" aria-labelledby="study-game-section-title"><div class="study-section-heading"><h2 id="study-game-section-title">Choose your subject</h2></div>'+gameGrid+'</section></div>' + statusHtml({loading,error}) +
      secondaryHtml() +
      '<p class="game-privacy-note">Current classwork comes first, followed by earlier learning and original Grade 2 STAR-style practice. Private answers and grades are not published. STAR-style practice uses original questions.</p>';
  }

  function bind(host) {
    host.querySelector('[data-test-select]')?.addEventListener('change',event=>{
      const next=Number(event.target.value);if(!Number.isInteger(next)||next<0)return;
      selectedTest=next;change('[data-test-select]');
    });
    const notes=host.querySelector('[data-study-notes]');
    const refreshNotes=async()=>{
      notesOpen=notes.open;if(!notesOpen)return;
      const owner=model,body=notes.querySelector('[data-study-notes-content]');if(!body.hasChildNodes())body.innerHTML=notesContent();
      try{await owner?.loadReferences?.();}catch{}
      if(model!==owner||!notes.isConnected||!notes.open)return;
      for(const link of owner?.notes(notesSource).links||[]){
        if(!safeUrl(link.url))continue;
        let subject=[...body.querySelectorAll('[data-note-subject]')].find(row=>row.dataset.noteSubject===link.subject);
        if(!subject){
          subject=win.document.createElement('details');
          subject.className='game-material-lesson';
          subject.dataset.noteSubject=link.subject;
          subject.innerHTML='<summary><span>'+esc(link.subject)+'</span><small>Reviewed link</small></summary><div class="study-note-body"></div>';
          body.append(subject);
        }
        const noteBody=subject.querySelector('.study-note-body')||subject;
        if(!noteBody.querySelector('[data-religion-review]'))noteBody.insertAdjacentHTML('beforeend',referenceHtml(link));
      }
    };
    notes?.addEventListener('click',event=>{const button=event.target.closest('[data-notes-source]');if(!button)return;notesSource=button.dataset.notesSource==='saved'?'saved':'weekly';change('[data-notes-source="'+notesSource+'"]');});
    notes?.addEventListener('toggle',refreshNotes);
    if(notes?.open)refreshNotes();
    host.querySelector('[data-study-test-options]')?.addEventListener('toggle',event=>{testsOpen=event.currentTarget.open;});
    host.querySelector('[data-test]')?.addEventListener('click',()=>onTest?.());
    host.querySelectorAll('[data-test-single]').forEach(button=>button.addEventListener('click',()=>onTest?.(Number(button.dataset.testSingle))));
    host.querySelectorAll('[data-test-guide]').forEach(button=>button.addEventListener('click',()=>printGuide(Number(button.dataset.testGuide))));
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

  return {openNotes(){notesOpen=true;change('[data-study-notes] > summary');},selection,priorityHtml,statusHtml,homeHtml,secondaryHtml,bind,readAloud,setModel(value){model=value;}};
}
