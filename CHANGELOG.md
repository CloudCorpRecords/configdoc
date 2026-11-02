# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `extract_config_options` MCP tool and
  `extract` CLI command inventorying every config option
  read in the supplied source files.
- Extracts direct `process.env.NAME` and
  `import.meta.env.NAME` reads with uppercase names,
  captures string and number literal defaults behind `??`
  and `||` (first captured default wins), counts reads per
  option across files, and lists the files each option is
  read in — with path-naming validation errors for missing,
  duplicate, or wrongly typed file entries.
