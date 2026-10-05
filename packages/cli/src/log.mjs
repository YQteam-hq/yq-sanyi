export function line(text) {
  process.stdout.write(text + '\n');
}

export function warn(text) {
  process.stderr.write('yq: ' + text + '\n');
}

export function bar(kind, text) {
  process.stdout.write(kind + ': ' + text + '\n');
}
