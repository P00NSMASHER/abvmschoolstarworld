from pathlib import Path

root = Path('.')
def replace(text, before, after):
    count = text.count(before)
    if count != 1:
        raise RuntimeError(f'Expected one source anchor, got {count}: {before[:100]}')
    return text.replace(before, after, 1)

p = root / 'scripts/refresh-teacher-pages.mjs'
s = p.read_text()
s = replace(s, "import { validateUploadedNoticePolicy } from './uploaded-notice-policy.mjs';", "import { validateUploadedNoticePolicy } from './uploaded-notice-policy.mjs';\nimport { refreshLunchPublication } from './lunch-publication.mjs';")
s = replace(s, "const LUNCH_FEED_URL = 'https://abvm-source-bridge-gkj08k.v2.appdeploy.ai/api/lunch-menu';\n", '')
a = s.index('async function fetchLunchFeed(){')
b = s.index('function requireLine(', a)
s = s[:a] + s[b:]
a = s.index('let lunchFeed=null;')
b = s.index("const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));", a)
s = s[:a] + s[b:]
a = s.index('if(lunchFeed){')
b = s.index('pack.vocabulary =', a)
s = s[:a] + "const lunchResult = await refreshLunchPublication(pack, { now: new Date(checkedAt) });\nconsole.log('Lunch source result:', JSON.stringify(lunchResult));\n\n" + s[b:]
p.write_text(s)

p = root / 'pages/app.js'
s = p.read_text()
s = replace(s, 'function lunchForDate(date){\n  return (pack?.lunchMenu||[]).find(x=>sameDay(parseDate(x.day),date))||null;\n}', '''function lunchForDate(date){
  const key=date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
  return [...(pack?.lunchMenu||[]),...(pack?.lunchArchive||[])].find(x=>x.date?x.date===key:sameDay(parseDate(x.day),date))||null;
}''')
a = s.index('function lunchUnavailableText(date){')
b = s.index('function currentTest(){', a)
s = s[:a] + '''function lunchUnavailableText(date){
  return "Lunch menu not yet verified for "+MONTHS[date.getMonth()]+" "+date.getDate()+".";
}
function lunchCardHtml(date,lunch){
  const closed=lunch?.status==="no-school"||eventItemsForDate(date).some(e=>kindClass(e)==="closed");
  if([0,6].includes(date.getDay()))return "";
  const message=closed?"No school lunch":lunch?lunchText(lunch):lunchUnavailableText(date);
  const retained=lunch&&!closed&&pack?.lunchMenuSource?.retrievalState!=="verified";
  return '<section class="lunch-card'+(!lunch&&!closed?' lunch-missing':'')+'"><span aria-hidden="true">🍎</span><div><p>SCHOOL LUNCH</p><strong>'+esc(message)+'</strong>'+(retained?'<small>Saved school menu · source check needs attention</small>':'')+'</div></section>';
}
''' + s[b:]
s = replace(s, 'const text=lunch?lunchText(lunch):(closed||weekend?"No school lunch":lunchUnavailableText(date));', 'const text=closed||weekend||lunch?.status==="no-school"?"No school lunch":lunch?lunchText(lunch):lunchUnavailableText(date);')
p.write_text(s)

p = root / 'scripts/check-refresh-health.mjs'
s = p.read_text()
s = replace(s, 'import {appendFileSync, readFileSync} from "node:fs";', 'import {appendFileSync, readFileSync} from "node:fs";\nimport {validateLunchPublication} from "./lunch-publication.mjs";')
a = s.index('const MONTH_INDEX=')
b = s.index('function validatePack(', a)
s = s[:a] + s[b:]
a = s.index('  const lunchSource=pack?.lunchMenuSource')
b = s.index('  if(!data?.syncPolicy', a)
s = s[:a] + '  for(const error of validateLunchPublication(pack))errors.push(label+": "+error);\n\n' + s[b:]
s = replace(s, '&& local?.pack?.uploadedNoticeHash===live?.pack?.uploadedNoticeHash;', '&& local?.pack?.uploadedNoticeHash===live?.pack?.uploadedNoticeHash\n    && local?.pack?.lunchMenuHash===live?.pack?.lunchMenuHash;')
s = replace(s, '  "- Expected source pages: **6**",', '  "- Expected source pages: **6**",\n  "- Lunch retrieval: **"+(local.pack?.lunchMenuSource?.retrievalState||"unknown")+"**; reviewed meals: "+(local.pack?.lunchMenu?.length||0),\n  "- Lunch gaps: "+JSON.stringify(local.pack?.lunchMenuSource?.missingDates||[]),')
p.write_text(s)

p = root / 'scripts/build-health-report.mjs'
s = p.read_text()
s = replace(s, '  workflows:{', '  lunch:{status:packData.pack?.lunchMenuSource?.status||"unknown",retrievalState:packData.pack?.lunchMenuSource?.retrievalState||"unknown",days:packData.pack?.lunchMenu?.length||0,missingDates:packData.pack?.lunchMenuSource?.missingDates||[]},\n  workflows:{')
s = replace(s, '  sourceFresh &&', '  sourceFresh &&\n  status.lunch.retrievalState==="verified" &&\n  status.lunch.days>0 &&')
s = replace(s, '  `- **App version:** ${status.appVersion}`,', '  `- **Lunch source:** ${status.lunch.retrievalState}; ${status.lunch.days} reviewed days; missing dates: ${status.lunch.missingDates.join(", ")||"none"}`,\n  `- **App version:** ${status.appVersion}`,')
p.write_text(s)

p = root / 'tests/hardening.spec.mjs'
s = p.read_text()
s = replace(s, '  expect(source).toContain("v70-hardening");', '  expect(source).toMatch(/const CACHE = "abvm-grade2-parent-companion-v[0-9]+-[a-z-]+"/);')
p.write_text(s)

p = root / 'tests/gold-standard.spec.mjs'
s = p.read_text()
s = replace(s, 'test.beforeEach(async({page})=>{\n  await page.goto', 'test.beforeEach(async({page})=>{\n  await page.clock.setFixedTime(new Date("2026-09-28T12:00:00Z"));\n  await page.goto')
s = replace(s, 'toContainText("official October lunch menu has not been posted yet")', 'toContainText("Lunch menu not yet verified for October 1")')
p.write_text(s)

p = root / '.github/workflows/sync-study-pack.yml'
s = p.read_text()
s = replace(s, "      - 'scripts/teacher-page-parsers.mjs'", "      - 'scripts/teacher-page-parsers.mjs'\n      - 'scripts/lunch-publication.mjs'\n      - 'pages/data/lunch-catalog.json'")
p.write_text(s)
print('Applied scoped lunch fixes without altering schoolwork or game questions.')
