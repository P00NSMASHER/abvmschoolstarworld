import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Playwright preview uses the cross-platform Node server', () => {
  const config = readFileSync(new URL('../playwright.config.mjs', import.meta.url), 'utf8');
  assert.match(config, /command:\s*["']node scripts\/serve-pages\.mjs["']/);
  assert.doesNotMatch(config, /python3?\s+-m\s+http\.server/);
});

test('preview server confines requests to the published pages directory', () => {
  const server = readFileSync(new URL('../scripts/serve-pages.mjs', import.meta.url), 'utf8');
  assert.match(server, /resolvePreviewPath\(root, relative\)/);
  const policy = readFileSync(new URL('../scripts/preview-path.mjs', import.meta.url), 'utf8');
  assert.match(policy, /realpathSync\(requested\)/);
  assert.match(policy, /canonicalTarget\.startsWith\(canonicalRoot \+ sep\)/);
  assert.match(server, /writeHead\(403\)/);
  assert.match(server, /Cache-Control': 'no-store'/);
  assert.match(server, /'\.webmanifest', 'application\/manifest\+json; charset=utf-8'/);
});
