let quietMode = false;

export function setQuiet(value) {
  quietMode = value === true;
}

export function line(text) {
  process.stdout.write(text + '\n');
}

export function warn(text) {
  if (quietMode) {
    return;
  }
  process.stderr.write('yq: ' + text + '\n');
}

export function bar(kind, text) {
  process.stdout.write(kind + ': ' + text + '\n');
}
