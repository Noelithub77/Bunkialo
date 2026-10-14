param(
    [string]$InstallDir = "$env:LOCALAPPDATA\Bunkialo\bin",
    [switch]$SkipSkill,
    [switch]$SkipLogin
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Use install.sh on macOS and Linux.' }
if (-not [IO.Path]::IsPathRooted($InstallDir)) { throw 'InstallDir must be an absolute path.' }
$architecture = $env:PROCESSOR_ARCHITEW6432
if (-not $architecture) { $architecture = $env:PROCESSOR_ARCHITECTURE }
switch ($architecture) {
    'AMD64' { $target = 'x86_64-pc-windows-msvc' }
    'ARM64' { $target = 'aarch64-pc-windows-msvc' }
    default { throw "Unsupported CPU architecture: $architecture" }
}
$asset = "bunkialo-$target.exe"
$releaseUrl = 'https://github.com/Noelithub77/bunkialo2/releases/download/cli-latest'
$skillUrl = 'https://github.com/Noelithub77/bunkialo2/tree/main/skills/bunkialo-academic-portals'
$taskTemp = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString())
$staged = $null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try {
    New-Item -ItemType Directory -Path $taskTemp | Out-Null
    $download = Join-Path $taskTemp 'bunkialo.exe'
    $checksum = Join-Path $taskTemp 'checksum'
    Write-Host "Downloading Bunkialo for $target…"
    Invoke-WebRequest "$releaseUrl/$asset" -OutFile $download -UseBasicParsing
    Invoke-WebRequest "$releaseUrl/$asset.sha256" -OutFile $checksum -UseBasicParsing
    $expected = ((Get-Content $checksum -Raw).Trim() -split '\s+')[0]
    $actual = (Get-FileHash $download -Algorithm SHA256).Hash
    if ($expected -notmatch '^[0-9a-fA-F]{64}$' -or $expected -ne $actual) {
        throw 'Checksum verification failed; the existing installation was preserved.'
    }
    & $download --help | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'The downloaded binary cannot run on this computer.' }
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    $binary = Join-Path $InstallDir 'bunkialo.exe'
    $staged = Join-Path $InstallDir ([Guid]::NewGuid().ToString() + '.exe')
    Copy-Item $download $staged
    Move-Item $staged $binary -Force
    $shortcut = Join-Path $InstallDir 'wifix.cmd'
    $launcher = '@"%~dp0bunkialo.exe" wifix %*'
    if (-not (Test-Path $shortcut) -or (Get-Content $shortcut -Raw).Trim() -eq $launcher) {
        [IO.File]::WriteAllText($shortcut, $launcher + "`r`n", [Text.Encoding]::ASCII)
    } else { Write-Warning 'Kept your existing wifix command. Use bunkialo wifix instead.' }
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (($userPath -split ';') -notcontains $InstallDir) {
        [Environment]::SetEnvironmentVariable('Path', "$InstallDir;$userPath", 'User')
    }
    if (($env:Path -split ';') -notcontains $InstallDir) { $env:Path = "$InstallDir;$env:Path" }
    Write-Host "Installed $binary. New terminals will have bunkialo on PATH."
    $interactive = -not [Console]::IsInputRedirected
    if (-not $SkipSkill -and $interactive) {
        $answer = Read-Host 'Install the Bunkialo agent skill? [y/N]'
        if ($answer -match '^(y|yes)$') {
            $npx = Get-Command npx.cmd -ErrorAction SilentlyContinue
            if (-not $npx) { $npx = Get-Command npx -ErrorAction SilentlyContinue }
            if ($npx) {
                try {
                    & $npx.Source --yes skills add $skillUrl --global
                    if ($LASTEXITCODE -ne 0) { throw 'Skills CLI returned an error.' }
                } catch { Write-Warning "Skill installation failed; the CLI is installed. Retry: npx skills add $skillUrl --global" }
            } else { Write-Host "Skill installation needs Node.js and npx. After installing Node.js, run: npx skills add $skillUrl --global" }
        }
    }
    if (-not $SkipLogin -and $interactive) {
        Write-Host 'Starting browser login…'
        & $binary login
        if ($LASTEXITCODE -ne 0) { throw 'Login did not complete. The CLI is installed; retry bunkialo login.' }
    } elseif (-not $SkipLogin) { Write-Host 'No interactive terminal found. Run bunkialo login when ready.' }
} finally {
    Remove-Item $taskTemp -Recurse -Force -ErrorAction SilentlyContinue
    if ($staged) { Remove-Item $staged -Force -ErrorAction SilentlyContinue }
}
