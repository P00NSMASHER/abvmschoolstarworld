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


test('skill-restricted selection keeps Test Ready practice inside the verified assessment skill', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const pack = structuredClone(envelope.pack);
    pack.contentPipeline = {
      schemaVersion: 2,
      sourceHash: 'test-ready-selection',
      skills: [
        { id: 'sentence-types', subject: 'Reading / ELA' },
        { id: 'long-short-a', subject: 'Spelling / Handwriting' },
      ],
      questions: [
        {
          id: 'test-ready-sentence-1',
          subject: 'Reading / ELA',
          skill: 'sentence-types',
          questionType: 'direct',
          prompt: 'Which sentence asks a question and needs a question mark at the end?',
          choices: ['Where is my book?', 'Put the book away.', 'My book is blue.'],
          answer: 'Where is my book?',
          explanation: 'A question asks for information.',
          hint: 'Choose the sentence that asks something.',
          sourceFact: 'Verified Grade 2 skill: Types of sentences',
          standards: ['CCSS.L.2.1'],
          domain: 'Language',
          dok: 1,
          difficulty: 2,
        },
        {
          id: 'test-ready-vowel-1',
          subject: 'Spelling / Handwriting',
          skill: 'long-short-a',
          questionType: 'direct',
          prompt: 'Which word has the long a sound made by the a_e pattern?',
          choices: ['game', 'cat', 'map'],
          answer: 'game',
          explanation: 'The final e helps a say its long sound.',
          hint: 'Look for a consonant between a and final e.',
          sourceFact: 'Verified Grade 2 skill: Long a and short a',
          standards: ['CCSS.RF.2.3'],
          domain: 'Foundational reading',
          dok: 2,
          difficulty: 2,
        },
      ],
      coverage: [],
    };
    const catalog = window.ABVMStudyGames.buildCatalog(pack, { sourceKey: 'test-ready-selection' });
    const selected = window.ABVMStudyGames.selectQuestions(catalog, {
      skills: ['sentence-types'],
      count: 5,
      seed: 'test-ready',
      skillStats: {},
      preferredSkills: ['sentence-types'],
    });
    return selected.map(question => ({ id: question.id, skill: question.skill, tier: question.tier }));
  });

  expect(result.length).toBeGreaterThan(0);
  expect(result.every(question => question.skill === 'sentence-types')).toBe(true);
});



test('the content pipeline is authoritative for every legacy material generator', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const pack = structuredClone(envelope.pack);
    const current = pack.contentPipeline || {};
    const skill = (current.skills || []).find(row => (current.questions || []).some(question => question.skill === row.id));
    if (!skill) return { skillId:null, material:[] };
    const questions = (current.questions || []).filter(question => question.skill === skill.id);
    pack.contentPipeline = {
      ...current,
      skills: [skill],
      questions,
      bankFingerprint: 'material-authority-test',
    };
    const catalog = window.ABVMStudyGames.buildCatalog(pack, { sourceKey: 'material-authority-test' });
    return {
      skillId: skill.id,
      material: catalog.questions
        .filter(question => question.tier === 'material')
        .map(question => ({ id: question.id, skill: question.skill, subject: question.subject })),
    };
  });

  expect(result.skillId).toBeTruthy();
  expect(result.material.length).toBeGreaterThan(0);
  expect(result.material.every(question => question.skill === result.skillId)).toBe(true);
});

test('Study Games source identity changes when the certified bank fingerprint changes', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const packA = structuredClone(envelope.pack);
    const packB = structuredClone(envelope.pack);
    packA.contentPipeline = { ...(packA.contentPipeline || {}), bankFingerprint: 'aaaaaaaa' };
    packB.contentPipeline = { ...(packB.contentPipeline || {}), bankFingerprint: 'bbbbbbbb' };
    return {
      a: window.ABVMStudyGames.sourceKeyFromEnvelope(packA, envelope),
      b: window.ABVMStudyGames.sourceKeyFromEnvelope(packB, envelope),
    };
  });

  expect(result.a).not.toBe(result.b);
  expect(result.a).toContain('bank:aaaaaaaa');
  expect(result.b).toContain('bank:bbbbbbbb');
});


test('two distinct misses resolve honestly and record one failed learning opportunity', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.getByRole('button', { name: /Quick Mix/i }).click();
  await expect(page.locator('.game-question-card')).toBeVisible();

  const prompt = await page.locator('.game-question-card h2').textContent();
  const question = await page.evaluate(async currentPrompt => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const catalog = window.ABVMStudyGames.buildCatalog(envelope.pack, {
      sourceKey: window.ABVMStudyGames.sourceKeyFromEnvelope(envelope.pack, envelope),
    });
    const row = catalog.questions.find(item => item.prompt === currentPrompt);
    return row ? { skill: row.skill, answer: row.answer, choices: row.choices } : null;
  }, prompt);
  expect(question).not.toBeNull();

  const wrongs = question.choices.map((choice,index)=>choice!==question.answer?index:-1).filter(index=>index>=0);
  expect(wrongs.length).toBeGreaterThanOrEqual(2);

  const firstWrong=page.locator('.game-answer').nth(wrongs[0]);
  await firstWrong.click();
  await expect(firstWrong).toBeDisabled();
  await expect(page.locator('.game-feedback.retry')).toContainText('Not yet');
  await expect(page.locator('[data-game-next]')).toHaveCount(0);

  await firstWrong.evaluate(button=>button.click());
  await expect(page.locator('[data-game-next]')).toHaveCount(0);

  const secondWrong=page.locator('.game-answer').nth(wrongs[1]);
  await secondWrong.click();
  await expect(secondWrong).toBeDisabled();
  await expect(page.locator('.game-feedback.retry')).toContainText('model answer');
  await expect(page.locator('[data-game-next]')).toBeVisible();

  const stored = await page.evaluate(skill => JSON.parse(localStorage.getItem('abvm-study-learning:v2') || '{}')[skill] || {}, question.skill);
  expect(stored.Seen).toBe(1);
  expect(stored.Wrong).toBe(1);
  expect(stored.Attempts).toBe(2);
  expect(stored.IncorrectAttempts).toBe(2);
  expect(stored.Correct).toBe(0);
  expect(stored.LastResolution?.independent).toBe(false);
});

test('a retry-correct answer is recorded separately from independent first-try mastery', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.getByRole('button', { name: /Quick Mix/i }).click();
  await expect(page.locator('.game-question-card')).toBeVisible();

  const prompt = await page.locator('.game-question-card h2').textContent();
  const question = await page.evaluate(async currentPrompt => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const catalog = window.ABVMStudyGames.buildCatalog(envelope.pack, {
      sourceKey: window.ABVMStudyGames.sourceKeyFromEnvelope(envelope.pack, envelope),
    });
    const row = catalog.questions.find(item => item.prompt === currentPrompt);
    return row ? { skill: row.skill, answer: row.answer, choices: row.choices } : null;
  }, prompt);
  expect(question).not.toBeNull();

  const wrongIndex = question.choices.findIndex(choice => choice !== question.answer);
  const correctIndex = question.choices.findIndex(choice => choice === question.answer);
  await page.locator('.game-answer').nth(wrongIndex).click();
  await expect(page.locator('.game-feedback.retry')).toContainText('Not yet');
  await page.locator('.game-answer').nth(correctIndex).click();
  await expect(page.locator('.game-feedback.correct')).toContainText('worked it out');

  const stored = await page.evaluate(skill => JSON.parse(localStorage.getItem('abvm-study-learning:v2') || '{}')[skill] || {}, question.skill);
  expect(stored.Seen).toBe(1);
  expect(stored.Correct).toBe(1);
  expect(stored.CorrectAfterRetry).toBe(1);
  expect(stored.FirstTryCorrect || 0).toBe(0);
  expect(stored.IndependentCorrect || 0).toBe(0);
  expect(stored.ConsecutiveCorrect).toBe(0);
  expect(stored.LastIndependentAt).toBeUndefined();
  expect(stored.LastResolution?.independent).toBe(false);
});

test('two resolved failures retain the same-skill support and Teach Card contract', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());

  const evidence = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const engine = window.ABVMStudyGames;
    const catalog = engine.buildCatalog(envelope.pack, {
      sourceKey: engine.sourceKeyFromEnvelope(envelope.pack, envelope),
    });
    let current=null,support=null,teach=null;
    for(const candidate of catalog.questions){
      const next=engine.supportQuestion(catalog,candidate,{seed:'support-contract'});
      const card=next&&engine.teachCardFor(next);
      if(next&&card){current=candidate;support=next;teach=card;break;}
    }
    if(!current)return null;
    engine.recordLearning(current,false,{attemptCount:3,incorrectCount:3,hintCount:0});
    const learning=engine.recordLearning(current,false,{attemptCount:3,incorrectCount:3,hintCount:0});
    const html=window.ABVMStudyGameView.play({
      g:{supportMode:true,comebackMode:false,index:0,questions:[support],selectedIndex:null,answered:false,retry:0,score:0,wrong:[]},
      mode:{title:'Quick Mix'},q:support,teach,retryInstruction:teach.instruction,
      labels:{direct:'Direct practice',transfer:'Try it a new way',reasoning:'Explain your thinking'}
    });
    return {currentId:current.id,supportId:support.id,skill:current.skill,supportSkill:support.skill,consecutiveWrong:learning.ConsecutiveWrong,html};
  });

  expect(evidence).not.toBeNull();
  expect(evidence.supportId).not.toBe(evidence.currentId);
  expect(evidence.supportSkill).toBe(evidence.skill);
  expect(evidence.consecutiveWrong).toBeGreaterThanOrEqual(2);
  expect(evidence.html).toContain('Support step');
  expect(evidence.html).toContain('Support step · same skill · not scored');
  expect(evidence.html).toContain('Quick lesson');

  const app=await page.request.get('/app.js').then(response=>response.text());
  expect(app).toContain('g.learningRow?.ConsecutiveWrong||0)>=2');
  expect(app).toContain('supportQuestion(catalog,current');
});

test('Teach Card gives a concise skill rule and worked example without becoming a question', async ({ page }) => {
  const card = await page.evaluate(() => window.ABVMStudyGames.teachCardFor({
    skill: 'setting',
    hint: 'Find where and when.',
  }));
  expect(card?.instruction).toMatch(/where and when/i);
  expect(card?.example).toMatch(/lake|sunset/i);
});

test('Test Ready policy resolves only certified skills from the assessment label', async ({ page }) => {
  const result = await page.evaluate(() => {
    const pack = {
      contentPipeline: {
        skills: [
          { id: 'setting', subject: 'Reading / ELA' },
          { id: 'theme', subject: 'Reading / ELA' },
          { id: 'subject-predicate', subject: 'Reading / ELA' },
          { id: 'long-short-a', subject: 'Spelling / Handwriting' },
        ],
      },
    };
    return {
      grammar: window.ABVMStudyGames.testReadyMode(pack, { x: { label: 'Grammar — subject & predicate' } }),
      setting: window.ABVMStudyGames.testReadyMode(pack, { x: { label: 'Setting test' } }),
      spelling: window.ABVMStudyGames.testReadyMode(pack, { x: { label: 'Spelling test — short a / long a' } }),
      unrelated: window.ABVMStudyGames.testReadyMode(pack, { x: { label: 'Picture Day' } }),
    };
  });

  expect(result.grammar?.skills).toEqual(['subject-predicate']);
  expect(result.setting?.skills).toEqual(['setting']);
  expect(result.setting?.count).toBe(5);
  expect(result.spelling?.skills).toEqual(['long-short-a']);
  expect(result.unrelated).toBeNull();
});


test('Comeback selector prefers an unseen same-skill sibling instead of repeating the failed stem', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const pack = structuredClone(envelope.pack);
    pack.contentPipeline = {
      schemaVersion: 2,
      sourceHash: 'comeback-selector-test',
      bankFingerprint: 'comeback01',
      skills: [{ id: 'setting', subject: 'Reading / ELA' }],
      coverage: [{ topic: 'Setting', subject: 'Reading / ELA', status: 'COVERED', skillId: 'setting' }],
      questions: [
        {
          id: 'comeback-setting-a', subject: 'Reading / ELA', skill: 'setting', questionType: 'direct',
          prompt: 'A story begins in a classroom on Monday morning. Which detail tells the setting?',
          choices: ['a classroom on Monday morning', 'the student feels proud', 'a pencil falls'],
          answer: 'a classroom on Monday morning', explanation: 'Setting tells where and when a story happens.',
          hint: 'Look for both a place and a time.', sourceFact: 'Verified Grade 2 skill: Setting',
          standards: ['CCSS.RL.2.3'], domain: 'Analyzing literary text', dok: 2, difficulty: 2,
        },
        {
          id: 'comeback-setting-b', subject: 'Reading / ELA', skill: 'setting', questionType: 'transfer',
          prompt: 'The children hike beside a lake at sunset. Which phrase describes the setting?',
          choices: ['beside a lake at sunset', 'the children are tired', 'they carry backpacks'],
          answer: 'beside a lake at sunset', explanation: 'The phrase gives both the place and the time.',
          hint: 'Find the where-and-when clue.', sourceFact: 'Verified Grade 2 skill: Setting',
          standards: ['CCSS.RL.2.3'], domain: 'Analyzing literary text', dok: 2, difficulty: 2,
        },
        {
          id: 'comeback-setting-c', subject: 'Reading / ELA', skill: 'setting', questionType: 'reasoning',
          prompt: 'Why does “in the library after lunch” describe a setting?',
          choices: ['It tells where and when.', 'It tells only how a character feels.', 'It names the story problem.'],
          answer: 'It tells where and when.', explanation: 'A setting is built from place and time information.',
          hint: 'Ask whether the phrase gives a place, a time, or both.', sourceFact: 'Verified Grade 2 skill: Setting',
          standards: ['CCSS.RL.2.3'], domain: 'Analyzing literary text', dok: 3, difficulty: 3,
        },
        {
          id: 'comeback-setting-d', subject: 'Reading / ELA', skill: 'setting', questionType: 'transfer',
          prompt: 'A story happens at the playground just before dinner. Which words tell the setting?',
          choices: ['at the playground just before dinner', 'the child laughs loudly', 'a ball rolls away'],
          answer: 'at the playground just before dinner', explanation: 'Those words give both place and time.',
          hint: 'Find the phrase that answers where and when.', sourceFact: 'Verified Grade 2 skill: Setting',
          standards: ['CCSS.RL.2.3'], domain: 'Analyzing literary text', dok: 2, difficulty: 2,
        },
      ],
    };
    const sourceKey = window.ABVMStudyGames.sourceKeyFromEnvelope(pack, envelope);
    const catalog = window.ABVMStudyGames.buildCatalog(pack, { sourceKey });
    const current = catalog.questions.find(question => question.id === 'comeback-setting-a');
    const sibling = window.ABVMStudyGames.comebackQuestion(catalog, current, {
      seed: 'comeback-selector',
      seenIds: ['comeback-setting-a', 'comeback-setting-b', 'comeback-setting-c'],
    });
    return { current: current?.id, sibling: sibling?.id, skill: sibling?.skill, questionType: sibling?.questionType };
  });

  expect(result.current).toBe('comeback-setting-a');
  expect(result.sibling).toBe('comeback-setting-d');
  expect(result.skill).toBe('setting');
  expect(result.questionType).not.toBe('direct');
});

test('a persisted due Comeback is shown unscored and records RememberedLater after success', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  const seeded = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());
    const pack = structuredClone(envelope.pack);
    const sourceKey = window.ABVMStudyGames.sourceKeyFromEnvelope(pack, envelope);
    const catalog = window.ABVMStudyGames.buildCatalog(pack, { sourceKey });
    const question = catalog.questions.find(item => item.tier === 'material' && item.skill && item.choices?.length === 3);
    if (!question) return null;
    localStorage.setItem('abvm-study-comebacks:v1', JSON.stringify([{
      key: 'browser-due-comeback',
      sourceKey,
      questionId: question.id,
      originQuestionId: 'browser-origin',
      skill: question.skill,
      remaining: 0,
    }]));
    return { id: question.id, skill: question.skill, answer: question.answer };
  });
  expect(seeded).not.toBeNull();

  await page.getByRole('button', { name: /Quick Mix/i }).click();
  await expect(page.locator('.game-topbar')).toContainText('Comeback');
  await expect(page.locator('.adaptive-note')).toContainText('not scored');
  await expect(page.locator('.game-topbar b')).toContainText('★ 0');

  await page.locator('.game-answer').filter({ hasText: seeded.answer }).click();
  await expect(page.locator('.game-feedback.correct')).toContainText('Remembered later!');
  await expect(page.locator('.game-topbar b')).toContainText('★ 0');
  await page.locator('[data-game-next]').click();

  const stored = await page.evaluate(skill => ({
    queue: JSON.parse(localStorage.getItem('abvm-study-comebacks:v1') || '[]'),
    learning: JSON.parse(localStorage.getItem('abvm-study-learning:v2') || '{}')[skill] || {},
  }), seeded.skill);
  expect(stored.queue).toEqual([]);
  expect(stored.learning.ComebackSeen).toBe(1);
  expect(stored.learning.RememberedLater).toBe(1);
});


test('Study Games honors pipeline authorization for high-frequency word practice', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const envelope = await fetch('./data/study-pack.json', { cache: 'no-store' }).then(response => response.json());

    const allowed = structuredClone(envelope.pack);
    allowed.contentPipeline = {
      schemaVersion: 2,
      sourceHash: 'sight-authorized',
      bankFingerprint: 'sightauth1',
      skills: [{ id: 'high-frequency-word-use', subject: 'Reading / ELA' }],
      coverage: [{ topic: 'Sight / high-frequency words', subject: 'Reading / ELA', status: 'COVERED', skillId: 'high-frequency-word-use' }],
      questions: [],
    };
    const allowedCatalog = window.ABVMStudyGames.buildCatalog(allowed, { sourceKey: 'sight-authorized' });

    const blocked = structuredClone(envelope.pack);
    blocked.contentPipeline = {
      schemaVersion: 2,
      sourceHash: 'sight-blocked',
      bankFingerprint: 'sightblock1',
      skills: [{ id: 'theme', subject: 'Reading / ELA' }],
      coverage: [{ topic: 'Sight / high-frequency words', subject: 'Reading / ELA', status: 'SOURCE_INSUFFICIENT' }],
      questions: [],
    };
    const blockedCatalog = window.ABVMStudyGames.buildCatalog(blocked, { sourceKey: 'sight-blocked' });

    return {
      allowedCount: allowedCatalog.questions.filter(question => question.skill === 'high-frequency-word-use').length,
      blockedCount: blockedCatalog.questions.filter(question => question.skill === 'high-frequency-word-use').length,
    };
  });

  expect(result.allowedCount).toBeGreaterThan(0);
  expect(result.blockedCount).toBe(0);
});
