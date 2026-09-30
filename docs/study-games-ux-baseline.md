# Study Games UX baseline

This document freezes the child-facing Study Games interaction that was approved on 2026-09-30 before the question-depth and reward work.

## Must remain recognizable

- The Study Games landing screen keeps the same simple card grid and the four core modes: Quick Mix, Math Dash, Word Power, and Faith Quest. Test Ready remains an optional source-driven fifth mode.
- A normal round keeps the same top bar, progress bar, single question card, three large answer buttons, hint control, retry/feedback treatment, streak strip, and Next/See my score progression.
- The existing three-step retry ladder, unscored Support step/Teach Card, and unscored Comeback behavior remain learning behavior rather than reward shortcuts.
- The finish screen keeps its current simple score/stars hierarchy and two actions. Reward additions may extend this screen, but may not replace the learning result or make replay the dominant action.
- Phone layout, keyboard/screen-reader behavior, offline recovery, and source-safety behavior remain release gates.

## Engineering boundary

New Study Games UI rendering belongs in `pages/study-games-view.js`; learning selection/evidence/reward state belongs in `pages/study-games.js`. `pages/app.js` remains the orchestration shell and must stay below the existing 55 KB ceiling.

The browser contract in `tests/study-games-ux-contract.spec.mjs` protects the baseline flow while allowing more questions, visual representations, and a small transparent reward layer.
