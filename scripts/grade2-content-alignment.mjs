const SUBJECT_STANDARD_PREFIXES = Object.freeze({
  'Reading / ELA': ['CCSS.RL.2.', 'CCSS.RI.2.', 'CCSS.RF.2.', 'CCSS.L.2.'],
  'Spelling / Handwriting': ['CCSS.RF.2.', 'CCSS.L.2.'],
  Math: ['CCSS.2.'],
  Religion: ['ABVM.RELIGION.'],
});

const DOMAIN_BY_SKILL = Object.freeze({
  'sentence-types': ['Language'],
  'consonant-blends': ['Foundational reading'],
  'cvc-structure': ['Foundational reading'],
  'long-short-a': ['Foundational reading'],
  'suffix-ed-ing': ['Foundational reading'],
  'suffix-s-es': ['Language'],
  'high-frequency-word-use': ['Foundational reading'],
  'vocabulary-in-context': ['Word knowledge and skills'],
  theme: ['Analyzing literary text'],
  visualize: ['Comprehension / constructing meaning'],
  sequence: ['Comprehension / constructing meaning'],
  caption: ['Informational text features'],
  dialogue: ['Analyzing literary text'],
  inference: ['Comprehension / constructing meaning'],
  'cause-effect': ['Comprehension / constructing meaning'],
  'main-character': ['Analyzing literary text'],
  setting: ['Analyzing literary text'],
  'character-feelings': ['Analyzing literary text'],
  genre: ['Analyzing literary text'],
  'place-value': ['Numbers and operations'],
  'compare-numbers': ['Numbers and operations'],
  time: ['Geometry and measurement'],
  money: ['Geometry and measurement'],
  'religion-trinity': ['Religion'],
  'religion-image-likeness': ['Religion'],
  'religion-creation-care': ['Religion'],
  'religion-jesus-savior': ['Religion'],
  'religion-five-senses': ['Religion'],
  'religion-gifts-choices': ['Religion'],
});

const EXACT_SKILLS = Object.freeze({
  'sentence-types': {
    subject: 'Reading / ELA',
    standards: ['CCSS.L.2.1'],
    anchors: ['sentence', 'question', 'command', 'statement'],
  },
  'consonant-blends': {
    subject: 'Spelling / Handwriting',
    standards: ['CCSS.RF.2.3'],
    anchors: ['blend', 'consonant', 'sound'],
  },
  'cvc-structure': {
    subject: 'Reading / ELA',
    standards: ['CCSS.RF.2.3'],
    anchors: ['cvc', 'consonant', 'vowel'],
  },
  'long-short-a': {
    subject: 'Spelling / Handwriting',
    standards: ['CCSS.RF.2.3'],
    anchors: ['long', 'short', 'vowel', 'a_e'],
  },
  'suffix-ed-ing': {
    subject: 'Reading / ELA',
    standards: ['CCSS.RF.2.3.d'],
    anchors: ['suffix', 'ending', '-ed', '-ing', 'base word'],
  },
  'suffix-s-es': {
    subject: 'Reading / ELA',
    standards: ['CCSS.L.2.1.b', 'CCSS.RF.2.3.d'],
    anchors: ['plural', '-s', '-es', 'more than one'],
  },
  theme: {
    subject: 'Reading / ELA',
    standards: ['CCSS.RL.2.2'],
    anchors: ['theme', 'lesson', 'message', 'story'],
  },
  visualize: {
    subject: 'Reading / ELA',
    standards: ['CCSS.RL.2.1'],
    anchors: ['visual', 'picture', 'imagine', 'details'],
  },
  sequence: {
    subject: 'Reading / ELA',
    standards: ['CCSS.RL.2.5'],
    anchors: ['sequence', 'order', 'first', 'next', 'before', 'after', 'beginning', 'middle', 'end'],
  },
  caption: {
    subject: 'Reading / ELA',
    standards: ['CCSS.RI.2.5'],
    anchors: ['caption', 'picture', 'photo', 'photograph', 'text feature', 'describe'],
  },
  dialogue: {
    subject: 'Reading / ELA',
    standards: ['CCSS.RL.2.6'],
    anchors: ['dialogue', 'character', 'say', 'spoken', 'quotation'],
  },
  inference: {
    subject: 'Reading / ELA',
    standards: ['CCSS.RL.2.1'],
    anchors: ['infer', 'clue', 'evidence', 'suggest'],
  },
  'cause-effect': {
    subject: 'Reading / ELA',
    standards: ['CCSS.RI.2.3'],
    anchors: ['cause', 'effect', 'because', 'happened first'],
  },
  'main-character': {
    subject: 'Reading / ELA',
    standards: ['CCSS.RL.2.3'],
    anchors: ['main character', 'character', 'story follows'],
  },
  setting: {
    subject: 'Reading / ELA',
    standards: ['CCSS.RL.2.3'],
    anchors: ['setting', 'where', 'when', 'place', 'time'],
  },
  'character-feelings': {
    subject: 'Reading / ELA',
    standards: ['CCSS.RL.2.3'],
    anchors: ['feel', 'character', 'actions', 'clue'],
  },
  'high-frequency-word-use': {
    subject: 'Reading / ELA',
    standards: ['CCSS.RF.2.3.f'],
    anchors: ['word', 'sentence', 'complete', 'grammar', 'meaning', 'high-frequency'],
  },
  'vocabulary-in-context': {
    subject: 'Reading / ELA',
    standards: ['CCSS.L.2.4.a'],
    anchors: ['vocabulary', 'meaning', 'word', 'definition'],
  },
  genre: {
    subject: 'Reading / ELA',
    standards: ['CCSS.RL.2.5'],
    anchors: ['genre', 'fantasy', 'text', 'story'],
  },
  'place-value': {
    subject: 'Math',
    standards: ['CCSS.2.NBT.A.1'],
    anchors: ['place', 'hundreds', 'tens', 'ones', 'value'],
  },
  'compare-numbers': {
    subject: 'Math',
    standards: ['CCSS.2.NBT.A.4'],
    anchors: ['compare', 'greater', 'less', 'larger', 'smaller'],
  },
  time: {
    subject: 'Math',
    standards: ['CCSS.2.MD.C.7'],
    anchors: ['time', 'clock', 'hour', 'minute'],
  },
  money: {
    subject: 'Math',
    standards: ['CCSS.2.MD.C.8'],
    anchors: ['money', 'coin', 'cent', 'dime', 'quarter', 'nickel'],
  },
  'religion-trinity': {
    subject: 'Religion',
    standards: ['ABVM.RELIGION.CURRENT'],
    anchors: ['trinity', 'father', 'son', 'holy spirit'],
  },
  'religion-image-likeness': {
    subject: 'Religion',
    standards: ['ABVM.RELIGION.CURRENT'],
    anchors: ['image', 'likeness', 'think', 'choose', 'love'],
  },
  'religion-creation-care': {
    subject: 'Religion',
    standards: ['ABVM.RELIGION.CURRENT'],
    anchors: ['creation', 'care', 'gift'],
  },
  'religion-jesus-savior': {
    subject: 'Religion',
    standards: ['ABVM.RELIGION.CURRENT'],
    anchors: ['jesus', 'savior', 'sins', 'grace'],
  },
  'religion-five-senses': {
    subject: 'Religion',
    standards: ['ABVM.RELIGION.CURRENT'],
    anchors: ['senses', 'seeing', 'hearing', 'smelling', 'tasting', 'touching', 'creation'],
  },
  'religion-gifts-choices': {
    subject: 'Religion',
    standards: ['ABVM.RELIGION.CURRENT'],
    anchors: ['gift', 'choose', 'love', 'help'],
  },
});

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9_+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAny(text, anchors) {
  const value = normalize(text);
  return anchors.some(anchor => value.includes(normalize(anchor)));
}

function dynamicSkillRule(skill) {
  if (/^subtraction-within-\d+$/.test(skill)) {
    return {
      subject: 'Math',
      standards: ['CCSS.2.OA.B.2', 'CCSS.2.NBT.B.5'],
      anchors: ['subtract', 'subtraction', 'left', 'count back', '-'],
      domains: ['Numbers and operations'],
    };
  }
  if (/^addition-within-\d+$/.test(skill)) {
    return {
      subject: 'Math',
      standards: ['CCSS.2.OA.B.2', 'CCSS.2.NBT.B.5'],
      anchors: ['add', 'addition', 'altogether', 'total', '+'],
      domains: ['Numbers and operations'],
    };
  }
  return null;
}

function ruleFor(skill) {
  return EXACT_SKILLS[skill] || dynamicSkillRule(skill);
}

export function validateGrade2QuestionAlignment(question) {
  const issues = [];
  const id = String(question?.id || 'unknown');
  const subject = String(question?.subject || '');
  const skill = String(question?.skill || '');
  const standards = Array.isArray(question?.standards) ? question.standards.map(String) : [];
  const prefixes = SUBJECT_STANDARD_PREFIXES[subject];

  if (!prefixes) {
    issues.push({ id, issue: 'unknown-subject', subject });
    return issues;
  }

  if (!standards.length || standards.some(standard => !prefixes.some(prefix => standard.startsWith(prefix)))) {
    issues.push({ id, issue: 'standard-subject-mismatch', subject, standards });
  }

  const rule = ruleFor(skill);
  if (!rule) {
    issues.push({ id, issue: 'unknown-skill', skill });
    return issues;
  }

  if (subject !== rule.subject) {
    issues.push({ id, issue: 'skill-subject-mismatch', skill, subject, expected: rule.subject });
  }

  if (!rule.standards.some(expected => standards.includes(expected))) {
    issues.push({ id, issue: 'skill-standard-mismatch', skill, standards, expected: rule.standards });
  }

  const allowedDomains = rule.domains || DOMAIN_BY_SKILL[skill] || [];
  if (allowedDomains.length && !allowedDomains.includes(String(question.domain || ''))) {
    issues.push({ id, issue: 'skill-domain-mismatch', skill, domain: question.domain, expected: allowedDomains });
  }

  const semanticText = [
    question.prompt,
    question.explanation,
    question.hint,
    question.sourceFact,
  ].join(' ');

  if (!matchesAny(semanticText, rule.anchors)) {
    issues.push({ id, issue: 'semantic-anchor-missing', skill });
  }

  return issues;
}

export function validateGrade2PipelineAlignment(pipeline) {
  const issues = [];
  for (const question of pipeline?.questions || []) {
    issues.push(...validateGrade2QuestionAlignment(question));
  }
  return issues;
}

export const grade2AlignmentRules = Object.freeze({
  subjects: SUBJECT_STANDARD_PREFIXES,
  skills: EXACT_SKILLS,
});
