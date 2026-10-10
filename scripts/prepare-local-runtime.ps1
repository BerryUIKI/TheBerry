$ErrorActionPreference = "Stop"

$version = "b11425"
$resourceRoot = Join-Path $PSScriptRoot "..\src-tauri\resources\llama"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resourceFullPath = [System.IO.Path]::GetFullPath($resourceRoot)
$repositoryPrefix = $repositoryRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
if (-not $resourceFullPath.StartsWith($repositoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Runtime resource path resolved outside the repository: $resourceFullPath"
}
$downloadRoot = Join-Path $env:RUNNER_TEMP "theberry-llama-$version"
$releaseRoot = "https://github.com/ggml-org/llama.cpp/releases/download/$version"

if (Test-Path -LiteralPath $resourceRoot) {
  foreach ($backend in @("cpu", "vulkan", "cuda")) {
    $backendPath = Join-Path $resourceRoot $backend
    if (Test-Path -LiteralPath $backendPath) {
      Remove-Item -LiteralPath $backendPath -Recurse -Force
    }
  }
}
New-Item -ItemType Directory -Force -Path $resourceRoot, $downloadRoot | Out-Null

$packages = @(
  @{ Backend = "cpu"; Asset = "llama-b11425-bin-win-cpu-x64.zip" },
  @{ Backend = "vulkan"; Asset = "llama-b11425-bin-win-vulkan-x64.zip" },
  @{ Backend = "cuda"; Asset = "llama-b11425-bin-win-cuda-12.4-x64.zip" }
)

foreach ($package in $packages) {
  $backend = $package.Backend
  $archive = Join-Path $downloadRoot "$backend.zip"
  $expanded = Join-Path $downloadRoot "$backend-expanded"
  $destination = Join-Path $resourceRoot $backend
  New-Item -ItemType Directory -Force -Path $destination | Out-Null
  Invoke-WebRequest -Uri "$releaseRoot/$($package.Asset)" -OutFile $archive
  Expand-Archive -LiteralPath $archive -DestinationPath $expanded -Force
  $server = Get-ChildItem -LiteralPath $expanded -Filter "llama-server.exe" -File -Recurse | Select-Object -First 1
  if (-not $server) {
    throw "The $backend archive did not contain llama-server.exe."
  }
  Copy-Item -Path (Join-Path $server.DirectoryName "*") -Destination $destination -Recurse -Force
}

$cudaArchive = Join-Path $downloadRoot "cuda-runtime.zip"
$cudaExpanded = Join-Path $downloadRoot "cuda-runtime-expanded"
Invoke-WebRequest -Uri "$releaseRoot/cudart-llama-bin-win-cuda-12.4-x64.zip" -OutFile $cudaArchive
Expand-Archive -LiteralPath $cudaArchive -DestinationPath $cudaExpanded -Force
$cudaDestination = Join-Path $resourceRoot "cuda"
Get-ChildItem -LiteralPath $cudaExpanded -Filter "*.dll" -File -Recurse | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $cudaDestination -Force
}

Invoke-WebRequest -Uri "https://raw.githubusercontent.com/ggml-org/llama.cpp/$version/LICENSE" -OutFile (Join-Path $resourceRoot "LICENSE.llama.cpp")

foreach ($backend in @("cpu", "vulkan", "cuda")) {
  $serverPath = Join-Path (Join-Path $resourceRoot $backend) "llama-server.exe"
  if (-not (Test-Path -LiteralPath $serverPath)) {
    throw "Prepared $backend runtime is missing llama-server.exe."
  }
  $versionText = (& $serverPath --version 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0 -or $versionText -notmatch $version) {
    throw "Prepared $backend runtime did not report the pinned llama.cpp version $version."
  }
}

Write-Host "Prepared llama.cpp $version CPU, Vulkan, and CUDA runtimes in $resourceRoot"
