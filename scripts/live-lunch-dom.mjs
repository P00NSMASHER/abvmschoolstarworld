import { expect } from '@playwright/test';

// A live school-data render can detach a previously resolved card between the
// successful content assertion and the screenshot scroll. Re-resolve the same
// locator for a bounded interval; a persistent missing/unstable card still fails.
export async function scrollLiveElementAfterRepaint(locator, { timeoutMs = 12000 } = {}) {
  await expect(async () => {
    await locator.scrollIntoViewIfNeeded({ timeout: Math.min(2000, timeoutMs) });
  }).toPass({ timeout: timeoutMs, intervals: [100, 250, 500] });
}
