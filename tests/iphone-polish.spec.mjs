import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('long Family and Study cards never clip their content',async({page})=>{
  for(const viewport of [{width:320,height:568},{width:393,height:852},{width:820,height:1180},{width:1440,height:900}]){
    await page.setViewportSize(viewport);
    for(const tab of ['family','study']){
      await page.goto('/#'+tab);
      await expect(page.locator('.screen')).toBeVisible();
      const clipped=await page.locator('.family-actions-card,.notices-card,.study-at-a-glance').evaluateAll(nodes=>nodes.filter(x=>x.scrollHeight>x.clientHeight+2).map(x=>({class:x.className,visible:x.clientHeight,content:x.scrollHeight})));
      expect(clipped).toEqual([]);
      const last=page.locator(tab==='family'?'.unofficial-note':'.study-accordion').last();
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
    }
  }
});

test('Sunday Week opens the coming school week and can go back',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00-04:00'));
  await page.goto('/#week');
  await expect(page.locator('.week-nav')).toContainText('Oct 5 – 9');
  await expect(page.locator('.week-nav')).toContainText('COMING SCHOOL WEEK');
  await page.getByRole('button',{name:'Previous week',exact:true}).click();
  await expect(page.locator('.week-nav')).toContainText('Sep 28 – Oct 2');
});

test('calendar merges repeat notices without losing distinct events',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00-04:00'));
  await page.goto('/#calendar');
  await page.locator('[data-cal-day]').filter({hasText:/^9$/}).click();
  const labels=await page.locator('.calendar-event-list strong').allTextContents();
  expect(labels.filter(x=>x==='12:00 dismissal')).toHaveLength(1);
  expect(labels.some(x=>x.includes('Chick-fil-A orders'))).toBeTruthy();
  expect(labels.some(x=>x.includes('Grammar'))).toBeTruthy();
  await page.locator('[data-cal-day]').filter({hasText:/^12$/}).click();
  const closed=await page.locator('.calendar-event-list strong').allTextContents();
  expect(closed.filter(x=>/^No School/.test(x))).toHaveLength(1);
  expect(closed.join(' ')).toContain('Columbus Day');
});

test('new source information stays unread until acknowledged',async({page})=>{
  const data=await(await page.request.get('/data/study-pack.json')).json();
  await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({json:data}));
  await page.goto('/#today');
  await expect(page.locator('.screen')).toBeVisible();
  await expect(page.locator('.updates-banner')).toHaveCount(0);
  data.pack.parentNotices.push('Friday, Oct. 9: Bring the permission form.');
  await page.reload();
  await expect(page.locator('.updates-banner')).toContainText('1 new school update');
  await page.locator('.updates-banner').click();
  await expect(page.locator('.unread-updates')).toContainText('Bring the permission form');
  await page.reload();
  await expect(page.locator('.unread-updates')).toBeVisible();
  await page.getByRole('button',{name:'Mark updates as read'}).click();
  await expect(page.locator('.unread-updates')).toHaveCount(0);
  await page.getByRole('button',{name:'Today',exact:true}).click();
  await expect(page.locator('.updates-banner')).toHaveCount(0);
});

test('empty practice history does not push down the Study action',async({page})=>{
  await page.goto('/#study');
  await expect(page.locator('.study-games-cta')).toBeVisible();
  await expect(page.locator('[aria-labelledby="weekly-learning-title"]')).toHaveCount(0);
});

test('larger preferred text reflows without hiding Family or Study content',async({page})=>{
  await page.setViewportSize({width:393,height:852});
  for(const tab of ['today','week','calendar','study','family']){
    await page.goto('/#'+tab);
    await expect(page.locator('.screen')).toBeVisible();
    await page.evaluate(()=>document.documentElement.style.fontSize='34px');
    const overflow=await page.locator('.screen').evaluate(e=>e.scrollWidth>e.clientWidth+1);
    expect(overflow,tab+' with enlarged text').toBeFalsy();
    const clipped=await page.locator('.family-actions-card,.notices-card,.study-at-a-glance').evaluateAll(nodes=>nodes.some(x=>x.scrollHeight>x.clientHeight+2));
    expect(clipped,tab+' with enlarged text').toBeFalsy();
  }
});

test('touch navigation reaches the five tabs and Study Games',async({page})=>{
  await page.goto('/#today');
  await expect(page.locator('.screen')).toBeVisible();
  for(const label of ['Week','Calendar','Family','Study','Today']){
    const button=page.getByRole('button',{name:label,exact:true});
    await button.click();
    await expect(button).toHaveAttribute('aria-current','page');
    await expect(page.locator('.screen')).toBeVisible();
  }
  await page.getByRole('button',{name:'Study',exact:true}).click();
  await page.locator('.study-games-cta').click();
  await expect(page.locator('.study-game-grid')).toBeVisible();
});

test('Study subject bullets reserve space and never collide with copy',async({page})=>{
  await page.setViewportSize({width:393,height:852});
  await page.goto('/#study');
  await expect(page.locator('.study-accordion')).toHaveCount(6);
  const cards=page.locator('.study-accordion');
  for(let i=0;i<await cards.count();i++){
    const card=cards.nth(i);
    await card.evaluate(el=>{el.open=true});
    const items=card.locator('li');
    for(let j=0;j<await items.count();j++){
      const item=items.nth(j);
      const text=(await item.innerText()).trim();
      expect(text.startsWith('✓'),`subject ${i+1} item ${j+1} duplicates its marker in text`).toBeFalsy();
      const geometry=await item.evaluate(el=>{
        const style=getComputedStyle(el);
        const before=getComputedStyle(el,'::before');
        const columns=style.gridTemplateColumns.split(/\s+/).map(value=>parseFloat(value)).filter(Number.isFinite);
        return {
          display:style.display,
          columns,
          minWidth:style.minWidth,
          beforeContent:before.content,
          beforePosition:before.position
        };
      });
      expect(geometry.display).toBe('grid');
      expect(geometry.columns[0]).toBeGreaterThanOrEqual(18);
      expect(geometry.beforeContent).toContain('✓');
      expect(geometry.beforePosition).toBe('static');
    }
  }
});

test('visual integrity audit keeps every primary screen inside the app canvas',async({page})=>{
  for(const viewport of [{width:393,height:852},{width:820,height:1180}]){
    await page.setViewportSize(viewport);
    for(const tab of ['today','week','calendar','study','family']){
      await page.goto('/#'+tab);
      const screen=page.locator('.screen');
      await expect(screen).toBeVisible();
      const audit=await screen.evaluate(el=>{
        const root=el.getBoundingClientRect();
        const offenders=[];
        const nodes=[...el.querySelectorAll('section,details,.future-card,.lunch-card,.study-games-cta,.calendar-card,.calendar-day-card')];
        for(const node of nodes){
          const style=getComputedStyle(node);
          if(style.display==='none'||style.visibility==='hidden')continue;
          const rect=node.getBoundingClientRect();
          if(rect.width<1||rect.height<1)continue;
          const clipsX=style.overflowX==='hidden'||style.overflowX==='clip';
          if(rect.left<root.left-2||rect.right>root.right+2||(!clipsX&&node.scrollWidth>node.clientWidth+2)){
            offenders.push({
              cls:node.className||node.tagName,
              left:Math.round(rect.left-root.left),
              right:Math.round(rect.right-root.right),
              visible:node.clientWidth,
              content:node.scrollWidth,
              overflowX:style.overflowX
            });
          }
        }
        return {
          pageOverflow:document.documentElement.scrollWidth>window.innerWidth+1,
          screenOverflow:el.scrollWidth>el.clientWidth+1,
          offenders
        };
      });
      expect(audit.pageOverflow,`${tab} page overflows at ${viewport.width}px`).toBeFalsy();
      expect(audit.screenOverflow,`${tab} screen overflows at ${viewport.width}px`).toBeFalsy();
      expect(audit.offenders,`${tab} contains clipped or out-of-canvas cards at ${viewport.width}px`).toEqual([]);
    }
  }
});



test('Study Hub loading shell keeps the first legacy action stable',async({page})=>{
  for(const viewport of [{width:393,height:852},{width:768,height:1024}]){
    await page.setViewportSize(viewport);
    await page.route('**/data/schoolwork.json',async route=>{
      await new Promise(resolve=>setTimeout(resolve,700));
      await route.continue();
    });
    await page.route('**/data/study-archive.json',async route=>{
      await new Promise(resolve=>setTimeout(resolve,700));
      await route.continue();
    });
    await page.goto('/#study');
    const host=page.locator('#study-hub');
    await expect(host).toHaveAttribute('data-study-state','loading',{timeout:10_000});
    await expect(host.locator('[role="status"]')).toContainText('Opening your study collection');
    const legacy=page.locator('.study-at-a-glance');
    await expect(legacy).toBeVisible();
    const before=await legacy.evaluate(el=>el.getBoundingClientRect().top);
    await expect(host).toHaveAttribute('data-study-state','ready',{timeout:10_000});
    await expect(host.locator('.hub-tabs button')).toHaveCount(4);
    const after=await legacy.evaluate(el=>el.getBoundingClientRect().top);
    expect(Math.abs(after-before),`Study legacy shift at ${viewport.width}px`).toBeLessThanOrEqual(8);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    expect(overflow).toBeFalsy();
    await page.unroute('**/data/schoolwork.json');
    await page.unroute('**/data/study-archive.json');
  }
});

test('Study Hub load failure keeps legacy study content usable and retry visible',async({page})=>{
  await page.setViewportSize({width:393,height:852});
  await page.route('**/data/schoolwork.json',route=>route.abort());
  await page.goto('/#study');
  const host=page.locator('#study-hub');
  await expect(host).toHaveAttribute('data-study-state','error',{timeout:10_000});
  await expect(host.getByRole('button',{name:'Try again'})).toBeVisible();
  await expect(page.locator('.study-at-a-glance')).toBeVisible();
  await expect(page.locator('.study-games-cta')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow).toBeFalsy();
});
