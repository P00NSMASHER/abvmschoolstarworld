from pathlib import Path
p = Path('tests/gold-standard.spec.mjs')
s = p.read_text()
a = s.index('test("Sept 28 Today shows only Mass and daily reading"')
b = s.index('\n});', a) + len('\n});')
fixture = '''test("Sept 28 task-policy fixture keeps Mass and reading without routine clutter",async({page,browser})=>{
  const source=await (await page.request.get("/data/study-pack.json")).json();
  const context=await browser.newContext({serviceWorkers:"block"});
  const fixturePage=await context.newPage();
  await fixturePage.clock.setFixedTime(new Date("2026-09-28T12:00:00Z"));
  const homework=[
    {task:"Attend Mass",subject:"Religion"},
    {task:"Read",subject:"Reading"},
    {task:"Cover books",subject:"Parent"},
    {task:"Keep Reading Log and Behavior Chart in the HW folder",subject:"Reading"},
    {task:"Return everything in the HW folder",subject:"Homework Folder"}
  ];
  await fixturePage.route("**/data/study-pack.json*",route=>route.fulfill({json:{...source,pack:{...source.pack,homework}}}));
  await fixturePage.goto("http://127.0.0.1:4173/#today");
  const tasks=fixturePage.locator(".today-panel .check-item");
  await expect(tasks).toHaveCount(2);
  await expect(tasks.nth(0)).toContainText("Attend Mass");
  await expect(tasks.nth(1)).toContainText("Read");
  await expect(tasks.nth(1)).toContainText("20 minutes today");
  for(const item of homework.slice(2))await expect(fixturePage.getByText(item.task,{exact:true})).toHaveCount(0);
  homework.shift();
  await fixturePage.reload();
  await expect(tasks).toHaveCount(1);
  await expect(tasks.first()).toContainText("Read");
  await expect(fixturePage.getByText("Attend Mass",{exact:true})).toHaveCount(0);
  await context.close();
});'''
s = s[:a] + fixture + s[b:]
p.write_text(s)
print('Retained the two-task regression with explicit dated inputs; later teacher postings remain authoritative.')
