import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('abvm-study-rotation:v1:')) localStorage.removeItem(key);
    }
  });
});

test('semantic cooldown prefers unseen variants across sessions and relaxes safely when exhausted', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const questions = Array.from({ length: 8 }, (_, i) => ({
      id: 'cooldown-' + i,
      skill: 'theme',
      subject: 'Reading / ELA',
      tier: 'material',
      difficulty: 2,
      questionType: i % 3 === 0 ? 'direct' : i % 3 === 1 ? 'transfer' : 'reasoning',
      variantFingerprint: 'semantic-' + i,
    }));
    const catalog = { sourceKey: 'cooldown-pack', questions };
    const first = engine.selectQuestions(catalog, { count: 4, seed: 'round-1' });
    const second = engine.selectQuestions(catalog, { count: 4, seed: 'round-2' });
    const third = engine.selectQuestions(catalog, { count: 4, seed: 'round-3' });
    return {
      first: first.map(q => q.variantFingerprint),
      second: second.map(q => q.variantFingerprint),
      third: third.map(q => q.variantFingerprint),
    };
  });

  expect(new Set([...result.first, ...result.second]).size).toBe(8);
  expect(result.first.filter(v => result.second.includes(v))).toEqual([]);
  expect(result.third).toHaveLength(4);
});

test('three or more eligible skills use a dynamic cap of two and avoid back-to-back skills', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const questions = [];
    for (const skill of ['theme', 'visualize', 'dialogue']) {
      for (let i = 0; i < 5; i += 1) {
        questions.push({
          id: skill + '-' + i,
          skill,
          subject: 'Reading / ELA',
          tier: 'material',
          difficulty: 2,
          questionType: ['direct', 'transfer', 'reasoning'][i % 3],
          variantFingerprint: skill + '-semantic-' + i,
        });
      }
    }
    const selected = engine.selectQuestions({ sourceKey: 'three-skill-pack', questions }, { count: 6, seed: 'balanced' });
    return selected.map(q => ({ skill: q.skill, type: q.questionType }));
  });

  const counts = result.reduce((all, row) => ({ ...all, [row.skill]: (all[row.skill] || 0) + 1 }), {});
  expect(Object.values(counts).every(value => value <= 2)).toBe(true);
  for (let i = 1; i < result.length; i += 1) expect(result[i].skill).not.toBe(result[i - 1].skill);
});

test('two eligible skills may use three each without deadlocking a six-question round', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const questions = [];
    for (const skill of ['long-short-a', 'suffix-ed-ing']) {
      for (let i = 0; i < 5; i += 1) {
        questions.push({
          id: skill + '-' + i,
          skill,
          subject: 'Spelling / Handwriting',
          tier: 'material',
          difficulty: 2,
          questionType: ['direct', 'transfer', 'reasoning'][i % 3],
          variantFingerprint: skill + '-semantic-' + i,
        });
      }
    }
    return engine.selectQuestions({ sourceKey: 'two-skill-pack', questions }, { count: 6, seed: 'balanced-two' }).map(q => q.skill);
  });

  expect(result).toHaveLength(6);
  const counts = result.reduce((all, skill) => ({ ...all, [skill]: (all[skill] || 0) + 1 }), {});
  expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(3);
});

test('selector avoids three identical question types in a row when another type is available', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const types = ['direct', 'direct', 'direct', 'direct', 'transfer', 'reasoning', 'transfer', 'reasoning'];
    const questions = types.map((questionType, i) => ({
      id: 'type-' + i,
      skill: 'sentence-types',
      subject: 'Reading / ELA',
      tier: 'material',
      difficulty: 2,
      questionType,
      variantFingerprint: 'type-semantic-' + i,
    }));
    return engine.selectQuestions({ sourceKey: 'type-pack', questions }, { count: 8, seed: 'type-balance' }).map(q => q.questionType);
  });

  let run = 1;
  for (let i = 1; i < result.length; i += 1) {
    run = result[i] === result[i - 1] ? run + 1 : 1;
    expect(run).toBeLessThanOrEqual(2);
  }
});

test('different IDs with the same semantic fingerprint cannot both enter one round', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const questions = [
      { id: 'dup-a', skill: 'theme', subject: 'Reading / ELA', tier: 'material', difficulty: 2, questionType: 'direct', variantFingerprint: 'same-semantic' },
      { id: 'dup-b', skill: 'theme', subject: 'Reading / ELA', tier: 'material', difficulty: 2, questionType: 'transfer', variantFingerprint: 'same-semantic' },
      { id: 'unique-a', skill: 'theme', subject: 'Reading / ELA', tier: 'material', difficulty: 2, questionType: 'reasoning', variantFingerprint: 'unique-a' },
      { id: 'unique-b', skill: 'theme', subject: 'Reading / ELA', tier: 'material', difficulty: 2, questionType: 'transfer', variantFingerprint: 'unique-b' },
      { id: 'unique-c', skill: 'theme', subject: 'Reading / ELA', tier: 'material', difficulty: 2, questionType: 'direct', variantFingerprint: 'unique-c' },
    ];
    return engine.selectQuestions({ sourceKey: 'semantic-duplicate-pack', questions }, { count: 4, seed: 'semantic-duplicate' })
      .map(q => q.variantFingerprint);
  });

  expect(result).toHaveLength(4);
  expect(new Set(result).size).toBe(4);
  expect(result.filter(v => v === 'same-semantic')).toHaveLength(1);
});

test('rotation history is source-scoped and stores no question text or answer content', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const questions = Array.from({ length: 4 }, (_, i) => ({
      id: 'private-question-' + i,
      skill: 'subtraction-within-12',
      subject: 'Math',
      tier: 'material',
      difficulty: 2,
      questionType: 'direct',
      variantFingerprint: 'private-semantic-' + i,
      prompt: 'PRIVATE PROMPT ' + i,
      answer: 'PRIVATE ANSWER ' + i,
    }));
    const first = engine.selectQuestions({ sourceKey: 'source-A', questions }, { count: 2, seed: 'same-seed' });
    const isolated = engine.selectQuestions({ sourceKey: 'source-B', questions }, { count: 2, seed: 'same-seed' });
    const rotationEntries = Object.entries(localStorage).filter(([key]) => key.startsWith('abvm-study-rotation:v1:'));
    return {
      first: first.map(q => q.variantFingerprint),
      isolated: isolated.map(q => q.variantFingerprint),
      serialized: JSON.stringify(rotationEntries),
    };
  });

  expect(result.isolated).toEqual(result.first);
  expect(result.serialized).not.toContain('PRIVATE PROMPT');
  expect(result.serialized).not.toContain('PRIVATE ANSWER');
  expect(result.serialized).not.toContain('private-question-');
  expect(result.serialized).not.toContain('private-semantic-');
});
