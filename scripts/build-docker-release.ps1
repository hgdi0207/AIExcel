param(
    [string]$Version = (Get-Date -Format 'yyyyMMdd-HHmmss'),
    [ValidateSet('linux/amd64', 'linux/arm64')]
    [string]$Platform = 'linux/amd64',
    [string]$OutputDirectory = 'release',
    [string]$NpmRegistry = 'https://registry.npmmirror.com',
    [string]$NpmProxy = 'http://host.docker.internal:7890'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bundleDirectory = Join-Path (Join-Path $projectRoot $OutputDirectory) "aiexcel-app-$Version"
$archivePath = Join-Path $bundleDirectory 'aiexcel-app-images.tar'
Set-Location $projectRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI was not found. Start Docker Desktop and try again.'
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is not running.' }

New-Item -ItemType Directory -Force -Path $bundleDirectory | Out-Null
$commonBuildArgs = @('--build-arg', "NPM_REGISTRY=$NpmRegistry")
if ($NpmProxy) { $commonBuildArgs += @('--build-arg', "NPM_PROXY=$NpmProxy") }
$images = @(
    @{ Name = 'aiexcel-backend'; Dockerfile = 'backend/Dockerfile'; BuildArgs = $commonBuildArgs },
    @{ Name = 'aiexcel-frontend'; Dockerfile = 'frontend/Dockerfile'; BuildArgs = $commonBuildArgs + @('--build-arg', 'BACKEND_ORIGIN=http://backend:3000') }
)

foreach ($image in $images) {
    $versionTag = "$($image.Name):$Version"
    $latestTag = "$($image.Name):latest"
    $arguments = @('buildx', 'build', '--platform', $Platform, '--load', '--file', $image.Dockerfile, '--tag', $versionTag, '--tag', $latestTag) + $image.BuildArgs + @('.')
    Write-Host "Building $versionTag for $Platform with $NpmRegistry..." -ForegroundColor Cyan
    & docker @arguments
    if ($LASTEXITCODE -ne 0) { throw "Failed to build $($image.Name)" }
}

Write-Host 'Exporting backend and frontend images...' -ForegroundColor Cyan
docker save --output $archivePath `
    "aiexcel-backend:$Version" 'aiexcel-backend:latest' `
    "aiexcel-frontend:$Version" 'aiexcel-frontend:latest'
if ($LASTEXITCODE -ne 0) { throw 'Failed to export Docker images' }

Copy-Item (Join-Path $PSScriptRoot 'deploy-app-images.sh') $bundleDirectory
$hash = Get-FileHash -Algorithm SHA256 $archivePath
$checksumPath = Join-Path $bundleDirectory 'SHA256SUMS'
[System.IO.File]::WriteAllText(
    $checksumPath,
    "$($hash.Hash.ToLower())  aiexcel-app-images.tar`n",
    [System.Text.UTF8Encoding]::new($false)
)
$manifest = @"
AI Excel application update: $Version
Platform: $Platform
Images:
  aiexcel-backend:latest
  aiexcel-backend:$Version
  aiexcel-frontend:latest
  aiexcel-frontend:$Version
PostgreSQL, Redis, and Pivot Export are not included.
"@
[System.IO.File]::WriteAllText(
    (Join-Path $bundleDirectory 'MANIFEST.txt'),
    ($manifest -replace "`r`n", "`n") + "`n",
    [System.Text.UTF8Encoding]::new($false)
)
Write-Host "Release created: $bundleDirectory" -ForegroundColor Green
