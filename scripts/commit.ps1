# Stages the given paths and commits, writing everything to commit.log (gitignored).
# Workaround for terminals that drop output, like check.ps1.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/commit.ps1 "message" path1 path2 ...
$ErrorActionPreference = "Continue"
$log = Join-Path $PSScriptRoot "..\commit.log"
$message = $args[0]
$paths = $args[1..($args.Length - 1)]
"=== add" | Out-File $log -Encoding utf8
git add -- $paths 2>&1 | Out-File $log -Append -Encoding utf8
"=== commit" | Out-File $log -Append -Encoding utf8
git commit -m $message 2>&1 | Out-File $log -Append -Encoding utf8
"commit exit: $LASTEXITCODE" | Out-File $log -Append -Encoding utf8
"=== log" | Out-File $log -Append -Encoding utf8
git log --oneline -3 2>&1 | Out-File $log -Append -Encoding utf8
git status --short 2>&1 | Out-File $log -Append -Encoding utf8
"COMMIT_DONE" | Out-File $log -Append -Encoding utf8
