export const HOMEWORK_E2E_NOW=new Date('2026-10-13T21:00:00-04:00');

// A historical teacher-confirmed Math + Spelling example, used ONLY in tests.
// Never infer today's assignments from this fixture or write it to pages/data.
export const HISTORICAL_HOMEWORK_E2E_FEED=Object.freeze({
  schemaVersion:1,
  sourceUrl:'https://sites.google.com/view/abvmgr2/homework',
  sourceDateProvided:false,
  status:'assignments',
  checkedAt:'2026-10-14T00:32:53.326Z',
  firstObservedAt:'2026-10-14T00:32:53.326Z',
  contentHash:'5632e315601ca9969a13a72c942f0abe52861d76793c51040678f4e8175b2e6a',
  assignments:[
    {subject:'Math',task:'Page 22'},
    {subject:'Spelling',task:'Spelling Choice Board activity'}
  ]
});

export async function installHomeworkFixture(page,overrides={}){
  await page.route('**/data/homework-current.json*',route=>
    route.fulfill({json:{...HISTORICAL_HOMEWORK_E2E_FEED,...overrides}})
  );
}
export async function installFreshHomeworkFixture(page){
  await installHomeworkFixture(page);
}
