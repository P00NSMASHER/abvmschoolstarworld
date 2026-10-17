import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const workflow=readFileSync(new URL("../.github/workflows/qa-reproduction.yml",import.meta.url),"utf8");
const primary=readFileSync(new URL("../.github/workflows/qa.yml",import.meta.url),"utf8");

test("independent reproduction and QA always report a check for every PR",()=>{
  for(const source of [workflow,primary]){
    assert.match(source,/^  pull_request:\s*$/m);
    assert.doesNotMatch(source,/^  pull_request:\s*\n\s{4}paths:/m,
      "PR checks must not be skipped by changed-file filters");
  }
  assert.match(workflow,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(primary,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
});
