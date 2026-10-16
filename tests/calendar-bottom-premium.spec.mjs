import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.use({serviceWorkers:'block'});
const fixed=new Date('2026-10-13T16:00:00Z');
async function load(page) {
  await page.clock.setFixedTime(fixed);
  await page.goto('/#calendar');
  await expect(page.locator('.calendar-studio')).toBeVisible();
}
test('polished lower calendar has scannable date groups and all source-backed events',async({page})=>{
  await load(page);
  const present=page.locator('.current-month-summary');
  await expect(present.locator('.cal-card-heading')).toContainText('Coming in October');
  await expect(present.locator('.cal-date-row')).toHaveCount(5);
  const group=present.locator('.cal-date-row').filter({hasText:'Wed 14'});
  await expect(group).toContainText('Progress Reports Sent Home — Sign & Return');
  await expect(group.locator('li')).toHaveCount(4);
  const next=page.locator('.next-month-card');
  await expect(next.locator('.cal-card-heading')).toContainText('Coming in November');
  await expect(next).toContainText('Free Diocesan Family Festival');
  await expect(next).toContainText('12:00 dismissal');
  await expect(present.locator('.agenda-lunch')).toHaveCount(0);
});
test('weekly school plan is open by default, lunches and tests remain fully available',async({page})=>{
  await load(page);
  const disclosure=page.locator('.calendar-more');
  await expect(disclosure).toHaveAttribute('open','');
  await expect(disclosure.locator('.cal-weekly-heading')).toContainText('Weekly lunches and tests');
  await expect(disclosure.locator('.week-lunches .week-overview-row')).toHaveCount(5);
  await expect(disclosure.locator('.week-lunches')).toContainText('Meatballs in sauce');
  await expect(disclosure.locator('.week-tests')).toContainText('Math (subtraction)');
  await disclosure.locator('summary').click();
  await expect(disclosure).not.toHaveAttribute('open','');
  await disclosure.locator('summary').click();
  await expect(disclosure.locator('.week-overview-grid')).toBeVisible();
});
test('specials are clean and sourced with all five days intact',async({page})=>{
  await load(page);
  const specials=page.locator('.specials-card');
  await expect(specials.locator('.cal-card-heading')).toContainText('Specials');
  await expect(specials.locator('.special-row')).toHaveCount(5);
  await expect(specials).toContainText('Music, Art, Guidance');
  await expect(specials).toContainText('Computer');
  await expect(specials).toContainText('Library');
});
test('footer retains truthful teacher check state and real official links',async({page})=>{
  await load(page);
  const footer=page.locator('.cal-source-footer');
  // The historical test clock may precede a newly refreshed pack. Check the
  // truthful freshness classification from the actual source timestamp rather
  // than hard-coding what a previous week's pack happened to display.
  const expectedFreshness = await page.evaluate(async testedTime => {
    const response = await fetch('./data/study-pack.json', {cache:'no-store'});
    if (!response.ok) throw new Error('School pack unavailable during freshness QA');
    const envelope = await response.json();
    const raw = envelope.sourceLastCheckedAt || envelope.pack?.sourceCheckedAt;
    const checkedMs = Date.parse(raw || '');
    if (!Number.isFinite(checkedMs)) return 'Teacher page check unavailable';
    const hours = (Date.parse(testedTime) - checkedMs) / 3600000;
    if (hours < -0.25) return 'Teacher page check time invalid';
    if (hours > 30) return 'Teacher pages need refresh';
    if (hours > 8) return 'Teacher pages older';
    return 'Teacher pages verified';
  }, fixed.toISOString());
  await expect(footer.locator('.freshness')).toContainText(expectedFreshness);
  await expect(footer.locator('.teacher-live-source')).toHaveAttribute('href','https://sites.google.com/view/abvmgr2/home');
  await expect(footer.locator('.calendar-source-link a')).toHaveAttribute('href','https://www.assumptionbvmschool.net/about/calendar');
  await expect(footer.locator('.teacher-live-source')).toHaveAttribute('rel',/noopener noreferrer/);
});
test('lower calendar visual is compact, readable, accessible and unclipped',async({page},info)=>{
  for(const width of [320,375,390,430,768,1024,1440]){
    await page.setViewportSize({width,height:852});await load(page);
    const area=page.locator('.cal-secondary');
    const props=await area.evaluate(n=>({scroll:n.scrollWidth,client:n.clientWidth}));
    expect(props.scroll,width+' bottom overflow').toBeLessThanOrEqual(props.client+1);
    await expect(page.locator('.cal-secondary>.compact-month-card')).toHaveCount(2);
    const labels=await page.locator('.cal-date-row li').evaluateAll(nodes=>nodes.map(n=>({font:parseFloat(getComputedStyle(n).fontSize),height:n.scrollHeight,client:n.clientHeight})));
    for(const x of labels){expect(x.font,width+' event label').toBeGreaterThanOrEqual(13);expect(x.height).toBeLessThanOrEqual(x.client+1);}
    const a11y=await new AxeBuilder({page}).include('.cal-secondary').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(a11y.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
    await page.locator('.cal-secondary').scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath('bottom-'+width+'.png'),animations:'disabled'});
  }
});

test('expanded weekly header keeps its icon and title upright',async({page})=>{
  await load(page);
  const rotated=await page.locator('.calendar-more>summary .cal-section-icon,.calendar-more>summary .cal-heading-copy').evaluateAll(nodes=>nodes.map(n=>({name:n.className,transform:getComputedStyle(n).transform})));
  expect(rotated.map(x=>x.transform)).toEqual(['none','none']);
});
