import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/qa-reproduction.yml", import.meta.url),
  "utf8",
);

test("independent QA reproduces every JavaScript QA corpus change", () => {
  const pullRequestConfig = workflow.slice(
    workflow.indexOf("  pull_request:"),
    workflow.indexOf("\npermissions:"),
  );

  assert.match(
    pullRequestConfig,
    /^\s+- ['"]tests\/\*\*\/\*\.mjs['"]$/m,
    "test-only release changes must not bypass exact-head independent reproduction",
  );
});
