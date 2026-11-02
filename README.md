# configdoc

Every config option in the code, with its default, in one
document. You pass configdoc the source files as text, and
it scans them for direct environment reads — the config
surface most code bases actually use — and returns a single
inventory:

- **Both read forms** — `process.env.NAME` and
  `import.meta.env.NAME` are extracted, where NAME follows
  the uppercase env convention (`[A-Z_][A-Z0-9_]*`).
  Lowercase or mixed-case names are not matched, and
  destructured reads (`const { X } = process.env`) and
  non-env config objects are out of scope by design.
- **Defaults** — when a read is immediately followed by
  `??` or `||` and a literal, that literal is the read's
  default: a string literal contributes the raw text
  between its quotes (escapes are not interpreted), a
  number literal contributes itself as written. A fallback
  that is an identifier, a call, or anything else captures
  no default.
- **One entry per option** — each distinct name appears
  once, sorted ascending, with the default captured by the
  *first* read of that name (in scan order: files in input
  order, lines top to bottom, matches left to right) that
  captures one — `null` when no read does — plus the total
  number of reads of that name across all files and the
  distinct files it is read in, sorted ascending.

Input is validated strictly: a missing or empty file set, a
file missing `path` or `content`, an empty, non-string, or
duplicate path, or a non-string `content` is an error naming
the offending path (for example `files[0].content must be a
string`), and no partial inventory is produced. The scan is
pure and local: no network, no configuration, no files read
beyond the input you pass in.

## CLI

```bash
npx @reneturcios/configdoc extract --input args.json
npx @reneturcios/configdoc --version
```

`args.json` contains the full arguments object:

```json
{
  "files": [
    {
      "path": "src/config.ts",
      "content": "const port = process.env.PORT ?? 8080;\nconst host = process.env.HOST ?? \"localhost\";"
    },
    {
      "path": "web/env.ts",
      "content": "export const api = import.meta.env.API_URL;"
    }
  ]
}
```

The inventory is printed as JSON:

```json
{
  "options": [
    { "name": "API_URL", "default": null, "reads": 1, "files": ["web/env.ts"] },
    { "name": "HOST", "default": "localhost", "reads": 1, "files": ["src/config.ts"] },
    { "name": "PORT", "default": "8080", "reads": 1, "files": ["src/config.ts"] }
  ],
  "total_options": 3,
  "files_scanned": 2
}
```

Exit codes: `0` on success, `1` on a runtime error
(including an unreadable or invalid input file, or invalid
input), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/configdoc mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "configdoc": {
      "command": "npx",
      "args": ["-y", "@reneturcios/configdoc", "mcp"]
    }
  }
}
```

### Tools

- `extract_config_options` — Extract every configuration
  option read in the code, with the default each read falls
  back to, in one inventory.
  - `files` (array, required, at least one) — source files
    as `{path, content}` objects; `path` is unique across
    the set and `content` is the full source text (it may
    be empty)

  Returns `{options, total_options, files_scanned}`, where
  each option is `{name, default, reads, files}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/configdoc
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/configdoc extract --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
