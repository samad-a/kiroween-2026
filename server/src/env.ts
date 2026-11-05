// Load the repo-root .env into process.env, if present. No dependency: Node 20.6+
// supports --env-file, but loading here keeps `tsx watch` and tests consistent.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

try {
  const path = fileURLToPath(new URL("../../.env", import.meta.url));
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
} catch {
  // No .env: fine, the stub provider needs no config.
}
