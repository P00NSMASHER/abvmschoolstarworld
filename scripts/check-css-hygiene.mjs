import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../pages/styles.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../pages/app.js",import.meta.url),"utf8");
const fail=message=>{throw new Error(message)};

const deadSelectors=[
  ".quest-launcher",".mission-picker",".school-star-avatar",".avatar-studio",
  ".shop-grid",".star-league",".purchase-dialog"
];
for(const selector of deadSelectors)if(css.includes(selector))fail("Obsolete selector remains: "+selector);

if(Buffer.byteLength(css,"utf8")>80000)fail("styles.css exceeded the 80 KB hygiene ceiling");
if(Buffer.byteLength(app,"utf8")>55000)fail("app.js exceeded the 55 KB hygiene ceiling");

const calendarCellRuleBlocks=(css.match(/\.calendar-grid button\s*\{/g)||[]).length;
if(calendarCellRuleBlocks>2)fail("Calendar cell CSS has accumulated duplicate rule blocks");

if(/True desktop layout|Audit fixes 6–10|Phase 3:|Phase 4:|Phase 5:/.test(css)){
  fail("Historical patch-layer comments remain in styles.css");
}
if(/date-utils\.js|events\.js|school-model\.js|school-year-calendar\.json/.test(app)){
  fail("Production app references removed duplicate model code");
}

console.log("CSS/code hygiene PASS",{
  cssBytes:Buffer.byteLength(css,"utf8"),
  appBytes:Buffer.byteLength(app,"utf8"),
  calendarCellRuleBlocks,
});
