param(
  [Parameter(Mandatory = $true)]
  [string]$RepositoryUrl
)

$ErrorActionPreference = "Stop"

$RepoPath = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$SafeRepoPath = $RepoPath.Replace("\", "/")
Set-Location -LiteralPath $RepoPath

function Invoke-RepoGit {
  & git -c "safe.directory=$SafeRepoPath" @args
  if ($LASTEXITCODE -ne 0) {
    throw "git command failed: git $args"
  }
}

$userName = & git -c "safe.directory=$SafeRepoPath" config user.name
if ($LASTEXITCODE -ne 0 -or -not $userName) {
  Invoke-RepoGit config user.name "Codex"
}

$userEmail = & git -c "safe.directory=$SafeRepoPath" config user.email
if ($LASTEXITCODE -ne 0 -or -not $userEmail) {
  Invoke-RepoGit config user.email "codex@local"
}

$remoteNames = @(& git -c "safe.directory=$SafeRepoPath" remote)
if ($LASTEXITCODE -ne 0) {
  throw "git remote check failed"
}

if ($remoteNames -contains "origin") {
  Invoke-RepoGit remote set-url origin $RepositoryUrl
} else {
  Invoke-RepoGit remote add origin $RepositoryUrl
}

Invoke-RepoGit branch -M main

$status = & git -c "safe.directory=$SafeRepoPath" status --porcelain
if ($LASTEXITCODE -ne 0) {
  throw "git status failed"
}
if ($status) {
  Invoke-RepoGit add .
  Invoke-RepoGit commit -m "Update personal schedule PWA"
}

Invoke-RepoGit push -u origin main

Write-Host ""
Write-Host "Push completed."
Write-Host "Next: open the repository on GitHub, then Settings > Pages > Deploy from a branch > main / root."
