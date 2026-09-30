import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#games');
  await expect(page.locator('.study-game-grid')).toBeVisible({ timeout: 10_000 });
});

test('Study Games consumes generated content-pipeline questions and validates the combined catalog', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const pack = structuredClone(envelope.pack);
    pack.contentPipeline = {
      schemaVersion: 1,
      sourceHash: 'pipeline-browser-test',
      questions: [{
        id: 'auto-pipeline-browser-smoke',
        subject: 'Math',
        skill: 'addition-within-20',
        questionType: 'direct',
        prompt: 'A tray has 7 blue blocks and 5 red blocks. How many blocks are there altogether?',
        choices: ['12', '11', '13'],
        answer: '12',
        explanation: '7 + 5 = 12.',
        hint: 'Add the two groups together.',
        sourceFact: 'Verified Grade 2 skill: Addition within 20',
        standards: ['CCSS.2.OA.B.2'],
        domain: 'Numbers and operations',
        dok: 2,
        difficulty: 2,
      }],
    };
    const catalog = window.ABVMStudyGames.buildCatalog(pack, { sourceKey: 'pipeline-browser-test' });
    return {
      ids: catalog.questions.map(question => question.id),
      issues: window.ABVMStudyGames.validateCatalog(catalog),
      question: catalog.questions.find(question => question.id === 'auto-pipeline-browser-smoke') || null,
    };
  });

  expect(result.issues).toEqual([]);
  expect(result.ids).toContain('auto-pipeline-browser-smoke');
  expect(result.question?.tier).toBe('material');
  expect(result.question?.choices).toHaveLength(3);
  expect(result.question?.answer).toBe('12');
});


test('Study Games does not bypass SOURCE_INSUFFICIENT vocabulary coverage with its legacy glossary', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const pack = structuredClone(envelope.pack);
    pack.contentPipeline = {
      schemaVersion: 2,
      sourceHash: 'vocab-source-insufficient-test',
      skills: [],
      questions: [],
      coverage: [{
        topic: 'Reading / ELA vocabulary definitions',
        subject: 'Reading / ELA',
        status: 'SOURCE_INSUFFICIENT',
      }],
    };
    const catalog = window.ABVMStudyGames.buildCatalog(pack, { sourceKey: 'vocab-source-insufficient-test' });
    return catalog.questions.filter(question => question.skill === 'vocabulary-in-context').map(question => question.id);
  });

  expect(result).toEqual([]);
});


test('legacy reading material cannot outrank the verified pipeline with unlisted skills', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const pack = structuredClone(envelope.pack);
    pack.contentPipeline = {
      schemaVersion: 2,
      sourceHash: 'reading-filter-test',
      skills: [
        { id: 'theme', subject: 'Reading / ELA' },
        { id: 'visualize', subject: 'Reading / ELA' },
        { id: 'dialogue', subject: 'Reading / ELA' },
      ],
      questions: [],
      coverage: [],
    };
    const catalog = window.ABVMStudyGames.buildCatalog(pack, { sourceKey: 'reading-filter-test' });
    return catalog.questions
      .filter(question => question.tier === 'material' && question.subject === 'Reading / ELA')
      .map(question => question.skill);
  });

  expect(result).toContain('theme');
  expect(result).toContain('visualize');
  expect(result).not.toContain('inference');
  expect(result).not.toContain('text-evidence');
});
