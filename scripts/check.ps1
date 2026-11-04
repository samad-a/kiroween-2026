# Runs typecheck and tests, writing everything to check.log (gitignored).
# Workaround for terminals that drop output; normal use is `npm run typecheck` and `npm test`.
$ErrorActionPreference = "Continue"
$log = Join-Path $PSScriptRoot "..\check.log"
"=== typecheck" | Out-File $log -Encoding utf8
npm.cmd run typecheck 2>&1 | Out-File $log -Append -Encoding utf8
"typecheck exit: $LASTEXITCODE" | Out-File $log -Append -Encoding utf8
"=== test" | Out-File $log -Append -Encoding utf8
$env:NO_COLOR = "1"
npm.cmd test 2>&1 | Out-File $log -Append -Encoding utf8
"test exit: $LASTEXITCODE" | Out-File $log -Append -Encoding utf8
"CHECK_DONE" | Out-File $log -Append -Encoding utf8
if ($args -contains "-build") {
  "=== build" | Out-File $log -Append -Encoding utf8
  npm.cmd run build 2>&1 | Out-File $log -Append -Encoding utf8
  "build exit: $LASTEXITCODE" | Out-File $log -Append -Encoding utf8
  "BUILD_DONE" | Out-File $log -Append -Encoding utf8
}
