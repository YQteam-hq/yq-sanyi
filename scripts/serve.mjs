import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 8080);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};
const messages = {
  badRequest: 'bad request',
  forbidden: 'forbidden',
  notFound: 'not found',
  internal: 'internal error'
};

function send(res, status, text) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}

export function resolveWithin(root, pathname) {
  const file = normalize(join(root, pathname));
  const rel = relative(root, file);
  if (rel.length === 0) {
    return file;
  }
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    return null;
  }
  return file;
}

export function makeHandler(root) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch (error) {
        send(res, 400, messages.badRequest);
        return;
      }
      if (pathname === '/') {
        pathname = '/examples/basic.html';
      }
      const file = resolveWithin(root, pathname);
      if (file === null) {
        send(res, 403, messages.forbidden);
        return;
      }
      let body;
      try {
        body = await readFile(file);
      } catch (error) {
        send(res, 404, messages.notFound);
        return;
      }
      res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch (error) {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      send(res, 500, messages.internal);
    }
  };
}

function isEntryPoint() {
  const entry = process.argv[1];
  return Boolean(entry) && resolve(entry) === fileURLToPath(import.meta.url);
}

if (isEntryPoint()) {
  createServer(makeHandler(root)).listen(port, () => {
    console.log('serving ' + root + ' on http://localhost:' + port);
  });
}
