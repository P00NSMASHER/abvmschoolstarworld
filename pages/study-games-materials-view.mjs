import {createReadAloud} from './study-room-view.mjs';
import {printStudyGuide} from './test-study-guide.mjs';

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

/** Compact controls only. The existing Games controller owns every round and result. */
export function createMaterialsView({onChange,onRetry,onTest,win=window} = {}) {
  let model = null, source = 'weekly', picks = ['weekly'], notesOpen = false, testsOpen = false;
  const readAloud = createReadAloud(win);
  const selection = () => ({source,sources:[...picks]});
  const focus = selector => win.document.querySelector(selector)?.focus({preventScroll:true});
  const change = selector => { onChange?.(); if (selector) focus(selector); };

  function sourceHtml() {
    return '<section class="game-materials" aria-label="Practice materials">' +
      '<label for="study-source">Practice from</label><select id="study-source" data-study-source' + (!model?' disabled':'') + '>' +
      Object.entries(sources).map(([key,label]) => '<option value="' + key + '"' + (source===key?' selected':'') + '>' + label + '</option>').join('') + '</select>' +
      (source==='mix' ? '<fieldset data-study-mix><legend>Choose what to include</legend>' + Object.entries(sources).filter(([key])=>key!=='mix').map(([key,label]) =>
        '<label><input type="checkbox" data-study-pick="' + key + '"' + (picks.includes(key)?' checked':'') + '><span>' + label + '</span></label>').join('') + '</fieldset>' : '') + '</section>';
  }

  function actionsHtml({complete=false,loading=true} = {}) {
    const tests = model?.tests(), pending = tests?.tests || [], missing = tests?.missing || [], fallback = tests?.fallback || [];
    const partial = model?.status?.partial;
    return '<section class="game-material-actions" aria-label="More practice">' +
      '<div class="game-daily-action"><button type="button" data-game-start="daily"' + (model&&!model.forMode('daily',selection()).count?' disabled':'') + '>' + (complete?'Practice a little more':'Daily practice') + '</button><span>' +
      (complete?'Today’s practice is complete.':'Eight questions. No timer.') + '</span></div>' +
      (!model&&loading?'<p class="game-material-status" role="status">Loading saved materials…</p>':'') +
      (model ? '<div class="game-test-action" data-study-tests>' + (pending.length ? '<div><strong>Next test' + (pending.length>1?'s':'') + '</strong><time datetime="' + esc(tests.date) + '">' + esc(dateLabel(tests.date)) + '</time><p>' + pending.map(test=>esc(test.label)).join(' · ') + '</p></div>' +
        (missing.length ? (tests.supported || []).map(test => '<button type="button" data-test-single="' + test.index + '">Practice ' + esc(test.label) + '</button>').join('') : '<button type="button" data-test>Start test practice</button>') +
        '<div class="game-test-guide-actions">' + pending.map(test => '<button type="button" class="game-guide-button" data-print-test="' + esc(test.date+'|'+test.label) + '">Print one-page guide · ' + esc(test.label) + '</button>').join('') + '</div>' +
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
    const tests = model?.tests(), pending = tests?.tests || [], completed = tests?.completed || [], guides = model?.studyGuides?.() || [];
    return '<div class="game-material-secondary"><details data-study-notes' + (notesOpen?' open':'') + '><summary>Notes &amp; lessons</summary><div data-study-notes-content>' + (notesOpen?notesContent():'') + '</div></details>' +
      '<details data-study-guide-options><summary>Printable study guides</summary><p>One page for every upcoming test. Each guide uses the reviewed notes and practice material already in ABVM.</p>' +
      (guides.length?'<div class="game-guide-list">' + guides.map(guide=>'<button type="button" class="game-guide-button" data-print-test="' + esc(guide.key) + '"><span>Print guide</span><strong>' + esc(guide.label) + '</strong><small>' + esc(dateLabel(guide.date)) + '</small></button>').join('') + '</div>':'<p>No upcoming test is listed.</p>') + '</details>' +
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
    host.querySelectorAll('[data-print-test]').forEach(button=>button.addEventListener('click',()=>{
      const guide=model?.studyGuide?.(button.dataset.printTest);
      if (!guide) return;
      printStudyGuide(win,guide,term=>win?.ABVMStudyGames?.vocabularyDefinition?.(term));
    }));
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
