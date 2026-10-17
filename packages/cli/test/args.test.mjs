import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, optionText, optionNumber } from '../src/args.mjs';

describe('parseArgs', () => {
  it('reads a long option value from the next token', () => {
    assert.deepEqual(parseArgs(['--dir', 'site']), { _: [], dir: 'site' });
  });

  it('reads a long option value from an equals sign', () => {
    assert.deepEqual(parseArgs(['--port=8080']), { _: [], port: '8080' });
  });

  it('sets a known boolean flag without a value', () => {
    assert.deepEqual(parseArgs(['--help', '--yes', '--no-example', '--quiet']), {
      _: [],
      help: true,
      yes: true,
      'no-example': true,
      quiet: true
    });
  });

  it('treats a flag-like next token as a missing value', () => {
    assert.deepEqual(parseArgs(['--host', '--port', '8080']), { _: [], host: true, port: '8080' });
  });

  it('sets an option without a next token to true', () => {
    assert.deepEqual(parseArgs(['--dir']), { _: [], dir: true });
  });

  it('expands the short aliases', () => {
    assert.deepEqual(parseArgs(['-h', '-v', '-y']), { _: [], help: true, version: true, yes: true });
  });

  it('keeps an unknown short flag as a positional argument', () => {
    assert.deepEqual(parseArgs(['-x']), { _: ['-x'] });
  });

  it('stops parsing at the double dash', () => {
    assert.deepEqual(parseArgs(['init', 'demo', '--', '--not-a-flag', 'rest']), {
      _: ['init', 'demo', '--not-a-flag', 'rest']
    });
  });

  it('collects positional arguments around the options', () => {
    assert.deepEqual(parseArgs(['init', 'demo-app', '--yes', 'extra']), {
      _: ['init', 'demo-app', 'extra'],
      yes: true
    });
  });

  it('keeps the last value of a repeated option', () => {
    assert.deepEqual(parseArgs(['--dir', 'a', '--dir', 'b']), { _: [], dir: 'b' });
  });

  it('ignores an option without a name', () => {
    assert.deepEqual(parseArgs(['--=value']), { _: [] });
  });

  it('keeps an empty value written with an equals sign', () => {
    assert.deepEqual(parseArgs(['--dir=']), { _: [], dir: '' });
  });

  it('treats a value that looks like a flag as a flag', () => {
    assert.deepEqual(parseArgs(['--port', '-1']), { _: ['-1'], port: true });
  });
});

describe('optionText', () => {
  it('returns a non-empty string value', () => {
    assert.equal(optionText({ dir: 'site' }, 'dir', '.'), 'site');
  });

  it('returns the fallback for a missing option', () => {
    assert.equal(optionText({}, 'dir', '.'), '.');
  });

  it('returns the fallback for a flag without a value', () => {
    assert.equal(optionText({ dir: true }, 'dir', '.'), '.');
  });

  it('returns the fallback for an empty string', () => {
    assert.equal(optionText({ dir: '' }, 'dir', '.'), '.');
  });
});

describe('optionNumber', () => {
  it('parses a numeric string', () => {
    assert.equal(optionNumber({ port: '8080' }, 'port', 3000), 8080);
  });

  it('parses a value that is already a number', () => {
    assert.equal(optionNumber({ port: 8080 }, 'port', 3000), 8080);
  });

  it('returns the fallback for a flag without a value', () => {
    assert.equal(optionNumber({ port: true }, 'port', 3000), 3000);
  });

  it('returns the fallback for a missing option', () => {
    assert.equal(optionNumber({}, 'port', 3000), 3000);
  });

  it('returns the fallback for a non-numeric value', () => {
    assert.equal(optionNumber({ port: 'abc' }, 'port', 3000), 3000);
  });

  it('returns the fallback for a negative value', () => {
    assert.equal(optionNumber({ port: '-1' }, 'port', 3000), 3000);
  });

  it('accepts zero as a value', () => {
    assert.equal(optionNumber({ port: '0' }, 'port', 3000), 0);
  });

  it('treats an empty value as zero', () => {
    assert.equal(optionNumber({ port: '' }, 'port', 3000), 0);
  });
});
