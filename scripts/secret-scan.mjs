// Scans staged files for likely secrets. Exit 1 if any are found.
// Usage: node scripts/secret-scan.mjs
// Stopgap until gitleaks is installed; the repo is public, so keys must never be committed.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, "AWS access key id"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\bsk-[A-Za-z0-9_-]{20,}/, "API key (sk-...)"],
  [/\bghp_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/(api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"'\s]{16,}["']/i, "hard-coded credential"],
  [/KIRO_API_KEY\s*[:=]\s*\S{8,}/, "Kiro API key"],
];

const staged = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

let found = 0;
for (const file of staged) {
  if (file.endsWith("package-lock.json") || file.endsWith(".pdf")) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const [re, label] of PATTERNS) {
    if (re.test(text)) {
      console.error(`Possible secret in ${file}: ${label}`);
      found++;
    }
  }
}

if (found > 0) {
  console.error(`Blocked: ${found} possible secret(s) in staged files.`);
  process.exit(1);
}
