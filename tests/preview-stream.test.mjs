import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { once } from 'node:events';
import { streamPreviewFile } from '../scripts/preview-stream.mjs';

function responseFixture() {
  const chunks = [];
  const response = new Writable({ write(chunk, encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
  response.headersSent = false;
  response.statusCode = 0;
  response.writeHead = function (status, headers) {
    this.statusCode = status;
    this.headers = headers;
    this.headersSent = true;
    return this;
  };
  return { response, body: () => Buffer.concat(chunks).toString('utf8') };
}

test('stream open succeeds before 200 headers and transmits body', async () => {
  const { response, body } = responseFixture();
  const stream = new PassThrough();
  streamPreviewFile('synthetic', response, { 'Content-Type': 'text/plain' }, () => stream);
  assert.equal(response.headersSent, false);
  const finished = once(response, 'finish');
  stream.emit('open', 5);
  stream.end('public');
  await finished;
  assert.equal(response.statusCode, 200);
  assert.equal(body(), 'public');
});

test('opening failure returns 404 without crashing or claiming success', async () => {
  const { response, body } = responseFixture();
  const stream = new PassThrough();
  streamPreviewFile('synthetic', response, {}, () => stream);
  const finished = once(response, 'finish');
  stream.emit('error', Object.assign(new Error('gone'), { code: 'ENOENT' }));
  await finished;
  assert.equal(response.statusCode, 404);
  assert.equal(body(), 'Not found');
  assert.equal(response.destroyed, true);
});

test('read failure after headers destroys incomplete connection, not server', async () => {
  const { response } = responseFixture();
  const stream = new PassThrough();
  streamPreviewFile('synthetic', response, {}, () => stream);
  const closed = once(response, 'close');
  stream.emit('open', 5);
  stream.emit('error', Object.assign(new Error('I/O failure'), { code: 'EIO' }));
  await closed;
  assert.equal(response.statusCode, 200);
  assert.equal(response.destroyed, true);
});

test('real missing file produces 404 with no unhandled stream error', async () => {
  const { response } = responseFixture();
  const finished = once(response, 'finish');
  streamPreviewFile('/definitely-missing-abvm-preview-asset-20261031.html', response, {});
  await finished;
  assert.equal(response.statusCode, 404);
});
