import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

// Candidate screenshots are generated from the real, data-backed application
// at the tested branch. The historical iPhone uploads remain the baseline.
test('Today premium signature: mobile layout and retained source-backed actions', async ({ page }, info) => {
  await page.clock.setFixedTime(new Date('2026-10-08T12:00:00-04:00'));
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const width of [375, 390, 402, 430]) {
    await page.setViewportSize({ width, height: 852 });
    await page.goto('/#today');

    const screen = page.locator('.today-screen');
    await expect(screen).toBeVisible();
    await expect(page.locator('.school-photo-hero .hero-photo')).toBeVisible();
    await expect(page.locator('.school-photo-hero')).toContainText('Hi, Emma!');
    await expect(page.locator('.today-primary .priority-card')).toHaveCount(1);
    await expect(page.locator('.study-invitation')).toBeVisible();
    await expect(page.locator('.today-screen > .lunch-card')).toBeVisible();
    await expect(page.locator('.today-panel')).toBeVisible();
    // A timeline event must not repeat as a semantically identical reminder,
    // while additional deadlines and prices stay displayed when distinct.
    const normalizeNotice = value => String(value).toLowerCase()
      .replace(/^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b[^:]{0,45}:\s*/i, '')
      .replace(/\b(?:is|are|was|were)\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
    const eventLabels = await page.locator('.timeline-row strong').allTextContents();
    const reminderLabels = await page.locator('.reminder-line p').allTextContents();
    expect(reminderLabels.map(normalizeNotice).filter(value =>
      eventLabels.map(normalizeNotice).includes(value))).toEqual([]);
    await expect(page.locator('.study-badge-latest')).toBeVisible();
    await expect(page.locator('.freshness')).toBeVisible();

    const metrics = await screen.evaluate(el => {
      const rect = node => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      const hero = el.querySelector('.school-photo-hero');
      const title = hero.querySelector('.hero-copy h2');
      const priority = el.querySelector('.priority-card');
      const study = el.querySelector('.study-invitation');
      const lunch = el.querySelector('.lunch-card');
      const plan = el.querySelector('.today-panel');
      const badge = el.querySelector('.study-badge-surface');
      const actions = [
        el.querySelector('.priority-card .icon-button'),
        study,
        el.querySelector('.study-badge-latest'),
      ].filter(Boolean);
      return {
        screenWidth: el.clientWidth, scrollWidth: el.scrollWidth,
        font: getComputedStyle(title).fontFamily,
        titleFont: parseFloat(getComputedStyle(title).fontSize),
        hero: rect(hero), priority: rect(priority), study: rect(study),
        lunch: rect(lunch), plan: rect(plan), badge: rect(badge),
        actions: actions.map(rect)
      };
    });

    expect(metrics.scrollWidth, JSON.stringify({ width, metrics })).toBeLessThanOrEqual(metrics.screenWidth + 1);
    expect(metrics.titleFont).toBeGreaterThanOrEqual(28);
    expect(metrics.font).toMatch(/-apple-system|BlinkMacSystemFont|Segoe UI/);
    expect(metrics.priority.top).toBeGreaterThan(metrics.hero.top);
    expect(metrics.study.top).toBeGreaterThan(metrics.priority.top);
    expect(metrics.lunch.top).toBeGreaterThan(metrics.study.top);
    expect(metrics.plan.top).toBeGreaterThan(metrics.lunch.top);
    expect(metrics.badge.top).toBeGreaterThan(metrics.plan.top);
    for (const action of metrics.actions) {
      expect(action.width, JSON.stringify({ width, action })).toBeGreaterThanOrEqual(44);
      expect(action.height, JSON.stringify({ width, action })).toBeGreaterThanOrEqual(44);
      expect(action.left).toBeGreaterThanOrEqual(-1);
      expect(action.right).toBeLessThanOrEqual(width + 1);
    }
    if (width === 390) {
      await page.screenshot({ path: info.outputPath('today-premium-390-first-viewport.png'), animations: 'disabled' });
      // Expand the existing scroll surface only for an honest full-content capture.
      await page.addStyleTag({ content: '.phone-app{display:block!important;height:auto!important;min-height:100vh!important;overflow:visible!important}.screen-stack,.today-screen{height:auto!important;overflow:visible!important}.bottom-nav{display:none!important}' });
      await page.screenshot({ path: info.outputPath('today-premium-390-full-content.png'), fullPage: true, animations: 'disabled' });
    }
  }
});

test('Today remains operable with long verified titles and larger interface text', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-08T12:00:00-04:00'));
  await page.setViewportSize({ width: 375, height: 852 });
  await page.goto('/#today');
  await expect(page.locator('.today-primary .priority-card')).toBeVisible();

  await page.locator('.priority-card h3').evaluate(el => {
    el.textContent = 'Spelling, handwriting, sentence types and punctuation review for our classroom';
  });
  expect(await page.locator('.today-screen').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.fontSize = (parseFloat(getComputedStyle(root).fontSize) * 2) + 'px';
  });
  const screen = page.locator('.today-screen');
  expect(await screen.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await expect(page.getByRole('navigation', { name: 'App navigation' }).getByRole('button', { name: 'Study' })).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });

  await page.getByRole('button', { name: 'Start studying' }).click();
  await expect(page.locator('.games-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.locator('.today-panel')).toBeVisible();
  await page.locator('.study-badge-latest').click();
  await expect(page.locator('.badge-collection')).toBeVisible();
});
