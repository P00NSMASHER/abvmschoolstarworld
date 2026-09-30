# Grade 2 Question Research Recovery

Recovered September 2026 design/research from the prior StarBlox / ABVM work so the current ABVM app does not lose the learning-system decisions that were already made.

## Primary recovered sources

- StarBlox PR #107 — material-first Grade 2 question bank with original STAR-aligned fallback and banned meta/list-recognition prompts.
- StarBlox PR #124 — research improvements 1–6: standards, DOK, diagnostic distractors, multi-step math, formative feedback, adaptive scaffolding.
- StarBlox PR #127 — research improvements 7–12: independent alignment validation, item analytics, A/B tests, rich items, rubrics, larger refreshed pool.
- `ABVM_Grade2_Game_Research_Master_Dossier.pdf`
- `ABVM_Game_10of10_Handoff_Packet.md`
- `ABVM_Grade2_Game_10of10_Immersive_Learning_Blueprint_v2.pdf`
- Hunter repository research on SkillCoco/BKT, SM-2, QTI, OpenGameData, and deferred IRT.

## 1. Core content architecture

The child experience should not use unrestricted runtime AI to invent questions.

Use a weekly source pack with three source roles:

1. **Scope source** — what matters this week (teacher page, word list, homework/test scope).
2. **Authority source** — what exactly is correct (teacher material, worksheet/key, approved curriculum text).
3. **Skill reference** — how the target skill should be practiced/measured (standards, stable construct map, validated templates).

Lifecycle:

`INGESTED → EXTRACTED → SOURCED → REVIEWED → COMPILED → QA PASSED → ACTIVE`

Safety states:

- `BLOCKED` — unsupported/unsafe/ambiguous content would enter play.
- `SAFE_PARTIAL` — everything playable is valid, but expected coverage is incomplete.
- `READY` — safety and expected coverage gates pass.
- `ACTIVE` — approved/published pack.

Coverage states:

- `COVERED`
- `PARTIALLY_COVERED`
- `MISSING`
- `SOURCE_INSUFFICIENT`
- `NOT_PRACTICED_BY_DESIGN`

Fail closed. Missing evidence is not permission to invent an answer.

## 2. Three generation modes

### STRICT_SOURCE

Use for:

- Religion facts
- exact spelling/vocabulary facts
- teacher-specific language
- exact curriculum claims

The answer must be explicitly supported by an approved source.

### CURATED_CONTEXT

The core meaning/fact is locked, while a reviewed scenario bank may vary.

Useful for:

- creation care
- vocabulary context when a verified definition exists
- high-frequency word context
- tightly bounded application examples

### DETERMINISTIC_TEMPLATE

The correct answer is derived from a validated rule/parameter bank.

Useful for:

- arithmetic
- sequence/order
- phonics structure
- caption-function tasks
- place value
- clocks/number lines/data displays

## 3. What the questions must measure

Do not confuse “mentions school material” with “measures the skill.”

The earlier system explicitly rejected low-value prompts such as:

- “Which one is a sight word?”
- “Which word is on the current list?”
- “What is being practiced this week?”
- “Which story is on the teacher page?”
- teacher-page/list metadata trivia

Preferred progression:

- **Recall** — retrieve an explicitly taught fact.
- **Skill** — apply the named rule/construct.
- **Application / transfer** — use the skill in a new but tightly controlled example.
- **Strategic reasoning** — where the Grade 2 construct supports it.

Difficulty must describe the cognitive work actually required. Do not manufacture a quota of “hard” items.

## 4. Subject-specific boundaries

### Reading / ELA

Prefer:

- inference from explicit clues
- theme from a complete short scenario
- strongest text evidence
- visualization from descriptive details
- character motivation/feelings from actions
- sequence/cause-effect
- author purpose/word choice where source scope supports them

Do not invent facts about copyrighted/current classroom stories when only the title or skill is known.

Do not assume a reading textbook/program unless ABVM-specific evidence confirms it.

### Phonics / spelling

Prefer reasoning about:

- consonant blends
- CVC structure
- vowel patterns
- suffixes/plurals
- spelling patterns

Do not treat print recognition as proof of spelling.

Do not show the target spelling in a “build the word” stem.

### Vocabulary

Critical source rule:

> If the teacher source lists vocabulary terms but does not provide definitions, do not create definition questions from outside knowledge.

Definitions/context may be used only when the meaning is in an approved authority source or parent-approved curated source.

### Math

Use:

- fact fluency only when it is the actual target
- missing addends/unknowns
- fact families
- place value/comparison
- word problems
- genuine two-step problems
- clocks/money/measurement/data when in scope

Distractors should map to realistic errors such as:

- off-by-one
- operation confusion
- one-step-only
- place-value error
- regrouping error

### Religion

Religion is school curriculum content, not a personal-belief test.

Use neutral curriculum framing for direct doctrine facts where appropriate (“According to the current Religion lesson…”).

Good candidates:

- Trinity
- creation care
- Jesus/Savior/grace lesson facts
- gifts
- five senses when in current scope

Previously rejected: ambiguous “think / choose / love” everyday-action classification as a broad generator. Application scenarios must have one defensible curricular answer.

## 5. Distractors and answer choices

Normal Grade 2 MCQ: three or four choices.

Requirements:

- exactly one correct answer
- unique normalized choices
- no “all of the above” / “none of the above”
- distractors from the same construct
- plausible misconception-based errors
- distractors must not be harder than the target
- no answer-position bias
- no semantic duplicates

Every wrong option should ideally carry:

- misconception tag
- targeted corrective feedback

## 6. Feedback / support ladder

Recovered primary-age feedback design:

1. First miss: neutral “Not yet” + one short conceptual clue.
2. Second miss: stronger clue or alternate representation.
3. Third miss: model answer + brief explanation.
4. Then move on and schedule a different sibling **Comeback** item.

Do not use:

- lives/hearts as punishment
- red-X spectacle
- loss of Coins/rewards for a wrong answer
- endless repetition of the identical question

After two unsuccessful independent opportunities at the easiest legitimate level, a small unscored **Teach Card** may be shown. Teach Cards do not count as evidence or earn rewards.

Comeback target: a sibling item 2–4 resolved questions later, or next session if the Quest ends.

## 7. Adaptive selection

The previous StarBlox implementation persisted per-skill:

- seen
- correct
- wrong
- consecutive correct
- consecutive wrong
- target difficulty

Research implementation guardrails used difficulty 2–3 for the active Grade 2 game, promoted after repeated success, and scaffolded after repeated misses.

Earlier external research also found:

- BKT as a possible interpretable mastery model
- SM-2 style spaced retrieval
- deterministic “best next challenge”
- prerequisite/mastery gating

IRT was intentionally deferred until enough response data exists to calibrate real item difficulty/discrimination parameters.

## 8. Quest selection

A compact Quest should:

- prioritize current/weak/due skills
- include some previously successful material to avoid an all-failure session
- preserve subject/skill variety when possible
- cap near-duplicate templates
- prefer material-first selection
- use STAR/public-domain-aligned fallback only when current material cannot fill the session

A Test-Ready Quest may be enabled when an upcoming assessment is present in approved scope data. It is practice, not a predicted test score.

## 9. Renewable variety

Do not fake a new question by only reshuffling choices.

Track three fingerprints:

- `contentFingerprint` — pedagogical construct/template structure
- `variantFingerprint` — semantic instantiation/parameters
- `presentationFingerprint` — choice order/UI arrangement

Presentation changes do not count as new learning content.

## 10. Construct-aware evidence

Every template should define:

1. what a correct response supports;
2. the strongest learning claim it can support;
3. what it must not claim;
4. what support disqualifies “independent” evidence;
5. whether evidence is direct or integrated.

Evidence types recovered:

- `DIRECT_TARGET`
- `INTEGRATED_COMPONENT`

Examples:

- Trinity recognition does not prove broad theology application.
- Sequence of three events does not prove global reading comprehension.
- Vocabulary MCQ does not prove spelling or spontaneous word use.
- Sight-word recognition does not prove spelling.
- Read-aloud of the target word may make evidence supported rather than independent.

Avoid standardized-test-style mastery claims.

## 11. Accessibility / read-aloud

Accessibility should remain available, but the evidence interpretation must respect construct validity.

Example:

- Religion knowledge with TTS can still be valid Religion evidence.
- A sight-word item where TTS speaks the target cannot count as independent print-recognition evidence.

## 12. Mechanical publication QA

Reject candidates for:

- duplicate choices
- answer missing from choices
- multiple defensible answers
- malformed matching/order structures
- answer leakage in hints
- accidental NOT/EXCEPT stems
- excessive prompt length
- invalid ordering chains
- repeated contexts masquerading as variety
- answer-position bias
- distractors harder than the target
- unsupported source inference
- admin/logistics trivia
- privacy/PII leakage
- stale provenance
- unknown skill/standard/domain mapping

An independent validator should check:

- subject ↔ standard
- skill ↔ standard
- skill ↔ domain
- semantic anchors
- source grounding
- provenance
- rubric
- rich-content schema where used

Publication must fail closed if the independent validator fails.

## 13. Provenance contract

Every generated item should preserve a chain equivalent to:

**source → claim → construct → template → variant → response → evidence**

Useful metadata:

- source page/title/version/hash
- evidence/excerpt hash
- support type: explicit vs deterministic transform
- template ID
- primary/assessed skills
- standards/domain
- DOK/cognitive demand
- difficulty
- hint/scaffold
- explanation
- distractor diagnostics
- rubric
- fingerprints
- generator version

## 14. Data-driven item review

The old StarBlox research implemented privacy-minimized item aggregates for later review:

- first-attempt accuracy
- coarse response-time bands
- choice-position counts
- misconception counts
- support usage
- rubric points
- sufficient statistics for discrimination

Do **not** store usernames, raw answer text, or session IDs merely to review item quality.

Flag:

- too easy
- too hard
- low discrimination
- unusually slow
- dominant misconception

## 15. Rich content

Validated structured visuals are useful when they actually improve the construct:

- bar chart
- clock face
- number line
- place-value model
- fraction model

Keep the data structured and do not expose answer keys in client payloads.

## 16. A/B tests

The prior research allowed small, stable experiments for eligible presentation/rich-format variants, with treatment assignment persisted and experiment labels hidden from the child.

Experiments must never change the underlying correct fact/skill or weaken source grounding.

## 17. Rubrics

Every certified item in the later StarBlox bank carried a small analytic rubric.

A 2-point internal rubric can distinguish:

- fully correct reasoning
- plausible misconception-aligned partial reasoning
- unsupported answer

Partial formative evidence must not automatically earn the same reward as a fully correct independent answer.

## 18. Privacy and admin-content separation

Never generate academic questions from:

- due dates
- schedule/event dates
- homework folder procedures
- forms
- money/payment notices
- lunch/order information
- contact details
- dismissal
- school club logistics
- Picture Day
- teacher/parent directions

These may drive Today/Week/Family reminders, but not the question bank.

## 19. Current implementation priority for ABVM

For the current ABVM PWA question pipeline, the highest-value recovered requirements are:

1. source-insufficient vocabulary must suppress definition questions;
2. independent alignment validation must run before publication;
3. question choices must be position-balanced;
4. source/provenance/fingerprint/evidence metadata must be preserved;
5. current weekly material remains primary;
6. generated questions must have misconception-aware feedback;
7. coverage gaps must be explicit rather than silently filled;
8. future work should add direct/transfer/reasoning sibling variants, Comebacks/Teach Cards, Test-Ready Quests, and privacy-minimized item review.

This file is the recovered design authority for future Grade 2 question-system work unless a later source explicitly supersedes it.
