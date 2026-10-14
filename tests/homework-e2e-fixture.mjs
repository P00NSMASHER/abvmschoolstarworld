// Deterministic, historically verified October 13 teacher posting.
// Never derive test expectations from the automatically refreshed production feed.
export const HISTORICAL_HOMEWORK_POSTING=Object.freeze({
  schemaVersion:1,
  sourceUrl:'https://sites.google.com/view/abvmgr2/homework',
  sourceDateProvided:false,
  status:'assignments',
  checkedAt:'2026-10-14T00:32:53.326Z',
  firstObservedAt:'2026-10-14T00:32:53.326Z',
  contentHash:'5632e315601ca9969a13a72c942f0abe52861d76793c51040678f4e8175b2e6a',
  assignments:Object.freeze([
    Object.freeze({subject:'Math',task:'Page 22'}),
    Object.freeze({subject:'Spelling',task:'Spelling Choice Board activity'})
  ])
});
export const HOMEWORK_E2E_NOW=new Date('2026-10-13T21:00:00-04:00');

export async function installHomeworkFixture(page,overrides={}){
  // Isolated synthetic HTTP response, unaffected by daily teacher source updates.
  const posting={...HISTORICAL_HOMEWORK_POSTING,...overrides};
  await page.route('**/data/homework-current.json*',route=>
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(posting)})
  );
}
export const installFreshHomeworkFixture=page=>installHomeworkFixture(page);
