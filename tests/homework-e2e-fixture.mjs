export const HOMEWORK_E2E_NOW=new Date('2026-10-13T21:00:00-04:00');

export async function installFreshHomeworkFixture(page){
  await page.route('**/data/homework-current.json*',async route=>{
    const response=await route.fetch();
    const source=await response.json();
    await route.fulfill({
      response,
      json:{
        ...source,
        checkedAt:'2026-10-14T00:32:53.326Z',
        firstObservedAt:'2026-10-14T00:32:53.326Z'
      }
    });
  });
}
