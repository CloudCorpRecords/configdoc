/**
 * configdoc MCP server. Tools: extract_config_options.
 *
 * Why the low-level Server instead of McpServer: the
 * high-level helper converts zod schemas to JSON Schema and
 * injects keys not in this tool's defined spec ("$schema"
 * and "additionalProperties"), which breaks exact
 * tool-list/schema parity with the spec. This file serves
 * tools/list with the spec's exact input schema as an
 * explicit literal, and every tools/call is validated by the
 * core, which names the offending path on invalid input.
 *
 * The extraction is pure local computation: no upstream API,
 * no authentication, no configuration.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { extractConfigOptions, formatPayload, VERSION } from "./configdoc.js";

const TOOLS = [
  {
    name: "extract_config_options",
    description:
      "Extract every configuration option read in the code — process.env and import.meta.env reads — with the default each read falls back to, in one inventory.",
    inputSchema: {
      type: "object" as const,
      properties: {
        files: {
          type: "array",
          description: "Source files to scan (at least one)",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path (unique across the set)" },
              content: { type: "string", description: "Full source text of the file" },
            },
            required: ["path", "content"],
          },
        },
      },
      required: ["files"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "configdoc", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "extract_config_options") {
      const raw = (args ?? {}) as Record<string, unknown>;
      out = extractConfigOptions(raw.files);
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
