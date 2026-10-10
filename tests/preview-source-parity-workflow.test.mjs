import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source=readFileSync(
  new URL("../.github/workflows/preview-source-parity.yml",import.meta.url),
  "utf8",
);
const previewBranch="release/abvm-unified-preview-20261009";
const calendarReviewBranch="ux/calendar-focus-scroll-20261010";
const calendarDateBranch="ux/calendar-date-wayfinding-20261010";

test("authoritative source parity covers the premium release preview and its directly stacked review PRs",()=>{
  const condition=source.match(/^\s+if:\s*(.+)$/m)?.[1]||"";
  assert.ok(condition.includes("github.head_ref == '"+previewBranch+"'"),
    "the unified release preview head must run source parity");
  assert.ok(condition.includes("github.base_ref == '"+previewBranch+"'"),
    "review PRs based on the unified preview must not skip school-source parity");
  assert.ok(condition.includes("github.base_ref == '"+calendarReviewBranch+"'"),
    "nested calendar review PRs must not skip the school-source gate");
  assert.ok(condition.includes("github.base_ref == '"+calendarDateBranch+"'"),
    "agenda-polish PRs stacked on date wayfinding must not skip school-source parity");
  assert.ok(condition.includes("github.event_name == 'workflow_dispatch'"),
    "maintainers retain the manual source-parity verification path");
  assert.ok(!/\bmain\b/.test(condition),
    "source parity must remain scoped to the release-preview review lane");
});
test("source parity compares exact review head to latest main in read-only mode",()=>{
  assert.match(source,/github\.event\.pull_request\.head\.sha/,
    "checkout must select the actual review head, not GitHub's synthetic merge ref");
  assert.match(source,/git fetch --no-tags origin \+refs\/heads\/main:refs\/remotes\/origin\/main/,
    "reference main must be refreshed before comparison");
  assert.match(source,/ABVM_MAIN_REF: refs\/remotes\/origin\/main/);
  assert.match(source,/ABVM_PREVIEW_REF: HEAD/);
  assert.match(source,/node scripts\/assert-release-preview-parity\.mjs/);
  assert.match(source,/permissions:\s*\n\s+contents: read/,
    "workflow must keep read-only repository permissions");
});
