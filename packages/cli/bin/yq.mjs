#!/usr/bin/env node
import { main } from '../src/cli.mjs';

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write('yq: ' + (error && error.message ? error.message : String(error)) + '\n');
    process.exitCode = 1;
  }
);
