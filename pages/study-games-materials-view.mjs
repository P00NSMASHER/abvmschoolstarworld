import {createReadAloud} from './study-room-view.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sources = Object.freeze({weekly:'This week',saved:'All my learning',star:'STAR practice',mix:'Make a mix'});
const nonempty = value => typeof value === 'string' && value.trim();
const list = rows => {const clean=(Array.isArray(rows)?rows:[]).filter(nonempty);return clean.length?'<ul>'+clean.map(row=>'<li>'+esc(row)+'</li>').join('')+'</ul>':'';};
const dateLabel = date => {const value=new Date(date+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(date||'')&&Number.isFinite(value.getTime())
  ? new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}).format(value) : '';};
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
  let model = null, source = 'weekly', picks = ['weekly'], notesOpen = false, testsOpen = false;
  const readAloud = createReadAloud(win);
  const selection = () => ({source,sources:[...picks]});
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

  function sourceHtml() {
    return '<section class="game-materials" aria-label="Practice materials">' +
      '<label for="study-source">Practice from</label><select id="study-source" data-study-source' + (!model?' disabled':'') + '>' +
      Object.entries(sources).map(([key,label]) => '<option value="' + key + '"' + (source===key?' selected':'') + '>' + label + '</option>').join('') + '</select>' +
      (source==='mix' ? '<fieldset data-study-mix><legend>Choose what to include</legend>' + Object.entries(sources).filter(([key])=>key!=='mix').map(([key,label]) =>
        '<label><input type="checkbox" data-study-pick="' + key + '"' + (picks.includes(key)?' checked':'') + '><span>' + label + '</span></label>').join('') + '</fieldset>' : '') + '</section>';
  }

  function actionsHtml({complete=false,loading=true} = {}) {
    const tests = model?.tests(), pending = tests?.tests || [], missing = tests?.missing || [], fallback = tests?.fallback || [];
    const printable = model?.printableTests?.()?.tests || pending;
    const partial = model?.status?.partial;
    return '<section class="game-material-actions" aria-label="More practice">' +
      '<div class="game-daily-action"><button type="button" data-game-start="daily"' + (model&&!model.forMode('daily',selection()).count?' disabled':'') + '>' + (complete?'Practice a little more':'Daily practice') + '</button><span>' +
      (complete?'Today’s practice is complete.':'Eight questions. No timer.') + '</span></div>' +
      (!model&&loading?'<p class="game-material-status" role="status">Loading saved materials…</p>':'') +
      (model ? '<div class="game-test-action" data-study-tests>' + (pending.length ? '<div><strong>Next test' + (pending.length>1?'s':'') + '</strong><time datetime="' + esc(tests.date) + '">' + esc(dateLabel(tests.date)) + '</time><p>' + pending.map(test=>esc(test.label)).join(' · ') + '</p></div>' +
        (missing.length ? (tests.supported || []).map(test => '<button type="button" data-test-single="' + test.index + '">Practice ' + esc(test.label) + '</button>').join('') : '<button type="button" data-test>Start test practice</button>') +
        (printable.length?'<div class="game-guide-actions" aria-label="Printable study guides"><strong>Printable study guides</strong>' + printable.map(test=>'<button type="button" data-test-guide="' + test.index + '">Print guide: ' + esc(test.label) + ' · ' + esc(dateLabel(test.date)) + '</button>').join('') + '</div>':'') +
        (missing.length?'<p class="game-material-status" data-test-missing>Practice is not available for ' + missing.map(test=>esc(test.label)).join(', ') + '. Review the teacher notes.</p>':'') +
        (fallback.length?'<p class="game-material-status" data-test-fallback>Original Grade 2 skill practice for ' + fallback.map(test=>esc(test.label)).join(', ') + '; no reviewed test-specific bank is available yet.</p>':'') : '<p>No upcoming test is listed.</p>') + '</div>' : '') +
      (partial?'<div class="game-material-status" role="status"><p>Some saved materials could not load. The available practice still works.</p><button type="button" data-study-retry>Retry saved materials</button></div>':'') +
      (tests?.message?'<div class="game-test-status" role="status"><span>' + esc(tests.message) + '</span>' + (tests.canUndo?'<button type="button" data-undo-test>Undo</button>':'') + '</div>':'') +
      '</section>';
  }

  function notesContent() {
    const data = model?.notes(source,{sources:picks});
    if (!data) return '<p>Notes are still loading.</p>';
    const lessons = data.lessons || [], notes = (data.notes || []).filter(row=>nonempty(row.text)), vocabulary = (data.vocabulary || []).filter(row=>nonempty(row.term));
    const links=(data.links||[]).filter(link=>safeUrl(link.url)),warnings=data.warnings||[];
    const subjects = [...new Set([...notes,...links,...warnings].map(row=>row.subject))];
    const lessonRows = lessons.map(lesson => '<details class="game-material-lesson"><summary>' + esc(lesson.title) + '</summary><p class="game-material-status">' + esc(lesson.subject) + ' · ' +
      (lesson.studiedOn?esc(dateLabel(lesson.studiedOn)):'Saved schoolwork · undated') + '</p>' + list(lesson.notes || []) + '</details>').join('');
    const noteRows = subjects.map(subject => '<details class="game-material-lesson" data-note-subject="'+esc(subject)+'"><summary>' + esc(subject || 'Class notes') + '</summary>' +
      list(notes.filter(row=>row.subject===subject).map(row=>row.text)) +
      warnings.filter(row=>row.subject===subject).map(row=>'<p class="game-note-warning">'+esc(row.text)+'</p>').join('') +
      links.filter(row=>row.subject===subject).map(referenceHtml).join('') + '</details>').join('');
    const words = vocabulary.length?'<details class="game-material-lesson"><summary>Words to know</summary><dl>' + vocabulary.map(row=>{const meaning=resolveVocabularyMeaning(row,term=>win?.ABVMStudyGames?.vocabularyDefinition?.(term));return '<dt>' + esc(row.term) + '</dt>' + (meaning?'<dd>' + esc(meaning) + '</dd>':'');}).join('') + '</dl></details>':'';
    return (source==='saved'?'<p class="game-material-status">Undated schoolwork stays in this collection, not in this week.</p>':'') +
      (lessonRows + noteRows + words || '<p>No lesson notes are included in this selection.</p>');
  }

  function secondaryHtml() {
    const tests = model?.tests(), pending = tests?.tests || [], completed = tests?.completed || [];
    return '<div class="game-material-secondary"><details data-study-notes' + (notesOpen?' open':'') + '><summary>Notes &amp; lessons</summary><div data-study-notes-content>' + (notesOpen?notesContent():'') + '</div></details>' +
      '<details data-study-test-options' + (testsOpen?' open':'') + '><summary>Manage tests</summary><p>Hide a finished test here. You can restore it on this browser.</p>' +
      (pending.length?'<button type="button" data-complete-test>' + (pending.length>1?'Mark these tests finished':'Mark test finished') + '</button>':'') +
      (completed.length?'<h3>Tests hidden on this device</h3>' + completed.map(test=>'<button type="button" data-restore-test="' + esc(test.key) + '">Restore ' + esc(test.label) + '</button>').join(''):'') +
      (!pending.length&&!completed.length?'<p>No tests to manage.</p>':'') + '</details></div>';
  }

  function bind(host) {
    host.querySelector('[data-study-source]')?.addEventListener('change', event => {
      const next = event.target.value;
      if (!Object.hasOwn(sources,next)) return;
      source = next; change('[data-study-source]');
    });
    host.querySelectorAll('[data-study-pick]').forEach(input=>input.addEventListener('change',()=>{
      const key = input.dataset.studyPick;
      picks = input.checked ? [...new Set([...picks,key])] : picks.filter(value=>value!==key);
      change('[data-study-pick="' + key + '"]');
    }));
    const notes=host.querySelector('[data-study-notes]');
    const refreshNotes=async()=>{
      notesOpen=notes.open;if(!notesOpen)return;
      const owner=model,body=notes.querySelector('[data-study-notes-content]');if(!body.hasChildNodes())body.innerHTML=notesContent();
      try{await owner?.loadReferences?.();}catch{}
      if(model!==owner||!notes.isConnected||!notes.open)return;
      for(const link of owner?.notes(source,{sources:picks}).links||[]){
        if(!safeUrl(link.url))continue;
        let subject=[...body.querySelectorAll('[data-note-subject]')].find(row=>row.dataset.noteSubject===link.subject);
        if(!subject){subject=win.document.createElement('details');subject.className='game-material-lesson';subject.dataset.noteSubject=link.subject;subject.innerHTML='<summary>'+esc(link.subject)+'</summary>';body.append(subject);}
        if(!subject.querySelector('[data-religion-review]'))subject.insertAdjacentHTML('beforeend',referenceHtml(link));
      }
    };
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

  return {selection,sourceHtml,actionsHtml,secondaryHtml,bind,readAloud,setModel(value){model=value;}};
}
