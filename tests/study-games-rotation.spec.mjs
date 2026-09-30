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

test('real catalog builder preserves semantic fingerprints for rotation and privacy', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const base = {
      subject: 'Reading / ELA',
      skill: 'theme',
      assessedSkillIds: ['theme'],
      choices: ['A', 'B', 'C'],
      answer: 'A',
      explanation: 'Because A is supported.',
      hint: 'Use the story clue.',
      sourceFact: 'Verified current ABVM skill: theme',
      standards: ['CCSS.RL.2.2'],
      domain: 'Analyzing literary text',
      dok: 2,
      difficulty: 2,
      questionType: 'direct',
      choiceDiagnostics: {},
    };
    const pack = {
      contentPipeline: {
        skills: [{ id: 'theme' }],
        questions: [
          { ...base, id: 'pipeline-dup-a', prompt: 'A child helps a classmate feel welcome at recess. Which theme fits best?', contentFingerprint: 'content-a', variantFingerprint: 'shared-semantic' },
          { ...base, id: 'pipeline-dup-b', prompt: 'A student invites someone new to join a game. Which theme fits best?', contentFingerprint: 'content-b', variantFingerprint: 'shared-semantic' },
          { ...base, id: 'pipeline-unique', prompt: 'Friends include a new classmate during an activity. Which theme fits best?', contentFingerprint: 'content-c', variantFingerprint: 'unique-semantic' },
        ],
      },
      subjects: [],
    };
    const catalog = engine.buildCatalog(pack, { sourceKey: 'pipeline-fingerprint-pack' });
    const pipeline = catalog.questions.filter(q => q.id.startsWith('pipeline-'));
    const selected = engine.selectQuestions(
      { sourceKey: catalog.sourceKey, questions: pipeline },
      { count: 3, seed: 'pipeline-integration' }
    );
    selected.forEach(question => engine.markQuestionShown(question, catalog.sourceKey));
    const serialized = JSON.stringify(
      Object.entries(localStorage).filter(([key]) => key.startsWith('abvm-study-rotation:v1:'))
    );
    return {
      fingerprints: pipeline.map(q => ({ id:q.id, content:q.contentFingerprint, variant:q.variantFingerprint })),
      selectedVariants: selected.map(q => q.variantFingerprint),
      serialized,
    };
  });

  expect(result.fingerprints).toEqual([
    { id:'pipeline-dup-a', content:'content-a', variant:'shared-semantic' },
    { id:'pipeline-dup-b', content:'content-b', variant:'shared-semantic' },
    { id:'pipeline-unique', content:'content-c', variant:'unique-semantic' },
  ]);
  expect(result.selectedVariants).toHaveLength(2);
  expect(new Set(result.selectedVariants).size).toBe(2);
  expect(result.selectedVariants.filter(v => v === 'shared-semantic')).toHaveLength(1);
  expect(result.serialized).not.toContain('pipeline-dup-a');
  expect(result.serialized).not.toContain('pipeline-dup-b');
  expect(result.serialized).not.toContain('shared-semantic');
  expect(result.serialized).not.toContain('content-a');
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
    first.forEach(question => engine.markQuestionShown(question, catalog.sourceKey));
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

test('unshown selected questions do not enter the cooldown history', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const questions = Array.from({ length: 6 }, (_, i) => ({
      id: 'seen-only-' + i,
      skill: 'theme',
      subject: 'Reading / ELA',
      tier: 'material',
      difficulty: 2,
      questionType: ['direct', 'transfer', 'reasoning'][i % 3],
      variantFingerprint: 'seen-only-semantic-' + i,
    }));
    const catalog = { sourceKey: 'seen-only-pack', questions };
    const first = engine.selectQuestions(catalog, { count: 3, seed: 'first' });
    engine.markQuestionShown(first[0], catalog.sourceKey);
    const second = engine.selectQuestions(catalog, { count: 3, seed: 'second' });
    return {
      shown: first[0].variantFingerprint,
      unshown: first.slice(1).map(q => q.variantFingerprint),
      second: second.map(q => q.variantFingerprint),
    };
  });

  expect(result.second).not.toContain(result.shown);
  expect(result.unshown.some(v => result.second.includes(v))).toBe(true);
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

test('selector pulls an alternate representation before selecting a third identical type', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const questions = [
      ...Array.from({ length:6 }, (_, i) => ({
        id:'d' + i, skill:'single-skill', subject:'Reading / ELA', tier:'material',
        difficulty:2, questionType:'direct', variantFingerprint:'direct-' + i,
      })),
      { id:'t0', skill:'single-skill', subject:'Reading / ELA', tier:'material', difficulty:2, questionType:'transfer', variantFingerprint:'transfer-0' },
      { id:'r0', skill:'single-skill', subject:'Reading / ELA', tier:'material', difficulty:2, questionType:'reasoning', variantFingerprint:'reasoning-0' },
    ];
    return engine.selectQuestions({ sourceKey:'selection-type-pack', questions }, { count:3, seed:'seed-2' })
      .map(q => q.questionType);
  });

  expect(result).toHaveLength(3);
  expect(result.some(type => type !== 'direct')).toBe(true);
  expect(result[0] === result[1] && result[1] === result[2]).toBe(false);
});

test('ordering finds a non-repetitive arrangement when the greedy first choice would create a type triple', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const questions = [
      { id:'a-direct-1', skill:'skill-a', subject:'Reading / ELA', tier:'material', difficulty:2, questionType:'direct', variantFingerprint:'a-direct-1' },
      { id:'a-direct-2', skill:'skill-a', subject:'Reading / ELA', tier:'material', difficulty:2, questionType:'direct', variantFingerprint:'a-direct-2' },
      { id:'b-direct', skill:'skill-b', subject:'Reading / ELA', tier:'material', difficulty:2, questionType:'direct', variantFingerprint:'b-direct' },
      { id:'b-transfer', skill:'skill-b', subject:'Reading / ELA', tier:'material', difficulty:2, questionType:'transfer', variantFingerprint:'b-transfer' },
    ];
    return engine.selectQuestions({ sourceKey:'ordering-counterexample-pack', questions }, { count:4, seed:'ordering-counterexample' })
      .map(q => ({ skill:q.skill, type:q.questionType }));
  });

  expect(result).toHaveLength(4);
  for (let i = 1; i < result.length; i += 1) expect(result[i].skill).not.toBe(result[i - 1].skill);
  for (let i = 2; i < result.length; i += 1) {
    expect(result[i].type === result[i - 1].type && result[i - 1].type === result[i - 2].type).toBe(false);
  }
});

test('diversity can relax cooldown freshness when that prevents a repetitive run', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const make = (id, skill, type, fp) => ({
      id, skill, subject: 'Reading / ELA', tier: 'material', difficulty: 2,
      questionType: type, variantFingerprint: fp,
    });
    const catalog = {
      sourceKey: 'diversity-relax-pack',
      questions: [
        make('a1','theme','direct','a1'),
        make('a2','theme','direct','a2'),
        make('a3','theme','direct','a3'),
        make('b1','visualize','transfer','b1'),
      ],
    };
    // Make the only alternate skill/type "recent" before selection.
    engine.markQuestionShown(catalog.questions[3], catalog.sourceKey);
    return engine.selectQuestions(catalog, { count: 3, seed: 'diversity-relax' })
      .map(q => ({ skill:q.skill, type:q.questionType, fp:q.variantFingerprint }));
  });
  expect(result.some(row => row.skill === 'visualize')).toBe(true);
  for (let i = 1; i < result.length; i += 1) {
    expect(result[i].skill === result[i-1].skill && result.some(row => row.skill !== result[i].skill)).toBe(false);
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


test('re-rendering the same visible question does not crowd cooldown history', async ({ page }) => {
  const result = await page.evaluate(() => {
    const engine = window.ABVMStudyGames;
    const q = {
      id: 'rerender-question',
      skill: 'theme',
      subject: 'Reading / ELA',
      tier: 'material',
      difficulty: 2,
      questionType: 'direct',
      variantFingerprint: 'rerender-semantic',
    };
    for (let i = 0; i < 12; i += 1) engine.markQuestionShown(q, 'rerender-pack');
    const entries = Object.entries(localStorage).filter(([key]) => key.startsWith('abvm-study-rotation:v1:'));
    const parsed = entries.map(([, value]) => JSON.parse(value));
    return parsed.flatMap(row => row.recent || []);
  });
  expect(result).toHaveLength(1);
  expect(result[0].skill).toBe('theme');
  expect(result[0].type).toBe('direct');
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
    const firstCatalog = { sourceKey: 'source-A', questions };
    const first = engine.selectQuestions(firstCatalog, { count: 2, seed: 'same-seed' });
    first.forEach(question => engine.markQuestionShown(question, firstCatalog.sourceKey));
    const [historyKey, historyValue] = Object.entries(localStorage).find(([key]) => key.startsWith('abvm-study-rotation:v1:'));
    const legacy = JSON.parse(historyValue);
    legacy.recent[0].at = 123456789;
    localStorage.setItem(historyKey, JSON.stringify(legacy));
    engine.selectQuestions(firstCatalog, { count: 2, seed: 'privacy-migration' });
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
  expect(result.serialized).not.toContain('"at"');
});
