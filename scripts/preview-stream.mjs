import { createReadStream } from 'node:fs';

// Wait for the file descriptor before emitting HTTP 200. A file may be
// removed between statSync and open; stream errors must not crash preview QA.
export function streamPreviewFile(target, response, headers, openStream = createReadStream) {
  const stream = openStream(target);
  stream.once('error', () => {
    if (!response.headersSent && !response.writableEnded && !response.destroyed) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    } else if (!response.destroyed) {
      response.destroy();
    }
  });
  stream.once('open', () => {
    if (response.destroyed || response.writableEnded) {
      stream.destroy();
      return;
    }
    response.writeHead(200, headers);
    stream.pipe(response);
  });
  response.once('close', () => stream.destroy());
  return stream;
}
