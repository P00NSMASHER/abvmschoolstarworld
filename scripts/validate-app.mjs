import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const exists=relative=>fs.existsSync(path.join(root,relative));
const fail=message=>{throw new Error(message)};

const pack=JSON.parse(read("pages/data/study-pack.json"));
const annual=JSON.parse(read("pages/data/school-year-calendar.json"));
const manifest=JSON.parse(read("pages/manifest.webmanifest"));
const visual=JSON.parse(read("pages/data/calendar-visual-library.json"));

if(!pack?.pack?.sourceSufficient)fail("study-pack.json must contain a source-sufficient pack");
for(const key of ["importantDates","homework","subjects","reminders","parentNotices"]){
  if(!Array.isArray(pack.pack[key]))fail("study-pack.json pack."+key+" must be an array");
}
if(!Array.isArray(annual?.importantDates)||annual.importantDates.length<1)fail("Annual calendar is empty");
if(manifest.display!=="standalone")fail("PWA manifest must remain standalone");
if(!Array.isArray(manifest.icons)||manifest.icons.length<2)fail("PWA manifest icons are incomplete");

const index=read("pages/index.html");
const css=read("pages/styles.css");
const responsive=read("pages/responsive.css");
const calendarClean=read("pages/calendar-clean.css");
const tokens=read("pages/design-tokens.css");
const app=read("pages/app.js");
const sw=read("pages/sw.js");

if(!/type="module" src="\.\/app\.js(?:\?[^"]*)?"/.test(index))fail("app.js must load as an ES module");
if(!/href="\.\/design-tokens\.css(?:\?[^"]*)?"/.test(index))fail("design-tokens.css must load before styles.css");
if(!/href="\.\/responsive\.css(?:\?[^"]*)?"/.test(index))fail("responsive.css must load after styles.css");
if(!/href="\.\/calendar-clean\.css(?:\?[^"]*)?"/.test(index))fail("calendar-clean.css must load after responsive.css");
if((tokens.match(/:root\s*\{/g)||[]).length!==1)fail("Design tokens must have exactly one :root block");
if((css.match(/:root\s*\{/g)||[]).length!==0)fail("styles.css must not redefine global design tokens");
if(/photo-sprite-[1-4]\.jpg/.test(app+css+responsive+calendarClean+sw+index))fail("Obsolete calendar photo sprites are still referenced");
if(/localStorage\./.test(app))fail("Persistence should go through the storage module");

const refs=new Set();
const addMatches=(source,re)=>{
  for(const match of source.matchAll(re))refs.add(match[1]);
};
addMatches(index,/(?:href|src)="\.\/([^"#?]+)"/g);
addMatches(css,/url\(["']?\.\/([^"')?#]+)["']?\)/g);
addMatches(responsive,/url\(["']?\.\/([^"')?#]+)["']?\)/g);
addMatches(calendarClean,/url\(["']?\.\/([^"')?#]+)["']?\)/g);
addMatches(app,/["']\.\/((?:assets|data|js)\/[^"']+)["']/g);
addMatches(sw,/["']\.\/([^"']+)["']/g);
for(const icon of manifest.icons||[])if(icon.src?.startsWith("./"))refs.add(icon.src.slice(2));
if(manifest.start_url?.startsWith("./")&&!manifest.start_url.includes("#")){
  const ref=manifest.start_url.slice(2);
  if(ref)refs.add(ref);
}
for(const names of Object.values(visual.categories||{})){
  for(const name of names)refs.add("assets/calendar/"+name);
}
for(const ref of refs){
  if(!exists("pages/"+ref))fail("Missing referenced page asset: "+ref);
}

const swShell=[...sw.matchAll(/"\.\/([^"]+)"/g)].map(match=>match[1]).filter(Boolean);
for(const ref of swShell){
  if(!exists("pages/"+ref)&&ref!=="")fail("Service worker shell references missing file: "+ref);
}

console.log("Static validation passed:", {
  sourcePages:pack.sourcePages?.length||0,
  schoolDates:annual.importantDates.length,
  referencedFiles:refs.size,
  cacheEntries:swShell.length
});
