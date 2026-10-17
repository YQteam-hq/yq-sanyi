import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bar, line, setQuiet, warn } from '../src/log.mjs';

function capture() {
  const stdout = [];
  const stderr = [];
  const writeOut = process.stdout.write.bind(process.stdout);
  const writeErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk) => {
    stdout.push(String(chunk));
    return true;
  };
  process.stderr.write = (chunk) => {
    stderr.push(String(chunk));
    return true;
  };
  return {
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
    restore: () => {
      process.stdout.write = writeOut;
      process.stderr.write = writeErr;
    }
  };
}

describe('warn', () => {
  after(() => {
    setQuiet(false);
  });

  it('writes a prefixed line to stderr by default', () => {
    const stream = capture();
    try {
      setQuiet(false);
      warn('careful');
    } finally {
      stream.restore();
    }
    assert.equal(stream.stderr(), 'yq: careful\n');
    assert.equal(stream.stdout(), '');
  });

  it('stays silent once quiet is on', () => {
    const stream = capture();
    try {
      setQuiet(true);
      warn('careful');
    } finally {
      stream.restore();
    }
    assert.equal(stream.stderr(), '');
  });

  it('lets the later call decide between two calls', () => {
    const first = capture();
    try {
      setQuiet(true);
      setQuiet(false);
      warn('careful');
    } finally {
      first.restore();
    }
    assert.equal(first.stderr(), 'yq: careful\n');

    const second = capture();
    try {
      setQuiet(true);
      warn('careful');
    } finally {
      second.restore();
    }
    assert.equal(second.stderr(), '');
  });

  it('treats a non-boolean value as not quiet', () => {
    const stream = capture();
    try {
      setQuiet('yes');
      warn('careful');
      setQuiet(1);
      warn('careful');
    } finally {
      stream.restore();
    }
    assert.equal(stream.stderr(), 'yq: careful\nyq: careful\n');
  });
});

describe('line and bar under quiet', () => {
  after(() => {
    setQuiet(false);
  });

  it('keeps line output with quiet on', () => {
    const stream = capture();
    try {
      setQuiet(true);
      line('hello');
    } finally {
      stream.restore();
    }
    assert.equal(stream.stdout(), 'hello\n');
  });

  it('keeps bar output with quiet on', () => {
    const stream = capture();
    try {
      setQuiet(true);
      bar('info', 'done');
    } finally {
      stream.restore();
    }
    assert.equal(stream.stdout(), 'info: done\n');
    assert.equal(stream.stderr(), '');
  });
});
