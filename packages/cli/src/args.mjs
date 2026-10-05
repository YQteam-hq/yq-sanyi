const BOOLEAN = new Set(['help', 'version', 'yes', 'no-example', 'quiet']);
const ALIAS = { h: 'help', v: 'version', y: 'yes' };

export function parseArgs(argv) {
  const options = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--') {
      for (let j = i + 1; j < argv.length; j++) {
        options._.push(argv[j]);
      }
      break;
    }
    if (token.startsWith('--')) {
      const eq = token.indexOf('=');
      const name = eq === -1 ? token.slice(2) : token.slice(2, eq);
      if (name.length === 0) {
        continue;
      }
      if (eq !== -1) {
        options[name] = token.slice(eq + 1);
        continue;
      }
      if (BOOLEAN.has(name)) {
        options[name] = true;
        continue;
      }
      const next = argv[i + 1];
      if (next === undefined || (next.length > 1 && next.startsWith('-'))) {
        options[name] = true;
        continue;
      }
      options[name] = next;
      i++;
      continue;
    }
    if (token.length > 1 && token.startsWith('-')) {
      const name = ALIAS[token.slice(1)];
      if (name !== undefined) {
        options[name] = true;
        continue;
      }
    }
    options._.push(token);
  }
  return options;
}

export function optionText(options, name, fallback) {
  const value = options[name];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return fallback;
}

export function optionNumber(options, name, fallback) {
  const value = options[name];
  if (value === undefined || value === true) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
