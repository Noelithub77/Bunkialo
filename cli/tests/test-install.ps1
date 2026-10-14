param([Parameter(Mandatory)][string]$BinaryPath)
$ErrorActionPreference = 'Stop'
$fixtureBinary = (Resolve-Path $BinaryPath).Path
$fixtureHash = (Get-FileHash $fixtureBinary -Algorithm SHA256).Hash
$taskRoot = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString())
$savedUserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$savedPath = $env:Path
$savedArchitecture = $env:PROCESSOR_ARCHITECTURE
$savedWowArchitecture = $env:PROCESSOR_ARCHITEW6432
$installer = Join-Path $PSScriptRoot '../install.ps1'
$requests = [Collections.Generic.List[string]]::new()
$badHash = $false
# Shadow downloads without accessing the network or invoking login/Skills.
function Invoke-WebRequest {
    param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing)
    $requests.Add($Uri)
    if ($Uri.EndsWith('.sha256')) {
        $hash = if ($badHash) { '0' * 64 } else { $fixtureHash }
        [IO.File]::WriteAllText($OutFile, "$hash  fixture")
    } else { Copy-Item $fixtureBinary $OutFile }
}
try {
    foreach ($architecture in @('AMD64', 'ARM64')) {
        $env:PROCESSOR_ARCHITECTURE = $architecture
        $env:PROCESSOR_ARCHITEW6432 = ''
        $destination = Join-Path $taskRoot "$architecture bin"
        & $installer -InstallDir $destination -SkipLogin -SkipSkill
        $expectedTarget = if ($architecture -eq 'AMD64') { 'x86_64' } else { 'aarch64' }
        if (-not $requests[$requests.Count - 1].Contains("bunkialo-$expectedTarget-pc-windows-msvc.exe.sha256")) { throw 'Incorrect platform asset selected.' }
        if ((Get-Content (Join-Path $destination 'wifix.cmd') -Raw).Trim() -ne '@"%~dp0bunkialo.exe" wifix %*') { throw 'WiFix shortcut was not installed.' }
        if ((Get-FileHash (Join-Path $destination 'bunkialo.exe')).Hash -ne $fixtureHash) { throw 'Installed file differs from fixture.' }
    }
    $badHash = $true
    $destination = Join-Path $taskRoot 'ARM64 bin'
    $rejected = $false
    try { & $installer -InstallDir $destination -SkipLogin -SkipSkill } catch {
        if ($_.Exception.Message -notmatch 'Checksum verification failed') { throw }
        $rejected = $true
    }
    if (-not $rejected) { throw 'Invalid checksum was accepted.' }
    if ((Get-FileHash (Join-Path $destination 'bunkialo.exe')).Hash -ne $fixtureHash) { throw 'Checksum failure replaced the installation.' }
    Write-Host 'Windows installer tests passed: x64/arm64 assets, paths with spaces, install, and checksum rejection.'
} finally {
    [Environment]::SetEnvironmentVariable('Path', $savedUserPath, 'User')
    $env:Path = $savedPath
    $env:PROCESSOR_ARCHITECTURE = $savedArchitecture
    $env:PROCESSOR_ARCHITEW6432 = $savedWowArchitecture
    Remove-Item $taskRoot -Recurse -Force -ErrorAction SilentlyContinue
}
