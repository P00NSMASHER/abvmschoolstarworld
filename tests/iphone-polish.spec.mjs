import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

const gameModes=['reading','spelling','math','religion','mix'];

async function expectGameMenu(page){
  const grid=page.locator('.study-game-grid');
  await expect(grid).toBeVisible({timeout:10_000});
  const tiles=grid.locator(':scope > .study-game-tile');
  await expect(tiles).toHaveCount(5);
  expect(await tiles.evaluateAll(nodes=>nodes.map(node=>node.dataset.gameStart))).toEqual(gameModes);
  return grid;
}

async function openNotes(page){
  await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state',/ready|partial/);
  const notes=page.locator('details[data-study-notes]');
  if(!await notes.evaluate(node=>node.open))await notes.locator(':scope > summary').click();
  await expect(notes).toHaveAttribute('open','');
  const lessons=notes.locator('.game-material-lesson');
  await expect(lessons.first()).toBeVisible();
  for(const lesson of await lessons.all()){
    if(!await lesson.evaluate(node=>node.open))await lesson.locator(':scope > summary').click();
  }
  return notes;
}

test('navigation labels reflow at 200 percent text size without overlapping touch targets',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [320,393,820,1440]){
    await page.setViewportSize({width,height:width>=700?1024:852});
    await page.goto('/#today');
    const nav=page.getByRole('navigation',{name:'App navigation'});
    const normal=await nav.locator('button b').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    await page.evaluate(()=>{const root=document.documentElement;root.style.fontSize=2*parseFloat(getComputedStyle(root).fontSize)+'px';});
    const targets=await nav.locator('button').evaluateAll(nodes=>nodes.map(el=>{
      const b=el.getBoundingClientRect(),label=el.querySelector('b'),r=label.getBoundingClientRect();
      return {label:label.textContent,left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height,
        labelLeft:r.left,labelRight:r.right,labelTop:r.top,labelBottom:r.bottom,fontSize:parseFloat(getComputedStyle(label).fontSize)};
    }));
    expect(targets).toHaveLength(4);
    for(const target of targets){
      const context=JSON.stringify({width,target});
      expect(target.width,context).toBeGreaterThanOrEqual(44);expect(target.height,context).toBeGreaterThanOrEqual(44);
      expect(target.fontSize,context).toBeGreaterThanOrEqual(normal*2-.1);
      expect(target.labelLeft,context).toBeGreaterThanOrEqual(target.left-1);expect(target.labelRight,context).toBeLessThanOrEqual(target.right+1);
      expect(target.labelTop,context).toBeGreaterThanOrEqual(target.top-1);expect(target.labelBottom,context).toBeLessThanOrEqual(target.bottom+1);
      expect(target.left,context).toBeGreaterThanOrEqual(-1);expect(target.right,context).toBeLessThanOrEqual(width+1);
    }
    for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++){
      const a=targets[i],b=targets[j];
      const overlapX=Math.min(a.right,b.right)-Math.max(a.left,b.left),overlapY=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
      expect(overlapX>1&&overlapY>1,`${width}px: ${a.label} and ${b.label} overlap`).toBe(false);
    }
    await nav.getByRole('button',{name:'Study',exact:true}).click();
    await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready');
    await expect(nav.getByRole('button',{name:'Study',exact:true})).toHaveAttribute('aria-current','page');
    await page.screenshot({animations:'disabled',path:info.outputPath(`navigation-200-percent-${width}.png`)});
    await page.evaluate(()=>document.documentElement.style.fontSize='');
  }
});

test('long Family and Study cards never clip their content',async({page})=>{
  for(const viewport of [{width:320,height:568},{width:393,height:852},{width:820,height:1180},{width:1440,height:900}]){
    await page.setViewportSize(viewport);
    for(const tab of ['family','study']){
      await page.goto('/#'+tab);
      await expect(page.locator('.screen')).toBeVisible();
      if(tab==='study')await openNotes(page);
      const clipped=await page.locator('.family-actions-card,.notices-card,.game-materials,.game-material-actions,[data-study-notes],.game-material-lesson').evaluateAll(nodes=>nodes.filter(x=>x.scrollHeight>x.clientHeight+2).map(x=>({class:x.className,visible:x.clientHeight,content:x.scrollHeight})));
      expect(clipped).toEqual([]);
      const last=page.locator(tab==='family'?'.unofficial-note':'.game-material-lesson').last();
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
    }
  }
});

test('Sunday Week opens the coming school week and can go back',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00-04:00'));
  await page.goto('/#week');
  await expect(page.locator('.week-nav')).toContainText('Oct 5 – 9');
  await expect(page.locator('.week-nav')).toContainText('THIS SCHOOL WEEK');
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

test('Study Games keeps reports and recommendations absent before and after saved learning',async({page})=>{
  const data=await(await page.request.get('/data/study-pack.json')).json();
  const skills=[...new Set(['place-value',...(data.pack.contentPipeline?.skills||[]).map(row=>row.id)])];
  await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({json:data}));
  await page.goto('/#study');
  for(const seeded of [false,true]){
    if(seeded){
      await page.evaluate(ids=>{
        const now=Date.now(),day=24*60*60*1000;
        const learning=Object.fromEntries(ids.map(id=>[id,{
          Seen:6,Correct:3,IndependentCorrect:1,AssistedCorrect:2,Wrong:3,
          LastSeenAt:now,LastIndependentCorrectAt:now-1000,
          LastResolution:{resolvedAt:now,correct:false,independent:false},
          ConsecutiveWrong:2,
          Review:{version:1,repetitions:0,ease:2.5,intervalDays:1,
            reviewedAt:now-(id==='place-value'?2*day:0),
            dueAt:now+(id==='place-value'?-day:day)}
        }]));
        localStorage.setItem('abvm-study-learning:v2',JSON.stringify(learning));
      },skills);
      await page.reload();
      expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('abvm-study-learning:v2'))['place-value'].Seen)).toBe(6);
    }
    const grid=await expectGameMenu(page);
    await expect(page.locator('.games-screen')).toHaveAttribute('data-study-state','ready',{timeout:10_000});
    await expect(page.locator('[aria-labelledby="weekly-learning-title"],.room-learning-summary,.daily-practice,[aria-label="Skills to revisit"]')).toHaveCount(0);
    await expect(page.getByRole('heading',{name:/^(Learning on this device|Weekly learning|Place value)$/i})).toHaveCount(0);
    const top=await grid.evaluate(node=>node.getBoundingClientRect().top);
    expect(top).toBeLessThan((page.viewportSize()?.height||844)*.98);
  }
});

test('larger preferred text reflows without hiding Family or Study content',async({page})=>{
  await page.setViewportSize({width:393,height:852});
  for(const tab of ['today','week','calendar','study','family']){
    await page.goto('/#'+tab);
    await expect(page.locator('.screen')).toBeVisible();
    if(tab==='study')await openNotes(page);
    await page.evaluate(()=>document.documentElement.style.fontSize='34px');
    const overflow=await page.locator('.screen').evaluate(e=>e.scrollWidth>e.clientWidth+1);
    expect(overflow,tab+' with enlarged text').toBeFalsy();
    const clipped=await page.locator('.family-actions-card,.notices-card,.game-materials,.game-material-actions,[data-study-notes],.game-material-lesson').evaluateAll(nodes=>nodes.some(x=>x.scrollHeight>x.clientHeight+2));
    expect(clipped,tab+' with enlarged text').toBeFalsy();
  }
});

test('touch navigation reaches the four destinations and both calendar views',async({page})=>{
  await page.goto('/#today');
  await expect(page.locator('.screen')).toBeVisible();
  for(const label of ['Calendar','Progress','Study','Today']){
    const button=page.getByRole('button',{name:label,exact:true});
    await button.click();
    await expect(button).toHaveAttribute('aria-current','page');
    await expect(page.locator('.screen')).toBeVisible();
  }
  await page.locator('.bottom-nav [data-tab="calendar"]').click();
  await page.locator('[data-route="week"]').click();
  await expect(page.locator('.week-screen')).toBeVisible();
  await expect(page.locator('.bottom-nav [data-tab="calendar"]')).toHaveAttribute('aria-current','page');
  await page.locator('[data-route="calendar"]').click();
  await expect(page.locator('.calendar-screen')).toBeVisible();
  await expect(page.locator('.bottom-nav [data-tab="calendar"]')).toHaveAttribute('aria-current','page');
  await page.getByRole('button',{name:'Study',exact:true}).click();
  await expectGameMenu(page);
  await page.goto('/#games');
  await expectGameMenu(page);
  await expect(page.getByRole('button',{name:'Study',exact:true})).toHaveAttribute('aria-current','page');
});

test('on-demand lesson bullets reserve space and never collide with copy',async({page})=>{
  await page.setViewportSize({width:393,height:852});
  await page.goto('/#study');
  const notes=await openNotes(page);
  const cards=notes.locator('.game-material-lesson');
  expect(await notes.locator('li').count()).toBeGreaterThan(0);
  for(let i=0;i<await cards.count();i++){
    const card=cards.nth(i);
    const items=card.locator('li');
    for(let j=0;j<await items.count();j++){
      const item=items.nth(j);
      const text=(await item.innerText()).trim();
      expect(/^[✓•]/.test(text),`lesson ${i+1} item ${j+1} duplicates its marker in text`).toBeFalsy();
      const geometry=await item.evaluate(el=>{
        const style=getComputedStyle(el);
        const before=getComputedStyle(el,'::before');
        const list=el.closest('ul');
        const row=el.getBoundingClientRect();
        const parent=list.getBoundingClientRect();
        return {
          display:style.display,
          marker:style.listStyleType,
          markerPosition:style.listStylePosition,
          markerSpace:row.left-parent.left,
          beforeContent:before.content,
          overflows:el.scrollWidth>el.clientWidth+1
        };
      });
      expect(geometry.display).toBe('list-item');
      expect(geometry.marker).toBe('disc');
      expect(geometry.markerPosition).toBe('outside');
      expect(geometry.markerSpace).toBeGreaterThanOrEqual(18);
      expect(geometry.beforeContent).not.toContain('✓');
      expect(geometry.overflows).toBeFalsy();
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
      if(tab==='study')await openNotes(page);
      const audit=await screen.evaluate(el=>{
        const root=el.getBoundingClientRect();
        const offenders=[];
        const nodes=[...el.querySelectorAll('section,details,.future-card,.lunch-card,.study-game-grid,.study-game-tile,.game-material-secondary,.calendar-card,.calendar-day-card')];
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



test('saved-material loading keeps the five subjects playable and the grid stable',async({page})=>{
  const [schoolwork,archive]=await Promise.all([
    page.request.get('/data/schoolwork.json').then(response=>response.json()),
    page.request.get('/data/study-archive.json').then(response=>response.json())
  ]);
  for(const viewport of [{width:393,height:852},{width:768,height:1024}]){
    await page.setViewportSize(viewport);
    let release;
    const pending=new Promise(resolve=>{release=resolve});
    await page.route('**/data/schoolwork.json*',async route=>{
      await pending;
      await route.fulfill({json:schoolwork});
    });
    await page.route('**/data/study-archive.json*',async route=>{
      await pending;
      await route.fulfill({json:archive});
    });
    try{
      await page.goto('/?study-loading-fixture='+viewport.width+'#study',{waitUntil:'domcontentloaded'});
      const host=page.locator('.games-screen');
      const grid=await expectGameMenu(page);
      await expect(host).toHaveAttribute('data-study-state','loading',{timeout:10_000});
      await expect(host.getByRole('status').filter({hasText:'Loading saved materials'})).toBeVisible();
      for(const mode of gameModes){
        await expect(host).toHaveAttribute('data-study-state','loading');
        await grid.locator('[data-game-start="'+mode+'"]').click();
        await expect(page.locator('.game-question-card')).toBeVisible();
        await expect(page.locator('.game-question-card [data-game-answer]')).toHaveCount(3);
        await page.locator('[data-game-home]').click();
        await expectGameMenu(page);
      }
      const before=await grid.evaluate(el=>{const host=el.closest('.screen');return el.getBoundingClientRect().top-host.getBoundingClientRect().top+host.scrollTop;});
      release();
      await expect(host).toHaveAttribute('data-study-state','ready',{timeout:10_000});
      await expectGameMenu(page);
      const after=await grid.evaluate(el=>{const host=el.closest('.screen');return el.getBoundingClientRect().top-host.getBoundingClientRect().top+host.scrollTop;});
      expect(Math.abs(after-before),`Games grid shift at ${viewport.width}px`).toBeLessThanOrEqual(8);
      await expect(page.locator('select[data-study-source]')).toHaveCount(0);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
      expect(overflow).toBeFalsy();
    }finally{
      release();
      await page.unroute('**/data/schoolwork.json*');
      await page.unroute('**/data/study-archive.json*');
    }
  }
});

test('saved-material failure keeps weekly notes and all five subjects usable and retry recovers',async({page})=>{
  await page.setViewportSize({width:393,height:852});
  const [data,schoolwork]=await Promise.all([
    page.request.get('/data/study-pack.json').then(response=>response.json()),
    page.request.get('/data/schoolwork.json').then(response=>response.json())
  ]);
  const note='Compare the hundreds, then the tens and ones.';
  const math=data.pack.subjects.find(row=>row.subject==='Math');
  expect(math).toBeTruthy();
  math.studyNotes=[...(math.studyNotes||[]),note];
  data.pack.sourceHash=String(data.pack.sourceHash||'current')+'-partial-material-notes';
  await page.route('**/data/study-pack-runtime.json*',route=>route.fulfill({json:data}));
  let fail=true;
  await page.route('**/data/schoolwork.json*',route=>fail?route.abort():route.fulfill({json:schoolwork}));
  await page.goto('/#study');
  const host=page.locator('.games-screen');
  await expect(host).toHaveAttribute('data-study-state','partial',{timeout:10_000});
  await expect(host.locator('[data-study-retry]')).toBeVisible();
  const notes=await openNotes(page);
  await expect(notes).toContainText(note);
  for(const mode of gameModes){
    const grid=await expectGameMenu(page);
    await grid.locator('[data-game-start="'+mode+'"]').click();
    await expect(page.locator('.game-question-card')).toBeVisible();
    await expect(page.locator('.game-question-card [data-game-answer]')).toHaveCount(3);
    await page.locator('[data-game-home]').click();
    await expect(host).toHaveAttribute('data-study-state','partial');
  }
  fail=false;
  await host.locator('[data-study-retry]').click();
  await expect(host).toHaveAttribute('data-study-state','ready',{timeout:10_000});
  await expect(host.locator('[data-study-retry]')).toHaveCount(0);
  await expectGameMenu(page);
  await openNotes(page);
  await expect(notes).toContainText(note);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow).toBeFalsy();
});
