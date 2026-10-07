import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadAloud } from '../pages/study-room-view.mjs';

function speechFixture() {
  const calls = { cancelled: 0, spoken: [] };
  const win = {
    speechSynthesis: {
      cancel() { calls.cancelled++; },
      speak(utterance) { calls.spoken.push(utterance); },
    },
    SpeechSynthesisUtterance: class {
      constructor(text) { this.text = text; }
    },
  };
  return { calls, win, reader: createReadAloud(win) };
}

test('unavailable speech remains an inert optional feature', () => {
  for (const win of [undefined, {}, {speechSynthesis:{}}, {speechSynthesis:{speak(){},cancel(){}}}]) {
    const reader = createReadAloud(win);
    assert.equal(reader.supported, false);
    assert.equal(reader.read('Question'), false);
    assert.doesNotThrow(() => { reader.stop(); reader.dispose(); reader.dispose(); });
  }
});

test('reading requires explicit nonempty text', () => {
  const { reader, calls } = speechFixture();
  assert.equal(reader.supported, true);
  for (const text of ['', '  ', null, undefined, 12, {}]) assert.equal(reader.read(text), false);
  assert.deepEqual(calls, {cancelled:0,spoken:[]});
});

test('an explicit read preserves voice settings and supplied question text', () => {
  const { reader, calls } = speechFixture();
  assert.equal(reader.read('What is two plus two? Three. Four.'), true);
  assert.equal(calls.spoken.length, 1);
  assert.equal(calls.cancelled, 1);
  assert.equal(calls.spoken[0].text, 'What is two plus two? Three. Four.');
  assert.equal(calls.spoken[0].lang, 'en-US');
  assert.equal(calls.spoken[0].rate, 0.85);
});

test('a replacement reading detaches the preceding callbacks', () => {
  const { reader, calls } = speechFixture();
  reader.read('First');
  const first = calls.spoken[0];
  reader.read('Second');
  assert.equal(first.onend, null);
  assert.equal(first.onerror, null);
  assert.equal(calls.cancelled, 2);
  assert.equal(typeof calls.spoken[1].onend, 'function');
});

for (const event of ['onend', 'onerror']) {
  test(`a delayed ${event} cannot orphan a newer reading`, () => {
    const { reader, calls } = speechFixture();
    reader.read('First');
    const lateCallback = calls.spoken[0][event];
    reader.read('Second');
    lateCallback();
    reader.stop();
    assert.equal(calls.cancelled, 3, 'navigation must cancel the second reading');
    assert.equal(calls.spoken[1].onend, null);
  });
}

test('normal completion releases ownership without repeated cancellation', () => {
  const { reader, calls } = speechFixture();
  reader.read('Question');
  calls.spoken[0].onend();
  reader.stop();
  reader.dispose();
  assert.equal(calls.cancelled, 1);
});

test('stop is idempotent and an explicit subsequent read still works', () => {
  const { reader, calls } = speechFixture();
  reader.read('First');
  reader.stop();
  reader.stop();
  assert.equal(calls.cancelled, 2);
  assert.equal(reader.read('Second'), true);
  assert.equal(calls.spoken.length, 2);
});

test('dispose cancels once and prevents detached controls from reading', () => {
  const { reader, calls } = speechFixture();
  reader.read('Question');
  const lateCallback = calls.spoken[0].onend;
  reader.dispose();
  reader.dispose();
  lateCallback();
  assert.equal(reader.read('Detached question'), false);
  assert.equal(calls.cancelled, 2);
  assert.equal(calls.spoken.length, 1);
});

test('a speech engine exception never propagates into the app', () => {
  const { reader, calls, win } = speechFixture();
  win.speechSynthesis.speak = () => { throw new Error('Speech unavailable'); };
  assert.equal(reader.read('Question'), false);
  assert.equal(calls.cancelled, 2);
  assert.doesNotThrow(() => reader.dispose());
});

test('a failed utterance constructor does not leave an active reading', () => {
  const { win, calls } = speechFixture();
  win.SpeechSynthesisUtterance = class { constructor() { throw new Error('Unavailable'); } };
  const reader = createReadAloud(win);
  assert.equal(reader.read('Question'), false);
  reader.stop();
  assert.equal(calls.cancelled, 1);
});

test('failed cancellation does not start overlapping speech', () => {
  const { reader, calls, win } = speechFixture();
  win.speechSynthesis.cancel = () => { throw new Error('Cancellation unavailable'); };
  assert.equal(reader.read('Question'), false);
  assert.deepEqual(calls.spoken, []);
  assert.doesNotThrow(() => { reader.stop(); reader.dispose(); });
});
