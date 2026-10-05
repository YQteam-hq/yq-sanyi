import { createServer } from 'node:http';
import { existsSync, watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { line, warn } from './log.mjs';
import { optionNumber, optionText } from './args.mjs';

const reloadPath = '/__yq/reload';
const reloadClient = '<script>new EventSource("' + reloadPath + '").onmessage=function(){location.reload()}</script>';
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

export const DEV_USAGE = [
  'usage: yq dev [options]',
  '',
  'serve a directory and reload the browser after every change',
  '',
  'options:',
  '  --dir <path>    directory to serve, defaults to yq.config.mjs or the current directory',
  '  --port <number> port to listen on, defaults to yq.config.mjs or 8080',
  '  --host <name>   interface to bind, defaults to 127.0.0.1',
  '  --entry <file>  document served for the directory root, defaults to index.html',
  '  -h, --help      show this help'
].join('\n');

async function loadConfig(dir) {
  const file = join(dir, 'yq.config.mjs');
  if (!existsSync(file)) {
    return {};
  }
  try {
    const loaded = await import(pathToFileURL(file).href);
    const config = loaded.default;
    return config && typeof config === 'object' ? config : {};
  } catch (error) {
    warn('ignoring yq.config.mjs: ' + error.message);
    return {};
  }
}

function watchTree(root, notify) {
  let watcher;
  try {
    watcher = watch(root, { recursive: true }, notify);
  } catch (error) {
    watcher = watch(root, notify);
  }
  watcher.on('error', () => {});
  return watcher;
}

function makeHandler(root, entry, clients) {
  return async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === reloadPath) {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive'
      });
      res.write('retry: 500\n\n');
      clients.add(res);
      req.on('close', () => {
        clients.delete(res);
      });
      return;
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') {
      pathname = '/' + entry;
    }
    const file = normalize(join(root, pathname));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('forbidden');
      return;
    }
    let body;
    try {
      body = await readFile(file);
    } catch (error) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    const type = contentTypes[extname(file).toLowerCase()] || 'application/octet-stream';
    if (type.startsWith('text/html')) {
      const text = body.toString('utf8');
      res.writeHead(200, { 'content-type': type });
      res.end(text.includes('</body>') ? text.replace('</body>', reloadClient + '</body>') : text + reloadClient);
      return;
    }
    res.writeHead(200, { 'content-type': type });
    res.end(body);
  };
}

export async function runDev(options) {
  if (options.help) {
    line(DEV_USAGE);
    return 0;
  }
  const cwd = process.cwd();
  const config = await loadConfig(cwd);
  const root = resolve(cwd, optionText(options, 'dir', typeof config.dir === 'string' ? config.dir : '.'));
  if (!existsSync(root)) {
    warn('directory not found: ' + root);
    return 1;
  }
  const entry = optionText(options, 'entry', typeof config.entry === 'string' ? config.entry : 'index.html');
  const host = optionText(options, 'host', '127.0.0.1');
  const port = optionNumber(options, 'port', typeof config.port === 'number' ? config.port : 8080);
  if (!existsSync(join(root, entry))) {
    warn('entry not found, the root url will answer 404: ' + entry);
  }
  const clients = new Set();
  let timer = null;
  const notify = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      for (const client of clients) {
        client.write('data: reload\n\n');
      }
    }, 40);
  };
  const server = createServer(makeHandler(root, entry, clients));
  const watcher = watchTree(root, notify);
  const stop = () => {
    watcher.close();
    for (const client of clients) {
      client.end();
    }
    clients.clear();
    server.close();
    setTimeout(() => {
      process.exit(0);
    }, 200).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  server.on('error', (error) => {
    warn(error.message);
  });
  await new Promise((done) => server.listen(port, host, done));
  const address = server.address();
  const bound = address && typeof address === 'object' ? address.port : port;
  line('yq dev: serving ' + root + ' at http://' + host + ':' + bound);
  line('yq dev: watching for changes, press ctrl+c to stop');
  return new Promise((settle) => {
    server.on('close', () => {
      settle(0);
    });
  });
}
