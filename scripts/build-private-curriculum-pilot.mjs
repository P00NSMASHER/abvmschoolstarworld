import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { auditHeldCurriculumPilot, readHeldCandidates } from './audit-held-curriculum-pilot.mjs';

const PROJECT_ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const OUTPUT_NAME = 'educator-pilot.html';
const STYLE = ":root { color-scheme: light; font-family: -apple-system,BlinkMacSystemFont,\"Segoe UI\",Arial,sans-serif; color:#20312f; background:#f5f7f6; }\n* { box-sizing:border-box; } body { margin:0; } main { width:min(720px,100%); margin:0 auto; padding:24px 18px 50px; }\nheader { margin-bottom:20px; } .eyebrow { font-size:.72rem; font-weight:800; letter-spacing:.10em; text-transform:uppercase; color:#35675f; }\nh1 { font-size:clamp(1.5rem,5vw,2.1rem); line-height:1.15; margin:10px 0; } h2 { font-size:1.1rem; margin:0 0 8px; }\nh3 { line-height:1.45; font-size:1.15rem; margin:12px 0 20px; }\np { line-height:1.55; } .muted { color:#50645f; } .notice { padding:12px 15px; border:1px solid #bed4ce; border-radius:12px; background:#ecf4f1; font-size:.88rem; }\n.card { border:1px solid #d8e2dd; background:white; border-radius:16px; padding:22px; box-shadow:0 5px 24px #17342b0d; }\n.meta { display:flex; flex-wrap:wrap; justify-content:space-between; gap:12px; align-items:center; font-weight:700; color:#2d6158; }\nfieldset { border:0; padding:0; margin:0; } legend { font-weight:700; margin-bottom:10px; }\nlabel.answer { display:flex; align-items:center; gap:12px; border:1px solid #cbd9d3; border-radius:12px; padding:12px; margin:10px 0; min-height:50px; line-height:1.4; cursor:pointer; }\nlabel.answer:has(input:checked) { border-color:#236c60; outline:2px solid #236c6044; background:#f1f8f5; }\ninput[type=radio] { accent-color:#146554; width:19px; height:19px; flex:none; }\n.controls { display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }\nbutton { border-radius:10px; border:1px solid #a8c2ba; min-height:44px; padding:10px 14px; font:inherit; font-size:.94rem; font-weight:700; color:#134e43; background:#f3faf7; cursor:pointer; }\nbutton.primary { background:#145d4f; color:white; border-color:#145d4f; }\nbutton:focus-visible, input:focus-visible { outline:3px solid #5c947e; outline-offset:3px; } button[disabled] { cursor:default; opacity:.5; }\ndetails { margin:15px 0; } .reveal { white-space:pre-wrap; margin-top:12px; padding:13px; background:#f1f7f4; border-radius:10px; border-left:3px solid #327060; }\nfooter { color:#5f6e68; font-size:.78rem; margin-top:18px; } code { overflow-wrap:anywhere; }\n.sr-only {position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}\n@media (max-width:420px) { main {padding:16px 12px 40px} .card{padding:16px} .controls button {flex:1 1 auto} }\n@media print { body{background:white;} main{width:100%;padding:0} .card{box-shadow:none} .controls, .notice, footer {display:none} }";
const CLIENT_SCRIPT = "(function () {\n  \"use strict\";\n  const payload = JSON.parse(document.getElementById(\"pilot-payload\").textContent);\n  const questions = payload.families.flatMap(function (family) {\n    return family.questions.map(function (q) { return Object.assign({ topic:family.topic },q); });\n  });\n  const get = function (id) { return document.getElementById(id); };\n  let position = 0;\n  const selections = new Map();\n  const hints = new Set();\n  const explained = new Set();\n  function text(id, value) { get(id).textContent = String(value); }\n  function render(shouldFocus) {\n    const q = questions[position];\n    text(\"counter\",(position + 1) + \" of \" + questions.length);\n    text(\"topic\",q.topic);\n    text(\"question\",q.prompt);\n    const group = get(\"answers\");\n    group.replaceChildren();\n    q.choices.forEach(function (choice, choiceIndex) {\n      const label = document.createElement(\"label\");\n      label.className = \"answer\";\n      const radio = document.createElement(\"input\");\n      radio.type = \"radio\";\n      radio.name = \"answer\";\n      radio.value = String(choiceIndex);\n      radio.checked = selections.get(position) === choiceIndex;\n      radio.addEventListener(\"change\",function () {\n        selections.set(position,choiceIndex);\n        explained.delete(position);\n        get(\"explanation\").hidden = true;\n        get(\"explanation-button\").setAttribute(\"aria-expanded\",\"false\");\n        text(\"explanation-button\",\"Show explanation\");\n      });\n      const span = document.createElement(\"span\");\n      span.textContent = choice;\n      label.append(radio,span);\n      group.append(label);\n    });\n    const hintVisible = hints.has(position);\n    get(\"hint\").hidden = !hintVisible;\n    text(\"hint\",q.hint);\n    get(\"hint-button\").setAttribute(\"aria-expanded\",String(hintVisible));\n    text(\"hint-button\",hintVisible ? \"Hide hint\" : \"Show hint\");\n    const explainVisible = explained.has(position);\n    get(\"explanation\").hidden = !explainVisible;\n    const selectedIndex = selections.get(position);\n    const prefix = selectedIndex === undefined ? \"Answer key: \" :\n      q.choices[selectedIndex] === q.answer ? \"Your choice matches the answer key. \" : \"Your choice differs from the answer key. \";\n    text(\"explanation\",prefix + q.answer + \". \" + q.explanation);\n    get(\"explanation-button\").setAttribute(\"aria-expanded\",String(explainVisible));\n    text(\"explanation-button\",explainVisible ? \"Hide explanation\" : \"Show explanation\");\n    get(\"previous\").disabled = position === 0;\n    get(\"next\").disabled = position === questions.length - 1;\n    text(\"session-message\",\"Responses exist in this open tab only. Refreshing clears them.\");\n    if (shouldFocus) get(\"question\").focus();\n  }\n  get(\"previous\").addEventListener(\"click\",function () { if(position>0){position--;render(true);} });\n  get(\"next\").addEventListener(\"click\",function () { if(position<questions.length-1){position++;render(true);} });\n  get(\"hint-button\").addEventListener(\"click\",function () {\n    if(hints.has(position)) hints.delete(position); else hints.add(position);\n    render(false);\n  });\n  get(\"explanation-button\").addEventListener(\"click\",function () {\n    if(explained.has(position)) explained.delete(position); else explained.add(position);\n    render(false);\n  });\n  get(\"reset\").addEventListener(\"click\",function () {\n    selections.clear();hints.clear();explained.clear();position=0;render(true);\n  });\n  render(false);\n})();";
const hash = value => createHash('sha256').update(value, 'utf8').digest('base64');
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const inertJSON = value => JSON.stringify(value).replace(/[<>&]/g, c=>({
  '<':'\\u003c','>':'\\u003e','&':'\\u0026'
}[c]));

export function buildPrivateCurriculumPilotHtml(candidates = readHeldCandidates()) {
  const report = auditHeldCurriculumPilot(candidates);
  const payload = {
    evidenceClass:'LOCAL_UNRECORDED_PREVIEW',
    contentFingerprint:report.contentFingerprint,
    families:candidates.map(family=>({
      topic:family.topic,
      questions:family.proposedQuestions.map(q=>({
        prompt:q.prompt,
        choices:q.choices,
        answer:q.answer,
        hint:q.hint,
        explanation:q.explanation,
      })),
    })),
  };
  const csp = [
    "default-src 'none'",
    "script-src 'sha256-" + hash(CLIENT_SCRIPT) + "'",
    "style-src 'sha256-" + hash(STYLE) + "'",
    "connect-src 'none'",
    "img-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "font-src 'none'",
    "worker-src 'none'",
    "manifest-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');
  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta http-equiv="Content-Security-Policy" content="' + escapeHtml(csp) + '">',
    '<meta name="robots" content="noindex,nofollow,noarchive">',
    '<title>Private ABVM educator preview — unpublished draft</title>',
    '<style>' + STYLE + '</style></head><body>',
    '<main>',
    '<header><div class="eyebrow">Local educator review · not published</div>',
    '<h1>Grade 2 Reading / ELA</h1>',
    '<p class="muted">Draft practice preview for qualified adult review. 32 held questions, four topic families.</p>',
    '<p class="notice"><strong>No tracking or data collection.</strong> Works entirely offline; no network, analytics,',
    ' cookies or browser storage. Selections remain only in the open tab and cannot serve as learner-use evidence.</p>',
    '</header>',
    '<section class="card" aria-labelledby="topic">',
    '<div class="meta"><h2 id="topic">Reading / ELA</h2><span id="counter" aria-live="polite">1 of 32</span></div>',
    '<h3 id="question" tabindex="-1"></h3>',
    '<fieldset><legend>Select an answer</legend><div id="answers"></div></fieldset>',
    '<div class="controls">',
    '<button type="button" id="hint-button" aria-expanded="false" aria-controls="hint">Show hint</button>',
    '<button type="button" id="explanation-button" aria-expanded="false" aria-controls="explanation">Show explanation</button>',
    '</div>',
    '<p id="hint" class="reveal" hidden></p><p id="explanation" class="reveal" aria-live="polite" hidden></p>',
    '<div class="controls">',
    '<button type="button" id="previous">Previous question</button>',
    '<button type="button" class="primary" id="next">Next question</button>',
    '<button type="button" id="reset">Clear this session</button>',
    '</div>',
    '<p class="muted" id="session-message"></p>',
    '</section>',
    '<footer>',
    '<p>Content fingerprint: <code>' + escapeHtml(report.contentFingerprint) + '</code></p>',
    '<p>Optional review notes and any real learner observations must be kept private; neither is required to promote an independently verified question family.',
    ' This file must not be placed in Pages, shared publicly, or treated as evidence of student performance.</p>',
    '</footer></main>',
    '<script id="pilot-payload" type="application/json">' + inertJSON(payload) + '</script>',
    '<script>' + CLIENT_SCRIPT + '</script>',
    '</body></html>',
  ].join('\n');
}

export function writePrivateCurriculumPilot({candidates=readHeldCandidates(),directory}={}) {
  const location = directory === undefined
    ? mkdtempSync(join(tmpdir(),'abvm-private-educator-pilot-'))
    : resolve(directory);
  if (location === PROJECT_ROOT || location.startsWith(PROJECT_ROOT + sep)) {
    throw new Error('Private pilot output must be outside the Git repository.');
  }
  if (directory !== undefined) mkdirSync(location,{recursive:true,mode:0o700});
  const html = buildPrivateCurriculumPilotHtml(candidates);
  const path = join(location, OUTPUT_NAME);
  writeFileSync(path,html,{encoding:'utf8',flag:'wx',mode:0o600});
  const {contentFingerprint,questions,evidenceClass} = auditHeldCurriculumPilot(candidates);
  return {path,contentFingerprint,questions,evidenceClass:'SYNTHETIC_TEST_ONLY',recordedLearnerData:false};
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const output=writePrivateCurriculumPilot();
  console.log(JSON.stringify(output,null,2));
}
