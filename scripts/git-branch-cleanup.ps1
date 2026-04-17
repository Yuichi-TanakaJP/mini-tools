param(
  [switch]$DeleteMerged
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  $output = & git @Args 2>&1
  $exitCode = $LASTEXITCODE

  if ($exitCode -ne 0) {
    throw "git $($Args -join ' ') failed.`n$output"
  }

  return $output
}

$currentBranch = (Invoke-Git -Args @("branch", "--show-current")).Trim()

if ($currentBranch -ne "main") {
  throw "Run this script on 'main'. Current branch: $currentBranch"
}

Write-Host "[branch-cleanup] Fetching latest refs..."
Invoke-Git -Args @("fetch", "--prune") | Out-Null

Write-Host "[branch-cleanup] Fast-forwarding local main..."
Invoke-Git -Args @("merge", "--ff-only", "origin/main") | Out-Null

$protectedBranches = @("main", "master", "develop", "dev")
$mergedBranches = Invoke-Git -Args @("branch", "--merged", "main") |
  ForEach-Object { $_.Trim() } |
  ForEach-Object { $_ -replace '^\*\s*', '' } |
  Where-Object { $_ -and ($_ -notin $protectedBranches) }

if (-not $mergedBranches -or $mergedBranches.Count -eq 0) {
  Write-Host "[branch-cleanup] No merged local branches to clean up."
  exit 0
}

Write-Host "[branch-cleanup] Merged local branches:"
$mergedBranches | ForEach-Object { Write-Host "  - $_" }

if (-not $DeleteMerged) {
  Write-Host ""
  Write-Host "[branch-cleanup] Preview only. Re-run with -DeleteMerged to delete these local branches."
  exit 0
}

Write-Host ""
Write-Host "[branch-cleanup] Deleting merged local branches..."
foreach ($branch in $mergedBranches) {
  Invoke-Git -Args @("branch", "-d", $branch) | Out-Null
  Write-Host "  deleted: $branch"
}

Write-Host ""
Write-Host "[branch-cleanup] Done."
