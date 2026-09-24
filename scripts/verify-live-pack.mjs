import { readFileSync } from 'node:fs';

const local = JSON.parse(readFileSync(new URL('../pages/data/study-pack.json', import.meta.url), 'utf8'));
const base = String(process.env.LIVE_URL || '').replace(/\/$/, '');
if (!base) throw new Error('LIVE_URL is required.');
const target = `${base}/data/study-pack.json?verify=${Date.now()}`;

const expected = {
  sourceLastCheckedAt: local.sourceLastCheckedAt,
  sourceHash: local.pack?.sourceHash,
  uploadedNoticeHash: local.pack?.uploadedNoticeHash,
};
let lastError = null;
for (let attempt = 1; attempt <= 12; attempt += 1) {
  try {
    const response = await fetch(target, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache', 'user-agent': 'ABVM-Live-Pack-Verifier/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`live pack returned HTTP ${response.status}`);
    const live = await response.json();
    const actual = {
      sourceLastCheckedAt: live.sourceLastCheckedAt,
      sourceHash: live.pack?.sourceHash,
      uploadedNoticeHash: live.pack?.uploadedNoticeHash,
    };
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
      console.log('Live pack verification PASS', actual);
      process.exit(0);
    }
    throw new Error(`live pack mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  } catch (error) {
    lastError = error;
    if (attempt < 12) await new Promise(resolve => setTimeout(resolve, 10_000));
  }
}
throw new Error(`Live deployment did not converge after 12 attempts: ${lastError?.message || lastError}`);
