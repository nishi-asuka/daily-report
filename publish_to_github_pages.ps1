param(
  [Parameter(Mandatory = $true)]
  [string]$RepositoryUrl
)

$ErrorActionPreference = "Stop"

git remote remove origin 2>$null
git remote add origin $RepositoryUrl
git branch -M main
git push -u origin main

Write-Host ""
Write-Host "Push completed."
Write-Host "Next: open the repository on GitHub, then Settings > Pages > Deploy from a branch > main / root."
