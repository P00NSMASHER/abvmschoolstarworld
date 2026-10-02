import test from "node:test";
import assert from "node:assert/strict";
import {selectPublicationEvidence} from "../scripts/health-evidence.mjs";

const run=(name,conclusion,updated_at)=>({name,conclusion,updated_at,created_at:updated_at});

test("newer successful refresh supersedes older cancelled standalone deploy",()=>{
  const deploy=run("Deploy ABVM to GitHub Pages","cancelled","2026-10-02T13:30:00Z");
  const refresh=run("Refresh ABVM teacher pages","success","2026-10-02T13:33:00Z");
  assert.equal(selectPublicationEvidence(deploy,refresh),refresh);
});

test("newer standalone deploy remains publication evidence",()=>{
  const refresh=run("Refresh ABVM teacher pages","success","2026-10-02T13:33:00Z");
  const deploy=run("Deploy ABVM to GitHub Pages","success","2026-10-02T13:35:00Z");
  assert.equal(selectPublicationEvidence(deploy,refresh),deploy);
});

test("failed refresh never replaces standalone publication evidence",()=>{
  const deploy=run("Deploy ABVM to GitHub Pages","success","2026-10-02T13:30:00Z");
  const refresh=run("Refresh ABVM teacher pages","failure","2026-10-02T13:33:00Z");
  assert.equal(selectPublicationEvidence(deploy,refresh),deploy);
});

test("successful refresh is valid publication evidence when no standalone deploy exists",()=>{
  const refresh=run("Refresh ABVM teacher pages","success","2026-10-02T13:33:00Z");
  assert.equal(selectPublicationEvidence(null,refresh),refresh);
});
