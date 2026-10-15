/**
 * Decorative premium paper theme for the already-verified ABVM study materials.
 * No curriculum data, question text, source precedence or homework logic lives here.
 * Uses the approved local ImageGen subject art plus small original vector stickers.
 */
const artSubjects = {math:'math',religion:'religion',spelling:'spelling',grammar:'reading',reading:'reading'};
const drawings = {
  math: [
    '<path d="m8 2 2.7 5.6 6.1.9-4.4 4.2 1.1 6-5.5-2.9-5.5 2.9 1.1-6L-.1 8.5 5.3 7.6Z" fill="#ffd452" stroke="#e3a637" stroke-width="1.2" transform="translate(4 3)"/>',
    '<path d="M5 18 17.5 5.5l3 3L8 21l-4 1Z" fill="#ffca38" stroke="#143d63" stroke-width="1.4"/><path d="m16 7 3 3M4 22l1.2-4" stroke="#143d63" stroke-width="1.4"/>',
    '<rect x="3" y="12" width="9" height="9" rx="2" fill="#91cbff" stroke="#2267a2"/><rect x="13" y="5" width="9" height="16" rx="2" fill="#f9b8d6" stroke="#9a598c"/><path d="M6 15h3m7-6h3m-3 4h3" stroke="#fff" stroke-width="1.7"/>',
    '<path d="M12 7c-3-5-8-1-8 5s3 9 7 9c2 0 2-1 4 0 4 0 7-4 7-9s-5-10-10-5Z" fill="#ff8d8d" stroke="#d14e54" stroke-width="1.4"/><path d="M12 7q1-5 5-5" stroke="#417f4f" stroke-width="1.5"/><path d="M13 7q5-7 9-4-1 5-9 4Z" fill="#81c78e"/>'
  ],
  religion: [
    '<path d="M5 8 12 3l7 5v13H5Z" fill="#fff6ce" stroke="#93673c" stroke-width="1.4"/><path d="M3 9 12 2l9 7M9 21v-8h6v8M12 1v-1M9 4h6" stroke="#93673c" stroke-width="1.5"/><path d="M12 1v6m-3-3h6" stroke="#a5672c" stroke-width="1.7"/>',
    '<path d="M11 3h3v7h6v4h-6v8h-3v-8H5v-4h6Z" fill="#ffca38" stroke="#9a6832" stroke-width="1.5"/>',
    '<path d="M5 18c0-6 4-10 7-15 3 5 7 9 7 15a7 7 0 0 1-14 0Z" fill="#9fd9fa" stroke="#4e9bce" stroke-width="1.6"/><path d="M10 15c-2 3-1 5 1 6" fill="none" stroke="#fff" stroke-width="2"/>',
    '<path d="M3 6q5-3 9 1 4-4 9-1v14q-5-3-9 1-4-4-9-1Z" fill="#fff8da" stroke="#9b7451" stroke-width="1.4"/><path d="M12 7v14M5 10l5-1M14 9l5 1" stroke="#9b7451" stroke-width="1.2"/>',
    '<rect x="8" y="10" width="8" height="12" rx="1.5" fill="#fffbea" stroke="#a67a4d" stroke-width="1.4"/><path d="M12 2q5 4 1 8-5-1-1-8Z" fill="#ffc44d" stroke="#e69a3b"/><path d="M12 13v6m-2-3h4" stroke="#c69543" stroke-width="1.4"/>'
  ],
  reading: [
    '<path d="M3 5q5-2 9 1 4-3 9-1v16q-5-3-9 1-4-4-9-1Z" fill="#cde8ff" stroke="#315e9d" stroke-width="1.5"/><path d="M12 6v16M5 9l5 1m4 0 5-1" stroke="#315e9d"/>',
    '<path d="m12 2 3 6 6 .8-4.6 4.5 1.2 6.5-5.6-3-5.6 3 1.2-6.5L3 8.8 9 8Z" fill="#ffe06f" stroke="#bd832d" stroke-width="1.4"/>'
  ],
  spelling: [
    '<path d="m5 18 12-13 3 3L8 21l-4 1Z" fill="#ffca38" stroke="#173b60" stroke-width="1.5"/><path d="m16 6 3 3" stroke="#173b60" stroke-width="1.7"/>',
    '<path d="M4 7h16v12H4Z" fill="#f8d5e4" stroke="#ab6b93" stroke-width="1.5"/><path d="M7 10h4m-4 3h10m-10 3h8" stroke="#ab6b93" stroke-width="1.5"/>'
  ]
};
drawings.grammar = drawings.reading;

function tinyArt(kind,number) {
  const entries=drawings[kind]||drawings.reading, artwork=entries[number%entries.length];
  return '<span class="premium-mini-art" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" focusable="false">'+artwork+'</svg></span>';
}

/** Decorate the generated HTML; never edit the questions or their answer key. */
export function decoratePaper(html,kind='reading') {
  const subject=artSubjects[kind]||'reading';
  let section=0;
  return String(html)
    .replace('<body>','<body class="premium-paper paper-'+subject+'">')
    .replace(/<header class="(sheet-header|header)">/g,(match) =>
      match+'<img class="premium-paper-hero" src="./assets/illustrations/'+subject+'.webp" alt="" aria-hidden="true" loading="eager">')
    .replace(/<h2\b[^>]*>/g,tag=>tag+tinyArt(subject,section++));
}

export const premiumPaperCss = [
  '.premium-paper{--ink:#152f58;--border:#b7d9f2;--sky:#ecf7ff;--pink:#fff0f7;--mint:#eaf9f1;--yellow:#fff8e2;--lilac:#f4efff;color:var(--ink)!important;background:#eaf2fa!important;font-family:"Trebuchet MS","Arial Rounded MT Bold",Arial,sans-serif!important}',
  '.premium-paper .sheet{border:2px solid #d2e5f6;border-radius:19px;background:#fff;padding:.32in;box-shadow:0 8px 25px rgba(16,46,88,.1);color:var(--ink);max-width:7.65in}',
  '.premium-paper .sheet-header,.premium-paper .header{position:relative;padding:.2in .88in .17in .19in;border:2px solid #a7cfff!important;border-radius:17px;background:linear-gradient(120deg,#e5f4ff 0%,#fff0f7 68%,#fff9e2 100%);margin-bottom:.13in;min-height:.95in}',
  '.premium-paper .sheet-header h1,.premium-paper .header h1{color:#173762;font-family:"Trebuchet MS",Arial,sans-serif;font-size:21pt;font-weight:900;letter-spacing:-.035em;text-align:left;line-height:1.14;margin:.06in 0}',
  '.premium-paper .sheet-header .paper-topline,.premium-paper .header .eyebrow{color:#345d86;font-size:8pt;font-weight:800;letter-spacing:.06em}',
  '.premium-paper .paper-topline,.premium-paper .eyebrow{flex-wrap:wrap}',
  '.premium-paper .test-label,.premium-paper .subtitle{color:#39516d!important;font-size:9.6pt}',
  '.premium-paper .premium-paper-hero{position:absolute;right:.12in;top:.12in;width:.65in;height:.65in;object-fit:contain;filter:drop-shadow(0 3px 4px #17376022)}',
  '.premium-paper .premium-mini-art{display:inline-grid;place-items:center;vertical-align:middle;flex:none;width:31px;height:31px;margin-right:8px;border-radius:50%;background:#fff;box-shadow:0 2px 5px #284c741a}',
  '.premium-paper .premium-mini-art svg{display:block;width:26px;height:26px}',
  '.premium-paper h2{display:flex;align-items:center;gap:3px;color:var(--ink);font-size:12pt;font-weight:900;line-height:1.3}',
  '.premium-paper .section h2,.premium-paper .section-title,.premium-paper .memory-section h2{padding:.09in .12in!important;margin:0 0 .11in;border:1px solid #b4d6ef!important;border-radius:12px;background:#ddecff;color:#163b65}',
  '.premium-paper .section:nth-of-type(4n+2) h2,.premium-paper .memory-section:nth-of-type(4n+2) h2{background:#ffe4f0;border-color:#f6bdd9!important}',
  '.premium-paper .section:nth-of-type(4n+3) h2,.premium-paper .memory-section:nth-of-type(4n+3) h2{background:#e4f8eb;border-color:#b8e4cc!important}',
  '.premium-paper .section:nth-of-type(4n+4) h2,.premium-paper .memory-section:nth-of-type(4n+4) h2{background:#fff3cb;border-color:#f4da8e!important}',
  '.premium-paper .card,.premium-paper .worked,.premium-paper .activity,.premium-paper .key-notes,.premium-paper .organizer-prompt{border:1.5px solid #b6d9ef!important;border-radius:16px!important;background:#f1f9ff;padding:.12in .14in}',
  '.premium-paper .columns{gap:.14in;align-items:stretch}',
  '.premium-paper .columns>.card:nth-child(even),.premium-paper .activity:nth-child(even){background:#fff2f8;border-color:#f5c6dc!important}',
  '.premium-paper .worked:nth-of-type(even),.premium-paper .organizer-prompt:nth-of-type(even){background:#f1faee;border-color:#c3e9cc!important}',
  '.premium-paper .badge-row span{background:#fff3cc;color:#5d4925;border:1px solid #edcb76;border-radius:100px;padding:6px 11px}',
  '.premium-paper .focus-note{background:#f1f9ff;border:1px solid #b4d4ee;border-left:5px solid #6eaff0;border-radius:11px;color:#15395f}',
  '.premium-paper .strategy-list b{background:#ffe68a;color:#233857;border:1px solid #f1c85e;font-weight:900}',
  '.premium-paper .answer{background:#fff6cf;border-left-color:#edb94d;border-radius:5px;color:#15395f}',
  '.premium-paper .vocabulary div{padding:.1in;border:1px solid #d1e4f4;border-radius:10px;background:#f7fbff}',
  '.premium-paper .vocabulary dt{color:#1b4777}.premium-paper .vocabulary dd{color:#2f4666}',
  '.premium-paper .checklist label{border:1px solid #f4c9df;border-radius:12px;background:#fff0f7;align-items:center}',
  '.premium-paper .directions{background:#eaf7ff;border:1px solid #a9d3f0;border-radius:11px;padding:.11in .14in}',
  '.premium-paper .problem{break-inside:avoid;page-break-inside:avoid}',
  '.premium-paper .paper-problems:not(.math-grid) .problem{border:1px solid #d1e2ef;border-radius:13px;padding:.12in .14in;margin:.09in 0;background:#fff}',
  '.premium-paper .paper-problems:not(.math-grid) .problem:nth-child(4n+2){background:#fff3fa;border-color:#f3d2e3}',
  '.premium-paper .paper-problems:not(.math-grid) .problem:nth-child(4n+3){background:#f2fbf2;border-color:#cdebd2}',
  '.premium-paper .paper-problems:not(.math-grid) .problem:nth-child(4n+4){background:#fffae9;border-color:#efdfb5}',
  '.premium-paper .math-grid{border:0;gap:.1in;grid-template-columns:repeat(2,minmax(0,1fr))}',
  '.premium-paper .math-grid .problem{min-width:0;min-height:1.17in;padding:.12in;border:1.5px solid #c8dff4;border-radius:13px;background:#eff8ff}',
  '.premium-paper .math-grid .problem:nth-child(4n+2){background:#fff0f7;border-color:#f6d4e5}',
  '.premium-paper .math-grid .problem:nth-child(4n+3){background:#ecfaef;border-color:#cce9d4}',
  '.premium-paper .math-grid .problem:nth-child(4n+4){background:#fff8e4;border-color:#eee0b4}',
  '.premium-paper .bubble{border:2px solid #264b79;width:.17in;height:.17in}',
  '.premium-paper .word-list li{background:#f1f9ff;padding:.08in .09in;border:1px solid #d2e5f3;border-radius:9px}',
  '.premium-paper .dictation-item{min-height:.43in}',
  '.premium-paper .warning,.premium-paper .caution{background:#fff8dd;border:1px solid #e4c06c;border-radius:10px;color:#63451d;padding:.11in}',
  '.premium-paper .footer,.premium-paper .source-note{color:#51647a;border-top:1px solid #c3d6e6;font-size:8pt}',
  '.premium-paper .adult-key{background:#fff}',
  '.premium-paper .adult-key .sheet-header,.premium-paper .adult-key .header{background:#edf6ff}',
  '.premium-paper .adult-key .key-list{columns:2;column-gap:.25in}',
  '.premium-paper .section,.premium-paper .card,.premium-paper .memory-section,.premium-paper .worked,.premium-paper .organizer-prompt{break-inside:auto}',
  '@media screen and (max-width:640px){.premium-paper .sheet{width:100%;padding:12px;border-width:1px;border-radius:10px}.premium-paper .sheet-header,.premium-paper .header{padding:13px 59px 13px 10px;min-height:75px}.premium-paper .sheet-header h1,.premium-paper .header h1{font-size:17pt}.premium-paper .premium-paper-hero{right:4px;top:11px;width:48px;height:48px}.premium-paper .columns,.premium-paper .activity-steps,.premium-paper .vocabulary,.premium-paper .math-grid{grid-template-columns:1fr}.premium-paper .premium-mini-art{width:27px;height:27px;margin-right:3px}.premium-paper .premium-mini-art svg{width:23px;height:23px}.premium-paper .section h2{font-size:11pt}.premium-paper .key-list{columns:1}}',
  '@media print{@page{size:Letter portrait;margin:.38in}.premium-paper{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.premium-paper .sheet{border:0;box-shadow:none;margin:0 auto;max-width:none;width:100%;padding:.04in 0;border-radius:0;break-after:page}.premium-paper .sheet:last-child{break-after:auto}.premium-paper .adult-key{page-break-before:always;break-before:page}.premium-paper .section,.premium-paper .memory-section,.premium-paper .card,.premium-paper .worked,.premium-paper .problem,.premium-paper .organizer-prompt,.premium-paper .dictation-item{break-inside:avoid;page-break-inside:avoid}.premium-paper .math-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}'
].join('\n');
