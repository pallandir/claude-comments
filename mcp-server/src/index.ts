import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startIngestServer } from "./http.js";
import { createMcpServer } from "./server.js";
import { CommentStore } from "./store.js";

const DEFAULT_PORTS = [7474, 7475, 7476];

function parsePorts(): number[] {
  const fromEnv = process.env.CLAUDE_COMMENTS_PORT;
  if (!fromEnv) return DEFAULT_PORTS;
  const port = Number(fromEnv);
  return Number.isInteger(port) ? [port, ...DEFAULT_PORTS] : DEFAULT_PORTS;
}

async function main(): Promise<void> {
  const root = process.env.CLAUDE_COMMENTS_ROOT ?? process.cwd();
  const store = new CommentStore(root);

  // stdout is reserved for the MCP protocol; all logs go to stderr.
  const log = (msg: string) => process.stderr.write(`[claude-comments] ${msg}\n`);

  const ingest = await startIngestServer(store, parsePorts(), log);
  log(`ingest listening on http://127.0.0.1:${ingest.port}, store root ${root}`);

  const server = createMcpServer(store);
  await server.connect(new StdioServerTransport());

  const shutdown = async () => {
    await ingest.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  process.stderr.write(`[claude-comments] fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
