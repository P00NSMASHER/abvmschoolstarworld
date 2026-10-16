import {readFileSync} from "node:fs";

const canonicalBytes=value=>Buffer.byteLength(value.replace(/\r\n/g,"\n"),"utf8");
const css=readFileSync(new URL("../pages/styles.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../pages/app.js",import.meta.url),"utf8");
const fail=message=>{throw new Error(message)};

const deadSelectors=[
  ".quest-launcher",
  ".mission-picker",
  ".school-star-avatar",
  ".avatar-studio",
  ".shop-grid",
  ".star-league",
  ".purchase-dialog",
  ".ambient",
  ".offline-banner",
  ".calendar-lunch",
  ".calendar-note",
  ".study-intro",
  ".study-jumps",
  ".subject-title",
  ".say-it",
  ".story-line",
  ".word-line",
  ".chip-row",
  ".study-source-warning",
  ".privacy-card",
  ".policy-card",
  ".conflicts",
  ".source-note",
  ".game-controls",
  ".install-card",
  ".error-shell",
  ".reading-policy-card",
  ".game-section-heading",
  ".question-tech-card",
  ".game-engine-stats",
  ".question-quality-note"
];
for(const selector of deadSelectors)if(css.includes(selector))fail("Obsolete selector remains: "+selector);
for(const marker of ["--tw-","@layer utilities","@property --tw-",".sr-only{",".day-detail:before{",".day-detail.green::before",".day-detail.purple::before",".day-detail.blue::before",".day-detail.yellow::before"]){
  if(css.includes(marker))fail("Compiler/dead CSS residue returned: "+marker);
}
// The rebuilt day presentation has no legacy stripe to suppress.

if(canonicalBytes(css)>70000)fail("styles.css exceeded the 70 KB hygiene ceiling");
if(canonicalBytes(app)>60000)fail("app.js exceeded the 60 KB hygiene ceiling");

const calendarCellRuleBlocks=(css.match(/\.calendar-grid button\s*\{/g)||[]).length;
if(calendarCellRuleBlocks>2)fail("Calendar cell CSS has accumulated duplicate rule blocks");

if(/True desktop layout|Audit fixes 6–10|Phase 3:|Phase 4:|Phase 5:/.test(css)){
  fail("Historical patch-layer comments remain in styles.css");
}
if(/date-utils\.js|events\.js|school-model\.js|school-year-calendar\.json/.test(app)){
  fail("Production app references removed duplicate model code");
}
const intlFormatterCount=(app.match(/new Intl\.DateTimeFormat/g)||[]).length;
if(intlFormatterCount!==3)fail("Intl.DateTimeFormat construction drifted from the three shared formatters");
for(const marker of ["getDerivedPack().homeworkRows","getDerivedPack().lunchProofs.get","parentNoticeRows"]){
  if(!app.includes(marker))fail("Pack-stable runtime cache marker missing: "+marker);
}
if(app.includes('(pack?.lunchMenuSource?.sourcePages||[]).find(row=>row.id===lunch.sourceId)')){
  fail("Lunch proof lookup regressed to a per-render linear scan");
}
for(const stalePattern of [
  "(pack?.importantDates||[]).map(x=>({x,d:parseDate(x.date)}))",
  "const date=parseDate(item.date),range=eventDateRange(item.date)",
  "const picture=(pack?.importantDates||[])"
]){
  if(app.includes(stalePattern))fail("Repeated school-data scan returned: "+stalePattern);
}

const review=readFileSync(new URL('../pages/study-review.js',import.meta.url),'utf8');
if(canonicalBytes(review)>6000)fail('Review engine exceeded its 6 KB runtime budget');
if(review.includes('document.createElement("style")'))fail('Review engine must not inject retired visual styles');
for(const retired of ['ABVMStudyPractice','room-learning-summary','daily-practice-title']){
  if(review.includes(retired))fail('Retired Study dashboard code returned: '+retired);
}

console.log('CSS/code hygiene PASS',{
  cssBytes:canonicalBytes(css),appBytes:canonicalBytes(app),reviewBytes:canonicalBytes(review),calendarCellRuleBlocks
});
