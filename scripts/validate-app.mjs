import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const exists=p=>fs.existsSync(path.join(root,p));
const fail=m=>{throw new Error(m)};
const pack=JSON.parse(read("pages/data/study-pack.json"));
const manifest=JSON.parse(read("pages/manifest.webmanifest"));
if(!pack?.pack?.sourceSufficient)fail("study-pack.json must contain a source-sufficient pack");
for(const key of ["importantDates","homework","subjects","reminders","parentNotices"])if(!Array.isArray(pack.pack[key]))fail("Missing pack array: "+key);
if(manifest.display!=="standalone")fail("PWA manifest must remain standalone");
if(!/^#[a-f0-9]{6}$/i.test(manifest.theme_color))fail("PWA manifest needs a deliberate brand theme color");
const index=read("pages/index.html"),css=read("pages/styles.css"),app=read("pages/app.js"),games=read("pages/study-games.js"),sw=read("pages/sw.js");
const browserTheme=index.match(/<meta name="theme-color" content="([^"]+)">/)?.[1];
if(browserTheme!==manifest.theme_color)fail("Browser and installed-app theme colors must agree");
const product=read("pages/product-view.js"),presentation=app+"\n"+product;
if(!/href="\.\/styles\.css(?:\?[^"]*)?"/.test(index))fail("Gold-standard styles.css must be loaded");
if(!/["']\.\/study-games\.js\?v=\d+["']/.test(app))fail("Versioned Study Games engine must be lazy-loadable from app.js");
if(!/["']\.\/study-games-view\.js\?v=\d+["']/.test(app))fail("Versioned Study Games view must be lazy-loadable from app.js");
if(!/src="\.\/app\.js(?:\?[^"]*)?"/.test(index))fail("Gold-standard app.js must be loaded");
for(const marker of ["today-screen","week-screen","family-screen"])if(!presentation.includes(marker))fail("Missing primary product view: "+marker);
for(const destination of ["today","week","study","family"])if(!(index+app).includes('data-tab="'+destination+'"'))fail("Missing primary navigation destination: "+destination);
const renderedStyles=css+"\n"+read("pages/study-games-materials.css")+"\n"+read("pages/study-teaching.css");
for(const marker of [".app-header",".day-picker",".calendar-card",".study-game-tile",".game-question-card",".game-answer",".study-game-grid",".family-hero",".bottom-nav"])if(!renderedStyles.includes(marker))fail("Missing core style marker: "+marker);
if(!/study:renderGames\s*,\s*games:renderGames/.test(app))fail("Study and the retained Games route must share one renderer");
const modeBlock=app.match(/const STUDY_GAME_MODES=Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1]||"";
const modeIds=[...modeBlock.matchAll(/\bid:"([^"]+)"/g)].map(match=>match[1]);
if(modeIds.join(",")!=="reading,spelling,math,religion,mix")fail("Study Games must expose one mode per academic subject plus Mix");
const materialsView=read("pages/study-games-materials-view.mjs");
if(!/<select[^>]*data-test-select/.test(materialsView))fail("Test Prep must use a native upcoming-test selector");
for(const marker of ["printableTests","data-test-single","No verified questions match this test yet"])
  if(!materialsView.includes(marker))fail("Missing simplified Study control: "+marker);
for(const marker of ["mountStudyHub","ABVMStudyReview.render(","Learning on this device","room-learning-summary"])
  if(app.includes(marker)||materialsView.includes(marker))fail("Retired Study dashboard must not be mounted: "+marker);
for(const file of ["study-materials.mjs","study-games-materials-view.mjs"])
  if(!app.includes("./"+file)||!sw.includes("./"+file)||!exists("pages/"+file))fail("Integrated Study module must load and remain available offline: "+file);
for(const ref of [...app.matchAll(/import\("(\.\/study-games-materials-view\.mjs\?v=\d+)"\)/g)].map(match=>match[1]))
  if(!sw.includes(ref))fail("Study renderer and offline cache versions differ: "+ref);
const materialsCss=index.match(/href="(\.\/study-games-materials\.css\?v=\d+)"/)?.[1];
if(!materialsCss||!sw.includes(materialsCss)||!exists("pages/study-games-materials.css"))fail("Integrated Study styles must load and remain available offline");
for(const ref of [...app.matchAll(/["'](\.\/study-games(?:-view)?\.js\?v=\d+)["']/g)].map(match=>match[1]))
  if(!sw.includes(ref))fail("Games code and offline cache versions differ: "+ref);
for(const marker of ["skill-only-equivalent-item-v2","research-quality","buildCatalog","selectQuestions","FORBIDDEN"])if(!games.includes(marker))fail("Missing Study Games engine marker: "+marker);
if(!app.includes("./data/study-pack-runtime.json")||!app.includes("./data/study-pack.json"))fail("App must prefer runtime pack and retain full-pack fallback");
if(!sw.includes("./data/study-pack-runtime.json")||!sw.includes("./data/study-pack.json"))fail("Service worker must cache runtime and full school packs");
if(!app.includes("./assets/abvm-app-icon-192.png"))fail("School seal must use local app asset");
const photoSources=presentation+"\n"+css;
if(!photoSources.includes("./assets/school/abvm-school-hero.webp"))fail("Today must use approved real school photography");
const approvedSchoolPhotos=[
  "./assets/school/abvm-school-sign.webp",
  "./assets/school/abvm-school-hero.webp",
  "./assets/school/abvm-school-aerial.webp",
  "./assets/school/abvm-school-facade.webp"
];
for(const ref of approvedSchoolPhotos){
  if(!sw.includes(ref))fail("Approved school photo must remain available offline: "+ref);
  if(!exists("pages/"+ref.slice(2)))fail("Approved school photo is missing: "+ref);
}
const publishedSchoolPhotos=fs.readdirSync(path.join(root,"pages/assets/school")).filter(name=>/\.webp$/i.test(name)).sort();
const expectedSchoolPhotos=approvedSchoolPhotos.map(ref=>path.basename(ref)).sort();
if(JSON.stringify(publishedSchoolPhotos)!==JSON.stringify(expectedSchoolPhotos))fail("Only the four approved Tier A school photos may be published");
for(const ref of ["pages/product-view.js","pages/assets/abvm-app-icon-180.png","pages/assets/abvm-app-icon-192.png","pages/assets/abvm-app-icon-512.png","pages/data/study-pack.json","pages/styles.css","pages/study-games.js","pages/study-games-view.js","pages/app.js"])if(!exists(ref))fail("Missing rollback asset: "+ref);
for(const ref of [
  "pages/js/calendar-visuals.js","pages/js/install.js","pages/js/storage.js",
  "pages/calendar-clean.css","pages/colorful-polish.css","pages/design-tokens.css",
  "pages/family-clean.css","pages/responsive.css","pages/study-clean.css",
  "pages/today-clean.css","pages/week-clean.css"
])if(exists(ref))fail("Obsolete legacy source must stay removed: "+ref);
for(const ref of [
  "pages/js/date-utils.js","pages/js/events.js","pages/js/school-model.js",
  "pages/data/school-year-calendar.json","tests/events.test.mjs","tests/school-model.test.mjs"
])if(exists(ref))fail("Duplicate unused school-model source must stay removed: "+ref);
for(const ref of ["netlify.toml","netlify/functions/refresh-study-pack.mjs","netlify/functions/study-pack.mjs"])
  if(exists(ref))fail("Obsolete Netlify proxy/fallback source must stay removed: "+ref);
for(const selector of [".quest-launcher",".mission-picker",".school-star-avatar",".avatar-studio",".shop-grid",".star-league",".purchase-dialog",".ambient",".offline-banner",".calendar-lunch",".calendar-note",".study-intro",".study-jumps",".subject-title",".say-it",".story-line",".word-line",".chip-row",".study-source-warning",".privacy-card",".policy-card",".conflicts",".source-note",".game-controls",".install-card",".error-shell",".reading-policy-card",".game-section-heading",".question-tech-card",".game-engine-stats",".question-quality-note",".month-agenda",".agenda-day",".agenda-event",".agenda-events",".agenda-regular",".study-star-goal-head",".study-star-goal-progress",".study-star-goal-selected"])
  if(css.includes(selector))fail("Obsolete CSS must stay removed: "+selector);
if(Buffer.byteLength(css.replace(/\r\n/g,"\n"),"utf8")>70000)fail("styles.css exceeded the post-cleanup 70 KB ceiling");
const obsoleteAssetNames=fs.readdirSync(path.join(root,"pages/assets")).filter(name=>
  /^(?:hero-(?:today|week|calendar|study|family)|lunch-(?:monday|tuesday|wednesday|thursday|friday)|calendar-(?:lunch|star|gym|pretzel))\.webp$/.test(name)
);
if(obsoleteAssetNames.length)fail("Obsolete legacy visual assets must stay removed: "+obsoleteAssetNames.join(", "));
if(exists("pages/assets/calendar"))fail("Obsolete calendar visual asset directory must stay removed");
if(exists("pages/data/calendar-visual-library.json"))fail("Obsolete calendar visual library must stay removed");
const swShell=[...sw.matchAll(/"\.\/([^"]+)"/g)].map(m=>m[1]).filter(Boolean);
const generatedShellRefs=new Set(["data/study-pack-runtime.json"]);
for(const ref of swShell){
  const fileRef=ref.split(/[?#]/)[0];
  if(fileRef&&!generatedShellRefs.has(fileRef)&&!exists("pages/"+fileRef))fail("Service worker shell references missing file: "+ref);
}
console.log("ABVM product, data and offline validation passed",{importantDates:pack.pack.importantDates.length,homework:pack.pack.homework.length});
