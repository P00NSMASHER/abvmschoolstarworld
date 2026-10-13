import {createHash,randomUUID} from 'node:crypto';
import {link,mkdir,readFile,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {buildSchoolworkPhotoChecklist} from './verify-schoolwork-photo-reviews.mjs';
import {assertPrivateRealPath} from './learning-history.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[char]);
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const digest=value=>createHash('sha256').update(value).digest('hex');
const li=values=>values.map(value=>'<li>'+escapeHtml(value)+'</li>').join('');
const field=(label,value)=>'<dt>'+escapeHtml(label)+'</dt><dd>'+escapeHtml(value)+'</dd>';

export function reviewWorkbookFingerprint(pack){
  const checklist=buildSchoolworkPhotoChecklist(pack);
  return digest(JSON.stringify(checklist.entries.map(entry=>[
    entry.sourceId,entry.status,entry.expectedPhotoSha256,entry.lessonContentSha256
  ])));
}

// The workbook contains PUBLIC study text, but no original photos or learner
// answers. No rendered checkboxes constitute authenticated signoff.
export function renderSchoolworkReviewWorkbook(pack){
  const checklist=buildSchoolworkPhotoChecklist(pack);
  const fingerprint=reviewWorkbookFingerprint(pack);
  const sourceMap=new Map(pack.sourceManifest.map(source=>[source.id,source]));
  const sources=checklist.entries;
  const lessons=[...pack.lessons].sort((a,b)=>cmp(a.id,b.id));
  const inventory=sources.map(source=>{
    const type=source.status==='held'?'HELD — no content permitted':
      source.duplicateOf?'DUPLICATE of '+source.duplicateOf:source.status.toUpperCase();
    return '<tr><th scope="row">'+escapeHtml(source.sourceId)+'</th><td>'+escapeHtml(type)+
      '</td><td class="hash">'+escapeHtml(source.expectedPhotoSha256)+'</td><td>'+
      (source.lessonIds.length?escapeHtml(source.lessonIds.join(', ')):'—')+'</td></tr>';
  }).join('');
  const sections=lessons.map((lesson,index)=>{
    const when=lesson.studiedOn?'Verified school day: '+lesson.studiedOn:
      lesson.weekOf?'Verified week only: '+lesson.weekOf+'; exact school day unknown':
      'Undated: do not infer a school day or current test';
    const linked=lesson.sources.map(id=>{
      const source=sourceMap.get(id);
      const description=source.status==='duplicate'
        ?'duplicate of '+source.duplicateOf+' (separate photo verification required)'
        :source.status;
      return '<li><strong>'+escapeHtml(id)+'</strong> — '+escapeHtml(description)+
        '<span class="sha">SHA-256: '+escapeHtml(source.sha256)+'</span></li>';
    }).join('');
    const questions=lesson.questions.map((q,qIndex)=>[
      '<li class="question" data-question-id="'+escapeHtml(q.id)+'">',
      '<h4>Practice '+(qIndex+1)+' · '+escapeHtml(q.id)+'</h4>',
      '<p><strong>Prompt:</strong> '+escapeHtml(q.prompt)+'</p>',
      '<ol class="choices">'+li(q.choices)+'</ol>',
      '<p><strong>Correct answer:</strong> '+escapeHtml(q.answer)+'</p>',
      '<p><strong>Explanation:</strong> '+escapeHtml(q.explanation)+'</p>',
      '<p><strong>Skill:</strong> '+escapeHtml(q.skill)+
        ' · <strong>Source fact:</strong> '+escapeHtml(q.sourceFact)+'</p>',
      '</li>'
    ].join('')).join('');
    return [
      '<section class="lesson" id="lesson-'+escapeHtml(lesson.id)+'">',
      '<h2>Lesson '+(index+1)+' of '+lessons.length+': '+escapeHtml(lesson.title)+'</h2>',
      '<dl>'+field('Lesson ID',lesson.id)+field('Subject',lesson.subject)+
        field('Date authority',when)+field('Intake date',lesson.addedOn)+'</dl>',
      '<h3>Photographs attached to this lesson</h3>',
      '<p class="warning">These photos are linked to the same lesson. This does NOT establish that every practice question is printed in each photo.</p>',
      '<ul class="source-list">'+linked+'</ul>',
      '<h3>Reviewed teaching notes</h3><ul>'+li(lesson.notes)+'</ul>',
      '<h3>Original practice questions and answer key ('+lesson.questions.length+')</h3>',
      '<p>These are original practice questions built from the topic, not necessarily literal worksheet questions. Compare topic, facts and correctness with the original source.</p>',
      '<ol class="questions">'+questions+'</ol>',
      '<div class="review-lines"><h3>Manual comparison — complete using the real original photos</h3>',
      '<p>☐ Original photos opened and SHA-256 confirmed. &nbsp; ☐ Lesson topic and dates supported.</p>',
      '<p>☐ Printed tasks compared. &nbsp; ☐ Original practice answers/explanations independently checked.</p>',
      '<p>☐ Child privacy reviewed. &nbsp; ☐ Educator/source rights reviewed. &nbsp; ☐ Uncertain facts held.</p>',
      '<p>Reviewer: __________________________ Date: _______________ Notes / corrections: __________________________</p>',
      '</div></section>'
    ].join('');
  }).join('');
  const stylesheet=[
    ':root{color-scheme:light}*{box-sizing:border-box}',
    'body{max-width:940px;margin:24px auto;padding:0 24px;color:#171717;background:white;font:15px/1.5 system-ui,Arial,sans-serif}',
    'h1{font-size:26px}h2{font-size:21px;border-bottom:2px solid #222;padding-bottom:7px}',
    'h3{font-size:17px}h4{font-size:15px}',
    '.status{border:2px solid #222;padding:12px;margin:18px 0;font-weight:700}',
    '.warning{border-left:3px solid #555;padding-left:12px}',
    'table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}',
    'th,td{border:1px solid #666;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}',
    'thead{background:#eee}.hash,.sha{overflow-wrap:anywhere;font-family:ui-monospace,monospace;font-size:11px}',
    '.sha{display:block}dl{display:grid;grid-template-columns:140px auto;gap:4px 12px}',
    'dt{font-weight:700}dd{margin:0}.lesson{margin:35px 0;padding-top:8px;border-top:1px solid #aaa}',
    '.question{margin:0 0 16px;padding:0 0 8px;border-bottom:1px dashed #bbb;break-inside:avoid}',
    '.question p{margin:5px 0}.choices{margin:7px 0}',
    '.review-lines{border:1px solid #666;padding:10px 14px;margin-top:14px}',
    '.footer{margin:24px 0;border-top:2px solid;padding-top:12px}',
    '@page{size:letter;margin:0.55in}',
    '@media print{body{max-width:none;margin:0;padding:0;font-size:11px}h1{font-size:20px}',
    'h2{font-size:17px}.lesson{break-before:page;margin:0;border:0}',
    'th,td{font-size:9px}.review-lines,.question{break-inside:avoid}}'
  ].join('');
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; img-src &#39;none&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;; base-uri &#39;none&#39;">',
    '<title>ABVM schoolwork — offline human review workbook</title><style>',
    stylesheet,'</style></head><body>',
    '<header><h1>ABVM schoolwork · offline review workbook</h1>',
    '<p>Public educational content only. No original photos, child responses, teacher marks, private review receipts, or personal results are embedded.</p>',
    '<div class="status">HOLD_EXTERNAL_SIGNOFF — This workbook is NOT a release approval.</div>',
    '<p><strong>Source-bound content fingerprint:</strong> <span class="hash">'+fingerprint+'</span></p>',
    '<p><strong>Coverage:</strong> '+checklist.totals.photos+' photographed source records · '+
      checklist.totals.lessons+' lessons · '+checklist.totals.questions+' original practice questions.</p>',
    '<p class="warning">Read the actual original photographs separately. A public manifest and a reviewer signature are not independently authenticated evidence. Human photo-content, privacy, educator/source rights, real-device checks where needed and exact-scope release permission remain required.</p>',
    '</header>',
    '<section aria-label="Source inventory"><h2>Source inventory</h2>',
    '<table><thead><tr><th scope="col">Source ID</th><th scope="col">Recorded status</th>',
    '<th scope="col">Expected SHA-256</th><th scope="col">Linked lesson(s)</th></tr></thead><tbody>',
    inventory,'</tbody></table></section>',
    sections,
    '<footer class="footer"><strong>RELEASE HOLD:</strong> Even if every review line is completed, no automatic source promotion, merge or deployment is authorized.',
    '<p>Workbook fingerprint: <span class="hash">'+fingerprint+'</span></p></footer>',
    '</body></html>'
  ].join('');
}
export async function createPrivateSchoolworkReviewWorkbook(pack,destination,{repoRoot=root}={}){
  if(typeof destination!=='string'||!path.isAbsolute(destination)||path.extname(destination).toLowerCase()!=='.html'){
    throw new Error('Specify an absolute private .html destination');
  }
  const html=renderSchoolworkReviewWorkbook(pack);
  let target;
  try{target=await assertPrivateRealPath(destination,'Private schoolwork workbook',repoRoot);}
  catch(error){
    if(error.message.includes('outside the public ABVM repository'))throw error;
    throw new Error('Private workbook destination is unavailable');
  }
  try{await mkdir(path.dirname(target),{recursive:true,mode:0o700});}
  catch{throw new Error('Unable to prepare private review directory');}
  const confirmed=await assertPrivateRealPath(destination,'Private schoolwork workbook',repoRoot);
  if(confirmed!==target)throw new Error('Private workbook destination changed during creation');
  const temporary=path.join(path.dirname(target),'.abvm-review-'+randomUUID()+'.tmp');
  try{
    await writeFile(temporary,html,{flag:'wx',mode:0o600});
    // Atomic create-only link; never overwrite a handwritten review workbook.
    await link(temporary,target);
  }catch(error){
    if(error.code==='EEXIST')throw new Error('Private review workbook already exists; choose a new filename');
    throw new Error('Unable to create private schoolwork workbook');
  }finally{await unlink(temporary).catch(()=>{});}
  const totals=buildSchoolworkPhotoChecklist(pack).totals;
  return {mode:'private-create-only',...totals,fingerprint:reviewWorkbookFingerprint(pack),
    releaseStatus:'HOLD_EXTERNAL_SIGNOFF'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2);
  try{
    if(args.length!==2)throw new Error('Usage: node scripts/build-schoolwork-review-workbook.mjs PUBLIC_PACK PRIVATE_OUTPUT.html');
    const pack=JSON.parse(await readFile(args[0],'utf8'));
    console.log(JSON.stringify(await createPrivateSchoolworkReviewWorkbook(pack,args[1])));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
