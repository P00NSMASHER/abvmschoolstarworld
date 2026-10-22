import test from 'node:test';
import assert from 'node:assert/strict';
import { scrollLiveElementAfterRepaint } from '../scripts/live-lunch-dom.mjs';

test('live lunch scroll retries one detached DOM node and then succeeds', async () => {
  let attempts = 0;
  const locator = {
    async scrollIntoViewIfNeeded() {
      attempts++;
      if (attempts === 1) throw new Error('locator.scrollIntoViewIfNeeded: Element is not attached to the DOM');
    },
  };
  await scrollLiveElementAfterRepaint(locator, { timeoutMs: 2000 });
  assert.equal(attempts, 2);
});

test('live lunch scroll cannot certify a persistently missing or detached node', async () => {
  let attempts = 0;
  const locator = {
    async scrollIntoViewIfNeeded() {
      attempts++;
      throw new Error('locator.scrollIntoViewIfNeeded: Element is not attached to the DOM');
    },
  };
  await assert.rejects(scrollLiveElementAfterRepaint(locator, { timeoutMs: 450 }));
  assert.ok(attempts > 0);
});
