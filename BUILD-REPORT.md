# configdoc — Build Report

MCP Rebuild 1000, Batch 14. Original program build from the
packages-100 plan (cluster G #79), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch14/configdoc.md`
(read first). There is no external original; the tool surface
is the program's defined spec. Local build only — nothing
pushed or published.

Identity: repo `configdoc`, npm `@reneturcios/configdoc`,
MCP name `io.github.CloudCorpRecords/configdoc`, version
`0.1.0`, bin `configdoc` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Extracts every
  config option read in the code, with its default, into one
  inventory.", 84 chars ≤100; npm entry carries
  `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/configdoc:0.1.0` carries **no**
  `version` field), `Dockerfile` (node:20-alpine two-stage,
  label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/configdoc"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright
  (c) 2026 Rene Turcios), `README.md` (fresh text),
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27),
  `package-lock.json` (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`extract --input <args.json>`
  where the file holds the full arguments object, `mcp`,
  `--version`; exit 2 usage / 1 runtime error, argument
  validation before any file read), `src/mcp.ts`,
  `src/types.ts`, `src/configdoc.ts` (core,
  `VERSION = "0.1.0"`)
- `test/configdoc.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE = ghcr.io/cloudcorprecords/configdoc`,
  smoke-test server-name assertion `configdoc`)

## Tools implemented (1)

- `extract_config_options` — arguments: `files` (array,
  required, minItems 1) of `{path (string, required,
  non-empty, unique across the set), content (string,
  required, may be empty)}`.

  Returns `{options, total_options, files_scanned}`. Files
  are scanned in input order, lines top to bottom, matches
  left to right. A read is an occurrence of
  `process.env.NAME` or `import.meta.env.NAME` with NAME
  matching `[A-Z_][A-Z0-9_]*` as a complete identifier
  token (see "Gaps"). A read captures a default when it is
  immediately followed (allowing whitespace) by `??` or
  `||` and a string literal (raw text between the quotes)
  or a number literal (`[0-9]+(\.[0-9]+)?`, as written); any
  other following token captures none. Per distinct name,
  `options` holds one entry `{name, default, reads, files}`
  sorted ascending (code-unit): `default` is the default
  captured by the first read of that name in scan order
  that captures one (null when none does), `reads` is the
  total read count across all files, and `files` is the
  distinct paths where the name is read, sorted ascending.

  The fixture literal
  (`harness/fixtures/configdoc-tools-original.json`) and
  the `src/mcp.ts` literal are identical, with no `$schema`
  and no `additionalProperties`.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation.
- Validation is path-naming and total: missing/empty
  `files`, a file that is not an object, a missing path, an
  empty or non-string path, a duplicate path, a missing
  content, or a non-string content throws an Error naming
  the offending path (e.g. `files[0].content must be a
  string`) and produces no partial result (MCP: `isError`;
  CLI: exit 1).
- Extraction is textual, per the spec's definition of a
  read as an *occurrence* of the read pattern: the scanner
  is a single global regex pass over each file's content in
  input order, which yields exactly the spec's scan order
  (input order, top to bottom, left to right). It does not
  parse the language, so a read pattern appearing inside a
  comment or a string literal counts as an occurrence, and
  a default literal is never consumed by the scan — a read
  pattern inside a default string would itself be scanned
  as a read occurrence.
- The first-captured-default rule is tracked with an
  explicit captured flag rather than a null check, so a
  legitimately captured empty-string default (`?? ""`)
  correctly blocks later defaults from replacing it.

## Verification (foreground, this session)

- `npx tsc` exit 0 (`dist/cli.js` built)
- `npm test` (`tsx --test test/*.test.ts`): **33 tests,
  33 pass, 0 fail** — both read forms (`process.env`,
  `import.meta.env`), names with underscores and digits,
  multiple reads on one line counted left to right,
  lowercase and mixed-case names not matched, destructured
  reads and non-env objects not extracted, string defaults
  via `??` (double quotes) and `||` (single quotes), an
  empty-string default, escapes kept raw, integer and
  decimal number defaults as written, a default on an
  `import.meta.env` read, whitespace (including a newline)
  between read/operator/literal, no default for identifier,
  call, or env-read fallbacks or when no operator follows,
  first-captured-default wins across files and within one
  file, a later read's default used when earlier reads
  capture none, read counting across files with the
  distinct file list sorted ascending, options sorted
  ascending by code unit, scan order following input order
  rather than path order, an empty inventory for files with
  no reads (including an empty-content file), and every
  validation path (missing/empty/non-array `files`,
  non-object file, missing path, empty/non-string path,
  duplicate path, missing content, non-string content,
  empty-string content accepted)
- `dist/cli.js --version` → `0.1.0`; unknown command exits
  2 with usage; `extract` with no `--input` exits 2;
  `extract --input <missing file>` exits 1 naming the file;
  `extract --input <valid file>` exits 0 and prints the
  inventory JSON (verified against a hand-checked two-file
  input: PORT read twice in one file with default `8080`
  from `?? 8080`, HOST default `localhost`, API_URL from
  `import.meta.env` with default `http://localhost` via
  `||`); `extract --input <invalid file>` exits 1 with
  `files[0].content must be a string`
- Parity: `harness/parity.py` vs
  `harness/fixtures/configdoc-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1** (the harness
  does not expand `~` in the stdio command, so the run used
  the expanded absolute path to `dist/cli.js`, the same
  form recorded in earlier batches' parity output)

## Lockfile status

`package-lock.json` generated clean via Route 3 (temp copy
without `node_modules`/`dist`/`package-lock.json`, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/configdoc`, **128 package entries**. Local
`node_modules` was installed via `npm install
--ignore-scripts --offline` for build/test; gitignored.

## Gaps / honest notes

- **Mixed-case name boundary:** the spec says NAME matches
  `[A-Z_][A-Z0-9_]*` and that "lowercase or mixed-case
  names are not matched". A bare regex would match
  `process.env.ApiKey` as the prefix name `A`, contradicting
  the second clause, so the read pattern carries an
  identifier-boundary lookahead (`(?![A-Za-z0-9_$])`): the
  name must be the complete identifier token. A test pins
  `ApiKey` yielding nothing. This is the one place the
  implementation goes beyond the literal pattern, in favour
  of the spec's stated behaviour.
- **String literal termination:** a string default is
  captured up to the next matching quote character; escapes
  are not interpreted, for the value or for termination.
  A default string containing an escaped quote therefore
  ends at that quote. The spec fixes only that escapes are
  not interpreted in the captured value.
- **Whitespace before a default:** "allowing whitespace"
  is implemented as `\s*`, which can span a newline (a
  read at end of line with `?? "x"` on the next line
  captures `x`); pinned by a test so the choice is
  explicit.
- **Duplicate-path error wording:** the spec requires a
  duplicate-path error naming the offending path without
  fixing the wording; the message used is
  `files[<i>].path duplicates files[<first>].path "<path>"`.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
