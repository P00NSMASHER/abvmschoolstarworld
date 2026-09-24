import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../pages/styles.css",import.meta.url),"utf8");
const tokens=readFileSync(new URL("../pages/design-tokens.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../pages/app.js",import.meta.url),"utf8");
const fail=message=>{throw new Error(message)};

if((tokens.match(/:root\s*\{/g)||[]).length!==1)fail("design-tokens.css must contain exactly one :root block.");
if((css.match(/:root\s*\{/g)||[]).length!==0)fail("styles.css must not redefine global design tokens.");
if((css.match(/!important/g)||[]).length>6)fail("Too many !important declarations; CSS cascade is regressing.");
if(/photo-sprite|today-garden|week-desk|calendar-autumn|study-room|family-campus/.test(css+app)){
  fail("Obsolete visual asset reference found.");
}
for(const dead of [".month-controls",".lunch-art",".study-jumps",".calendar-event-list"]){
  if(css.includes(dead))fail("Obsolete selector remains: "+dead);
}
if(app.length>45_000)fail("app.js has grown past 45k characters; extract another module before adding more.");
if((css.match(/\.calendar-grid button\s*\{/g)||[]).length>12)fail("Calendar cell CSS has accumulated too many duplicate rule blocks.");

console.log("CSS/code hygiene PASS",{
  cssBytes:css.length,
  appBytes:app.length,
  importantCount:(css.match(/!important/g)||[]).length,
  calendarCellRuleBlocks:(css.match(/\.calendar-grid button\s*\{/g)||[]).length,
});
