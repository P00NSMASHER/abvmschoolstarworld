import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A pull_request checkout defaults to a generated merge commit, which is not
// necessarily the candidate that source parity and reviewers examined.
const acceptanceWorkflows = [
  "qa.yml",
  "qa-reproduction.yml",
  "calendar-visual-acceptance.yml",
  "today-visual-acceptance.yml",
  "study-visual-acceptance.yml",
  "study-player-visual-acceptance.yml",
  "study-tools-visual.yml",
  "progress-visual-acceptance.yml",
  "public-privacy-visual-acceptance.yml",
];

for (const file of acceptanceWorkflows) {
  test(file + " checks out and verifies the exact PR head", () => {
    const source = readFileSync(new URL("../.github/workflows/" + file, import.meta.url), "utf8");
    assert.match(source, /uses: actions\/checkout@v6\n\s+with:\n\s+ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
    assert.match(source, /PR_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
    assert.match(source, /test "\$\(git rev-parse HEAD\)" = "\$PR_HEAD_SHA"/);
  });
}

// A binary school-asset revision can change offline rendering without touching
// CSS or JS. It must trigger every premium browser visual/privacy lane on the
// exact PR head, never silently reuse checks from a previous asset tree.
const schoolPhotoVisualWorkflows = [
  "calendar-visual-acceptance.yml",
  "today-visual-acceptance.yml",
  "study-visual-acceptance.yml",
  "study-player-visual-acceptance.yml",
  "study-tools-visual.yml",
  "progress-visual-acceptance.yml",
  "public-privacy-visual-acceptance.yml",
];

for (const file of schoolPhotoVisualWorkflows) {
  test(file + " runs on approved school-photo asset changes", () => {
    const source = readFileSync(new URL("../.github/workflows/" + file, import.meta.url), "utf8");
    const pullRequestPaths = source.split(/^  workflow_dispatch:/m)[0];
    assert.match(pullRequestPaths, /^\s+- 'pages\/assets\/school\/\*\*'$/m);
  });
}
