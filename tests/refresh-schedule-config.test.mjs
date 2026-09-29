import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const workflow=readFileSync(new URL("../.github/workflows/sync-study-pack.yml",import.meta.url),"utf8");
const refresh=readFileSync(new URL("../scripts/refresh-teacher-pages.mjs",import.meta.url),"utf8");

test("teacher refresh covers the school day and self-triggers after workflow changes",()=>{
  for(const cron of ["17 6 * * *","47 9 * * *","17 13 * * *","47 15 * * *"])assert.match(workflow,new RegExp(cron.replace(/\*/g,"\\*")));
  assert.match(workflow,/\.github\/workflows\/sync-study-pack\.yml/);
});

test("published sync policy matches the workflow schedule",()=>{
  assert.match(refresh,/scheduledAt: \['6:17 AM', '9:47 AM', '1:17 PM', '3:47 PM'\]/);
  assert.match(refresh,/primaryAt: '6:17 AM'/);
  assert.match(refresh,/backupAt: '9:47 AM'/);
});
