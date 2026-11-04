// Kiro PreToolUse hook: scan staged files before any `git commit` command.
// Exit 2 blocks the tool call and forwards stderr to the agent.
import { spawnSync } from "node:child_process";

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;

if (!/git\s+commit/.test(input)) process.exit(0);

const result = spawnSync("node", ["scripts/secret-scan.mjs"], { encoding: "utf8" });
if (result.status !== 0) {
  process.stderr.write(result.stderr || "Secret scan failed.\n");
  process.exit(2);
}
