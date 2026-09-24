import { readFileSync } from 'node:fs';
import { parseArgs } from './args.mjs';
import { line, warn } from './log.mjs';
import { runInit } from './init.mjs';
import { runDev } from './dev.mjs';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const usage = [
  'yq-sanyi cli',
  '',
  'usage: yq <command> [options]',
  '',
  'commands:',
  '  init <name>   scaffold a project in a new directory',
  '  dev           serve a directory with live reload',
  '',
  'options:',
  '  -h, --help      show this help',
  '  -v, --version   print the cli version',
  '',
  'run "yq <command> --help" for the options of a command'
].join('\n');

export async function main(argv) {
  const options = parseArgs(argv);
  const command = options._[0];
  if (options.version) {
    line(manifest.version);
    return 0;
  }
  if (!command) {
    line(usage);
    return options.help ? 0 : 1;
  }
  if (command === 'init') {
    return runInit(options);
  }
  if (command === 'dev') {
    return runDev(options);
  }
  warn('unknown command: ' + command);
  line(usage);
  return 1;
}
