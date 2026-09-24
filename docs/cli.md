# yq-sanyi cli

`yq-sanyi-cli` is the command line companion of the framework. It scaffolds a project
and serves it with live reload. The cli has no third party dependencies: it runs on
Node.js built-ins and reads the runtime bundle from the workspace.

## Commands

| Command | Purpose |
| --- | --- |
| `yq init <name>` | Create a project in a new directory |
| `yq dev` | Serve a directory and reload the browser on change |
| `yq --version` | Print the cli version |
| `yq --help` | Print the command list |

## yq init

```
yq init <name> [options]

--dir <path>   parent directory of the project, defaults to the current directory
--yes, -y      accept the defaults and skip the prompts
--no-example   leave out the counter component
```

Without `--yes` and with a terminal attached, the command asks for the project name
and whether the counter example should be included. Every prompt has a safe default,
so the flags make the command fully scriptable:

```bash
yq init demo-app --yes
yq init plain-app --yes --no-example
```

The scaffold writes:

```text
index.html        entry document, loads the runtime and app.js
app.js            component definitions
yq.config.mjs     defaults for the dev server
README.md         project notes
.gitignore        node_modules, dist, logs
vendor/           the yq-sanyi runtime, copied from packages/core/dist/core.global.js
```

The command refuses to write into a directory that already holds files, and it
refuses names that contain path segments.

## yq dev

```
yq dev [options]

--dir <path>    directory to serve, defaults to yq.config.mjs or the current directory
--port <number> port to listen on, defaults to yq.config.mjs or 8080
--host <name>   interface to bind, defaults to 127.0.0.1
--entry <file>  document served for the directory root, defaults to index.html
```

The server reads `yq.config.mjs` from the working directory when the file exists and
the matching command line option is absent:

```js
export default {
  name: 'demo-app',
  port: 8080,
  dir: '.',
  entry: 'index.html'
};
```

Two behaviours matter while editing:

- Every served document gets a small `EventSource` client injected before `</body>`.
  The client listens on `/__yq/reload` and calls `location.reload()` on each event.
- The served directory is watched recursively. After a change the server debounces
  for 40 ms and then pushes one reload event to every open stream.

Requests that resolve outside the served directory are answered with `403`, so a
path such as `/..%2f..%2fpackage.json` cannot read files above the root.

## Tests

The cli suite lives in `packages/cli/test/cli.test.mjs` and runs with the rest of the
repository through `npm test`. It covers the usage and version output, the scaffold
file set with its placeholder substitution, the `--no-example` variant, the refusals
for a busy target directory and a name with path segments, and the dev server
contract: the entry document with the injected client, content types, `404`, `403`,
and a reload event after a watched file changes.
