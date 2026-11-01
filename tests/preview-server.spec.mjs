import { test, expect } from '@playwright/test';

test('preview serves only GET/HEAD and never leaks type-sniffing ambiguity', async ({ request }) => {
  const get = await request.get('/index.html');
  expect(get.status()).toBe(200);
  expect(get.headers()['x-content-type-options']).toBe('nosniff');
  const head = await request.head('/index.html');
  expect(head.status()).toBe(200);
  expect(await head.body()).toHaveLength(0);
  const post = await request.post('/index.html', { data: 'ignored' });
  expect(post.status()).toBe(405);
  expect(post.headers().allow).toBe('GET, HEAD');
});
