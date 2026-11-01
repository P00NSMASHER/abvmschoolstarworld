import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolvePreviewPath } from '../scripts/preview-path.mjs';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'abvm-preview-path-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const publicRoot = join(dir, 'pages');
  const sibling = join(dir, 'pages-copy');
  mkdirSync(publicRoot);
  mkdirSync(sibling);
  writeFileSync(join(publicRoot, 'index.html'), 'public');
  writeFileSync(join(sibling, 'private.txt'), 'private');
  return { publicRoot, sibling };
}

test('normal public assets resolve inside the canonical preview root', t => {
  const { publicRoot } = fixture(t);
  assert.equal(resolvePreviewPath(publicRoot, 'index.html'), realpathSync(join(publicRoot, 'index.html')));
  assert.equal(resolvePreviewPath(publicRoot, '../pages-copy/private.txt'), null);
  assert.equal(resolvePreviewPath(publicRoot, '../pages/index.html'), null);
  assert.equal(resolvePreviewPath(publicRoot, '.'), null);
});

test('a symlink beneath pages cannot expose a sibling private file', t => {
  const { publicRoot, sibling } = fixture(t);
  const escaped = join(publicRoot, 'escaped.txt');
  try {
    symlinkSync(join(sibling, 'private.txt'), escaped, 'file');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('symlink creation is unavailable');
    throw error;
  }
  assert.equal(resolvePreviewPath(publicRoot, 'escaped.txt'), null);
});

test('in-root links remain functional and missing files stay missing', t => {
  const { publicRoot } = fixture(t);
  const linked = join(publicRoot, 'alias.html');
  try {
    symlinkSync(join(publicRoot, 'index.html'), linked, 'file');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('symlink creation is unavailable');
    throw error;
  }
  assert.equal(resolvePreviewPath(publicRoot, 'alias.html'), realpathSync(join(publicRoot, 'index.html')));
  assert.throws(() => resolvePreviewPath(publicRoot, 'missing.html'), { code: 'ENOENT' });
});
