import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectLinks } from '../check-docs-links.mjs';

describe('collectLinks', () => {
  it('collects an inline link with its line', () => {
    const links = collectLinks('intro\n\nsee [the cli](docs/cli.md) for details\n');
    assert.deepEqual(links, [{ target: 'docs/cli.md', line: 3 }]);
  });

  it('collects a reference definition that lives on its own line', () => {
    const links = collectLinks('see [the spec][spec]\n\n[spec]: ./docs/spec.md\n');
    assert.deepEqual(links, [{ target: './docs/spec.md', line: 3 }]);
  });

  it('reads an angle bracketed definition target', () => {
    const links = collectLinks('[spec]: <./docs/spec.md>\n');
    assert.deepEqual(links, [{ target: './docs/spec.md', line: 1 }]);
  });

  it('keeps a definition indented by up to three spaces', () => {
    const links = collectLinks('   [spec]: ../README.md\n');
    assert.deepEqual(links, [{ target: '../README.md', line: 1 }]);
  });

  it('ignores a footnote definition', () => {
    assert.deepEqual(collectLinks('[^1]: a note that is not a path\n'), []);
  });

  it('ignores links and definitions inside a fenced block', () => {
    const text = ['```md', '[gone](docs/missing.md)', '[spec]: ./missing.md', '```', '[kept](docs/cli.md)'].join('\n');
    assert.deepEqual(collectLinks(text), [{ target: 'docs/cli.md', line: 5 }]);
  });

  it('ignores links inside a tilde fenced block', () => {
    const text = ['~~~', '[gone](./missing.md)', '~~~'].join('\n');
    assert.deepEqual(collectLinks(text), []);
  });

  it('ignores every link after an unclosed fence', () => {
    const text = ['```', '[gone](./missing.md)', '[also gone](./missing.md)'].join('\n');
    assert.deepEqual(collectLinks(text), []);
  });

  it('keeps line numbers after a fenced block', () => {
    const text = ['```', 'code', '```', '', 'see [a](./a.md)'].join('\n');
    assert.deepEqual(collectLinks(text), [{ target: './a.md', line: 5 }]);
  });

  it('collects every link of a document in order', () => {
    const text = ['[one](docs/a.md)', '', '[two](docs/b.md)', '', '[two]: ./docs/b.md'].join('\n');
    assert.deepEqual(collectLinks(text), [
      { target: 'docs/a.md', line: 1 },
      { target: 'docs/b.md', line: 3 },
      { target: './docs/b.md', line: 5 }
    ]);
  });
});
