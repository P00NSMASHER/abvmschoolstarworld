import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => localStorage.removeItem('abvm-study-recent-variants:v1'));
});

test('consecutive rounds prefer unseen semantic variants and store only opaque fingerprints', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(r => r.json());
    const sourceKey = window.ABVMStudyGames.sourceKeyFromEnvelope(envelope.pack, envelope);
    const catalog = window.ABVMStudyGames.buildCatalog(envelope.pack, { sourceKey });
    const first = window.ABVMStudyGames.selectQuestions(catalog, { count: 5, seed: 'rotation-first', skillStats: {} });
    window.ABVMStudyGames.rememberSelectedVariants(sourceKey, first);
    const second = window.ABVMStudyGames.selectQuestions(catalog, { count: 5, seed: 'rotation-second', skillStats: {} });
    const stored = JSON.parse(localStorage.getItem('abvm-study-recent-variants:v1') || '{}');
    return {
      first: first.map(q => ({ id: q.id, variant: q.variantFingerprint || q.contentFingerprint, skill: q.skill, type: q.questionType })),
      second: second.map(q => ({ id: q.id, variant: q.variantFingerprint || q.contentFingerprint, skill: q.skill, type: q.questionType })),
      stored,
      samplePrompt: first[0]?.prompt,
      sampleAnswer: first[0]?.answer,
    };
  });

  const firstVariants = new Set(result.first.map(q => q.variant));
  expect(result.second.filter(q => firstVariants.has(q.variant))).toHaveLength(0);
  expect(result.stored.variants.length).toBe(5);
  expect(result.stored.variants.every(value => /^[a-f0-9]{8}$/.test(value) || /^\d+$/.test(value))).toBe(true);
  const serialized = JSON.stringify(result.stored);
  expect(serialized).not.toContain(result.samplePrompt);
  expect(serialized).not.toContain(result.sampleAnswer);
});

test('rotation uses dynamic skill diversity and avoids three identical interaction types when alternatives exist', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(r => r.json());
    const sourceKey = window.ABVMStudyGames.sourceKeyFromEnvelope(envelope.pack, envelope);
    const catalog = window.ABVMStudyGames.buildCatalog(envelope.pack, { sourceKey });
    return window.ABVMStudyGames.selectQuestions(catalog, { count: 5, seed: 'diversity-check', skillStats: {} })
      .map(q => ({ skill: q.skill, type: q.questionType }));
  });

  const skillCounts = result.reduce((out, q) => (out[q.skill] = (out[q.skill] || 0) + 1, out), {});
  if (Object.keys(skillCounts).length >= 3) {
    expect(Math.max(...Object.values(skillCounts))).toBeLessThanOrEqual(2);
  }
  for (let i = 2; i < result.length; i += 1) {
    expect(result[i - 2].type === result[i - 1].type && result[i - 1].type === result[i].type).toBe(false);
  }
});

test('a narrow one-skill bank can still fill a full round instead of deadlocking on diversity caps', async ({ page }) => {
  const count = await page.evaluate(() => {
    const questions = Array.from({ length: 8 }, (_, i) => ({
      id: 'one-skill-' + i,
      variantFingerprint: ('0000000' + i).slice(-8),
      contentFingerprint: ('1000000' + i).slice(-8),
      subject: 'Math',
      skill: 'subtraction-within-12',
      questionType: ['direct', 'transfer', 'reasoning'][i % 3],
      tier: 'material',
      difficulty: 2,
    }));
    return window.ABVMStudyGames.selectQuestions({ sourceKey: 'one-skill-pack', questions }, {
      subjects: ['Math'], count: 8, seed: 'one-skill', skillStats: {},
    }).length;
  });
  expect(count).toBe(8);
});
