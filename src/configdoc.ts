/**
 * configdoc core: every config option in the code, with its
 * default, in one document.
 *
 *   extractConfigOptions(files) -> inventory
 *
 * Extraction rules (spec-defined):
 * - Files are scanned in input order, lines top to bottom,
 *   matches left to right within a line. A READ is an
 *   occurrence of `process.env.NAME` or
 *   `import.meta.env.NAME` where NAME matches
 *   [A-Z_][A-Z0-9_]*; lowercase or mixed-case names are not
 *   matched.
 * - A read's DEFAULT is captured when the read is
 *   immediately followed (allowing whitespace) by `??` or
 *   `||` and then a literal: a string literal in double or
 *   single quotes (the default is the raw text between the
 *   quotes; escapes are not interpreted) or a number literal
 *   [0-9]+(\.[0-9]+)? (the default is the literal as
 *   written). Any other following token means the read has
 *   no captured default.
 * - Per distinct name, `default` is the default captured by
 *   the FIRST read of that name (in scan order) that
 *   captures one, or null; `reads` counts every read of the
 *   name; `files` lists the distinct paths where it is
 *   read, sorted ascending. Options are sorted ascending
 *   (code-unit) by name.
 *
 * Validation is strict and path-naming: any malformed input
 * throws an Error naming the offending path (for example
 * "files[0].content must be a string") and no partial result
 * is produced. The computation is pure and local: no
 * network, no files read.
 */
import type { ConfigDocResult, ConfigOption, SourceFile } from "./types.js";

export const VERSION = "0.1.0";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** One env read: the matched name and its end offset in the content. */
interface Read {
  name: string;
  end: number;
}

/**
 * A read: the env prefix, then a NAME in the uppercase
 * convention. The trailing lookahead requires the name to
 * be the complete identifier token: without it a mixed-case
 * name like `ApiKey` would match as the prefix `A`, but the
 * spec says mixed-case names are not matched at all.
 */
const READ_RE =
  /(?:process\.env|import\.meta\.env)\.([A-Z_][A-Z0-9_]*)(?![A-Za-z0-9_$])/g;

const DEFAULT_RE =
  /^\s*(?:\?\?|\|\|)\s*(?:"([^"]*)"|'([^']*)'|([0-9]+(?:\.[0-9]+)?))/;

/** Every read in one file's content, in scan order. */
function findReads(content: string): Read[] {
  const reads: Read[] = [];
  READ_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = READ_RE.exec(content)) !== null) {
    reads.push({ name: match[1], end: match.index + match[0].length });
  }
  return reads;
}

/** The default a read captures, given the text right after it, if any. */
function capturedDefault(content: string, end: number): string | null {
  const match = DEFAULT_RE.exec(content.slice(end));
  if (match === null) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

/**
 * Validate the raw arguments and return the normalised file
 * list. Checks run per file in input order: structure, then
 * path (present, non-empty string, unique), then content
 * (present, string).
 */
function validateArgs(files: unknown): SourceFile[] {
  if (files === undefined) throw new Error("files is required");
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("files must be a non-empty array");
  }
  const validated: SourceFile[] = [];
  const indexByPath = new Map<string, number>();
  files.forEach((raw, i) => {
    const path = `files[${i}]`;
    if (!isRecord(raw)) throw new Error(`${path} must be an object`);
    if (raw.path === undefined) throw new Error(`${path}.path is required`);
    if (typeof raw.path !== "string" || raw.path.length === 0) {
      throw new Error(`${path}.path must be a non-empty string`);
    }
    const firstIndex = indexByPath.get(raw.path);
    if (firstIndex !== undefined) {
      throw new Error(
        `${path}.path duplicates files[${firstIndex}].path "${raw.path}"`,
      );
    }
    indexByPath.set(raw.path, i);
    if (raw.content === undefined) throw new Error(`${path}.content is required`);
    if (typeof raw.content !== "string") {
      throw new Error(`${path}.content must be a string`);
    }
    validated.push({ path: raw.path, content: raw.content });
  });
  return validated;
}

/** Extract every config option read in the supplied files. */
export function extractConfigOptions(files: unknown): ConfigDocResult {
  const validFiles = validateArgs(files);

  interface Accum {
    captured: string | null;
    hasCaptured: boolean;
    reads: number;
    files: Set<string>;
  }
  const byName = new Map<string, Accum>();

  for (const file of validFiles) {
    for (const read of findReads(file.content)) {
      let entry = byName.get(read.name);
      if (entry === undefined) {
        entry = { captured: null, hasCaptured: false, reads: 0, files: new Set() };
        byName.set(read.name, entry);
      }
      entry.reads += 1;
      entry.files.add(file.path);
      if (!entry.hasCaptured) {
        const captured = capturedDefault(file.content, read.end);
        if (captured !== null) {
          entry.captured = captured;
          entry.hasCaptured = true;
        }
      }
    }
  }

  const options: ConfigOption[] = sorted(byName.keys()).map((name) => {
    const entry = byName.get(name) as Accum;
    return {
      name,
      default: entry.captured,
      reads: entry.reads,
      files: sorted(entry.files),
    };
  });

  return {
    options,
    total_options: options.length,
    files_scanned: validFiles.length,
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
