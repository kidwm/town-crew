import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function cloudflarePreview() {
  const directory = new URL('../../dist/', import.meta.url);
  const files = new Map();
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  for (const file of await readdir(directory, { recursive: true, withFileTypes: true })) {
    if (!file.isFile()) continue;
    const path = relative(fileURLToPath(directory), join(file.parentPath, file.name)).replaceAll('\\', '/');
    files.set(`/${path}`, await readFile(new URL(path, directory)));
  }
  let redirects = 0;
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/index.html') {
      redirects++;
      response.writeHead(308, { Location: `/${url.search}` });
      response.end();
      return;
    }
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const content = files.get(path);
    response.writeHead(content ? 200 : 404, {
      'Content-Type': types[extname(path)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(content);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    get redirects() { return redirects; },
    close: async () => {
      if (!server.listening) return;
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    },
  };
}
