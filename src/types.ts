/**
 * configdoc types.
 *
 * configdoc inventories the configuration surface of a code
 * base. The caller supplies source files as text, and
 * configdoc scans them for direct environment reads —
 * `process.env.NAME` and `import.meta.env.NAME`, where NAME
 * follows the uppercase env convention — and reports, as
 * pure local computation:
 *
 *   - one entry per distinct option name, sorted ascending
 *   - the default captured by the first read of that name
 *     that falls back to a literal via `??` or `||`
 *   - the total number of reads of that name
 *   - the distinct files the name is read in
 *
 * Destructured reads and non-env config objects are out of
 * scope by design: only direct reads are extracted.
 */

/** One source file supplied by the caller. */
export interface SourceFile {
  /** File path; unique across the supplied set. */
  path: string;
  /** Full source text of the file; may be empty. */
  content: string;
}

/** One configuration option found in the code. */
export interface ConfigOption {
  /** The env name, matching [A-Z_][A-Z0-9_]*. */
  name: string;
  /**
   * The default captured by the first read of this name (in
   * scan order) that is followed by `??` or `||` and a string
   * or number literal, as written in the code; null when no
   * read of this name captures a default.
   */
  default: string | null;
  /** Total number of reads of this name across all files. */
  reads: number;
  /** Distinct paths where this name is read, sorted ascending. */
  files: string[];
}

/** The config inventory. */
export interface ConfigDocResult {
  /** One entry per distinct name, sorted ascending. */
  options: ConfigOption[];
  /** Number of distinct names found. */
  total_options: number;
  /** Number of files supplied. */
  files_scanned: number;
}
