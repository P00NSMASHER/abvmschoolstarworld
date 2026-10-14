import { test, expect } from '@playwright/test';
import { rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { writePrivateCurriculumPilot } from '../scripts/build-private-curriculum-pilot.mjs';

test.use({serviceWorkers:'block'});

test('offline pilot opens first question, supports keyboard, hint and local-only explanation',async({page})=>{
  const output=writePrivateCurriculumPilot();
  const externalRequests=[];
  page.on('request',request=>{if(/^https?:/i.test(request.url()))externalRequests.push(request.url())});
  try {
    await page.goto(pathToFileURL(output.path).href);
    await expect(page.locator('#counter')).toHaveText('1 of 32');
    await expect(page.locator('#question')).toContainText('At cheer practice');
    await expect(page.getByRole('radio')).toHaveCount(3);
    await page.getByRole('radio').nth(1).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('radio').nth(1)).toBeChecked();
    await page.getByRole('button',{name:'Show hint'}).click();
    await expect(page.locator('#hint')).toBeVisible();
    await page.getByRole('button',{name:'Show explanation'}).click();
    await expect(page.locator('#explanation')).toContainText('Your choice matches the answer key');
    await page.getByRole('button',{name:'Next question'}).click();
    await expect(page.locator('#counter')).toHaveText('2 of 32');
    await expect(page.locator('#question')).toBeFocused();
    await page.reload();
    await expect(page.locator('#counter')).toHaveText('1 of 32');
    await expect(page.getByRole('radio').nth(1)).not.toBeChecked();
    expect(externalRequests).toEqual([]);
  } finally { rmSync(dirname(output.path),{recursive:true,force:true}); }
});

test('narrow-phone offline pilot offers accessible reset, previous and next without clipping',async({page})=>{
  const output=writePrivateCurriculumPilot();
  try {
    await page.setViewportSize({width:320,height:730});
    await page.goto(pathToFileURL(output.path).href);
    await expect(page.getByRole('button',{name:'Previous question'})).toBeDisabled();
    await page.getByRole('button',{name:'Next question'}).click();
    await expect(page.getByRole('button',{name:'Previous question'})).toBeEnabled();
    await page.getByRole('radio').first().check();
    await page.getByRole('button',{name:'Clear this session'}).click();
    await expect(page.locator('#counter')).toHaveText('1 of 32');
    await expect(page.getByRole('radio').first()).not.toBeChecked();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  } finally { rmSync(dirname(output.path),{recursive:true,force:true}); }
});
