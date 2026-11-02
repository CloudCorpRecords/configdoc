import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractConfigOptions } from "../src/configdoc.js";

/**
 * All tests are pure local computation over inline source
 * text: no filesystem, no network. Each behaviour in the
 * spec is pinned by its own case, including both read forms,
 * both fallback operators, the first-default-wins rule, and
 * every validation path.
 */

const file = (path: string, content: string) => ({ path, content });

describe("extractConfigOptions — read forms", () => {
  it("extracts a process.env read with no default", () => {
    const out = extractConfigOptions([
      file("a.ts", "const key = process.env.API_KEY;"),
    ]);
    assert.deepEqual(out, {
      options: [{ name: "API_KEY", default: null, reads: 1, files: ["a.ts"] }],
      total_options: 1,
      files_scanned: 1,
    });
  });

  it("extracts an import.meta.env read", () => {
    const out = extractConfigOptions([
      file("web.ts", "const mode = import.meta.env.MODE;"),
    ]);
    assert.deepEqual(out.options, [
      { name: "MODE", default: null, reads: 1, files: ["web.ts"] },
    ]);
  });

  it("extracts bracket-free names with underscores and digits", () => {
    const out = extractConfigOptions([
      file("a.ts", "process.env._PRIVATE; process.env.HTTP_2_PORT;"),
    ]);
    assert.deepEqual(
      out.options.map((o) => o.name),
      ["HTTP_2_PORT", "_PRIVATE"],
    );
  });

  it("counts multiple reads on one line, left to right", () => {
    const out = extractConfigOptions([
      file("a.ts", "process.env.A; process.env.B; process.env.A;"),
    ]);
    assert.deepEqual(out.options, [
      { name: "A", default: null, reads: 2, files: ["a.ts"] },
      { name: "B", default: null, reads: 1, files: ["a.ts"] },
    ]);
    assert.equal(out.total_options, 2);
  });

  it("does not match lowercase or mixed-case names", () => {
    const out = extractConfigOptions([
      file(
        "a.ts",
        "process.env.api_key; process.env.ApiKey; import.meta.env.mode; process.env.OK;",
      ),
    ]);
    assert.deepEqual(out.options, [
      { name: "OK", default: null, reads: 1, files: ["a.ts"] },
    ]);
  });

  it("does not extract destructured reads or non-env config objects", () => {
    const out = extractConfigOptions([
      file(
        "a.ts",
        "const { TOKEN } = process.env; const c = config.TOKEN; env.TOKEN;",
      ),
    ]);
    // `process.env;` is not followed by `.NAME`, so the
    // destructured read yields nothing; config.TOKEN and
    // env.TOKEN are not env read forms.
    assert.deepEqual(out.options, []);
    assert.equal(out.total_options, 0);
    assert.equal(out.files_scanned, 1);
  });
});

describe("extractConfigOptions — defaults", () => {
  it("captures a double-quoted string default via ??", () => {
    const out = extractConfigOptions([
      file("a.ts", 'const h = process.env.HOST ?? "localhost";'),
    ]);
    assert.equal(out.options[0].default, "localhost");
  });

  it("captures a single-quoted string default via ||", () => {
    const out = extractConfigOptions([
      file("a.ts", "const h = process.env.HOST || 'example.com';"),
    ]);
    assert.equal(out.options[0].default, "example.com");
  });

  it("captures an empty string default", () => {
    const out = extractConfigOptions([
      file("a.ts", 'const p = process.env.PREFIX ?? "";'),
    ]);
    assert.equal(out.options[0].default, "");
  });

  it("keeps string escapes raw, not interpreted", () => {
    const out = extractConfigOptions([
      file("a.ts", 'const s = process.env.SEP ?? "a\\tb";'),
    ]);
    assert.equal(out.options[0].default, "a\\tb");
  });

  it("captures an integer number default via ??", () => {
    const out = extractConfigOptions([
      file("a.ts", "const p = process.env.PORT ?? 8080;"),
    ]);
    assert.equal(out.options[0].default, "8080");
  });

  it("captures a decimal number default via ||, as written", () => {
    const out = extractConfigOptions([
      file("a.ts", "const r = process.env.RATE || 0.25;"),
    ]);
    assert.equal(out.options[0].default, "0.25");
  });

  it("captures a default on an import.meta.env read", () => {
    const out = extractConfigOptions([
      file("web.ts", 'const u = import.meta.env.API_URL ?? "http://x";'),
    ]);
    assert.equal(out.options[0].default, "http://x");
  });

  it("allows whitespace between the read, the operator, and the literal", () => {
    const out = extractConfigOptions([
      file("a.ts", 'const h = process.env.HOST   ??\n  "spaced";'),
    ]);
    assert.equal(out.options[0].default, "spaced");
  });

  it("captures no default when the fallback is an identifier", () => {
    const out = extractConfigOptions([
      file("a.ts", "const h = process.env.HOST ?? fallbackHost;"),
    ]);
    assert.equal(out.options[0].default, null);
    assert.equal(out.options[0].reads, 1);
  });

  it("captures no default when the fallback is a call", () => {
    const out = extractConfigOptions([
      file("a.ts", "const h = process.env.HOST || computeHost();"),
    ]);
    assert.equal(out.options[0].default, null);
  });

  it("captures no default when the fallback is another env read", () => {
    const out = extractConfigOptions([
      file("a.ts", "const v = process.env.PRIMARY ?? process.env.SECONDARY;"),
    ]);
    assert.deepEqual(out.options, [
      { name: "PRIMARY", default: null, reads: 1, files: ["a.ts"] },
      { name: "SECONDARY", default: null, reads: 1, files: ["a.ts"] },
    ]);
  });

  it("captures no default without a ?? or || operator", () => {
    const out = extractConfigOptions([
      file("a.ts", 'const h = process.env.HOST; const x = "after";'),
    ]);
    assert.equal(out.options[0].default, null);
  });
});

describe("extractConfigOptions — aggregation", () => {
  it("keeps the FIRST captured default when later reads capture a different one", () => {
    const out = extractConfigOptions([
      file("a.ts", 'process.env.MODE ?? "first";'),
      file("b.ts", 'process.env.MODE ?? "second";'),
    ]);
    assert.equal(out.options[0].default, "first");
    assert.equal(out.options[0].reads, 2);
  });

  it("uses a later read's default when earlier reads capture none", () => {
    const out = extractConfigOptions([
      file("a.ts", "process.env.MODE; process.env.MODE ?? fallback;"),
      file("b.ts", 'process.env.MODE || "late";'),
    ]);
    assert.equal(out.options[0].default, "late");
    assert.equal(out.options[0].reads, 3);
  });

  it("keeps the first captured default within one file across lines", () => {
    const out = extractConfigOptions([
      file("a.ts", 'process.env.X ?? "one";\nprocess.env.X ?? "two";'),
    ]);
    assert.equal(out.options[0].default, "one");
    assert.equal(out.options[0].reads, 2);
  });

  it("counts reads across files and lists distinct files sorted ascending", () => {
    const out = extractConfigOptions([
      file("z.ts", "process.env.SHARED; process.env.SHARED;"),
      file("a.ts", "process.env.SHARED; process.env.ONLY_A;"),
    ]);
    assert.deepEqual(out.options, [
      { name: "ONLY_A", default: null, reads: 1, files: ["a.ts"] },
      { name: "SHARED", default: null, reads: 3, files: ["a.ts", "z.ts"] },
    ]);
    assert.equal(out.files_scanned, 2);
  });

  it("sorts options ascending by code unit regardless of scan order", () => {
    const out = extractConfigOptions([
      file("a.ts", "process.env.ZULU; process.env.ALPHA; process.env._MID;"),
    ]);
    assert.deepEqual(
      out.options.map((o) => o.name),
      ["ALPHA", "ZULU", "_MID"],
    );
  });

  it("returns an empty inventory for files with no env reads", () => {
    const out = extractConfigOptions([
      file("a.ts", "const x = 1;"),
      file("empty.ts", ""),
    ]);
    assert.deepEqual(out, { options: [], total_options: 0, files_scanned: 2 });
  });

  it("is deterministic: scan order follows input order, not path order", () => {
    const out = extractConfigOptions([
      file("b.ts", 'process.env.K ?? "from-b";'),
      file("a.ts", 'process.env.K ?? "from-a";'),
    ]);
    // b.ts is scanned first, so its default wins even though
    // a.ts sorts earlier.
    assert.equal(out.options[0].default, "from-b");
    assert.deepEqual(out.options[0].files, ["a.ts", "b.ts"]);
  });
});

describe("extractConfigOptions — validation", () => {
  it("rejects missing or empty files", () => {
    assert.throws(() => extractConfigOptions(undefined), /files is required/);
    assert.throws(() => extractConfigOptions([]), /files must be a non-empty array/);
    assert.throws(() => extractConfigOptions("nope"), /files must be a non-empty array/);
  });

  it("rejects a file that is not an object, naming the path", () => {
    assert.throws(() => extractConfigOptions([42]), /files\[0\] must be an object/);
    assert.throws(
      () => extractConfigOptions([file("a.ts", ""), "b"]),
      /files\[1\] must be an object/,
    );
  });

  it("rejects a file missing its path, naming the path", () => {
    assert.throws(
      () => extractConfigOptions([{ content: "x" }]),
      /files\[0\]\.path is required/,
    );
  });

  it("rejects an empty or non-string path, naming the path", () => {
    assert.throws(
      () => extractConfigOptions([file("", "x")]),
      /files\[0\]\.path must be a non-empty string/,
    );
    assert.throws(
      () => extractConfigOptions([{ path: 42, content: "x" }]),
      /files\[0\]\.path must be a non-empty string/,
    );
  });

  it("rejects a duplicate path, naming both paths", () => {
    assert.throws(
      () => extractConfigOptions([file("a.ts", ""), file("b.ts", ""), file("a.ts", "")]),
      /files\[2\]\.path duplicates files\[0\]\.path "a\.ts"/,
    );
  });

  it("rejects a file missing its content, naming the path", () => {
    assert.throws(
      () => extractConfigOptions([{ path: "a.ts" }]),
      /files\[0\]\.content is required/,
    );
  });

  it("rejects a non-string content, naming the path", () => {
    assert.throws(
      () => extractConfigOptions([file("a.ts", ""), { path: "b.ts", content: 42 }]),
      /files\[1\]\.content must be a string/,
    );
  });

  it("accepts an empty-string content", () => {
    const out = extractConfigOptions([file("a.ts", "")]);
    assert.deepEqual(out, { options: [], total_options: 0, files_scanned: 1 });
  });
});
