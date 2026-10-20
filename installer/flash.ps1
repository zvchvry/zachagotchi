# Zachagotchi Windows terminal flasher. No Python or administrator rights needed.
# Compatible with Windows PowerShell 5.1; dot-source to test without autorunning.
[CmdletBinding()]
param([switch]$Check, [switch]$ToolVersion, [switch]$NoPause)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$script:Root = $PSScriptRoot
$script:Firmware = Join-Path $script:Root 'firmware'
$script:Tool = Join-Path $script:Root 'esptool.exe'
$script:Log = $null

function Test-Firmware {
    $boardFile = Join-Path $script:Firmware 'board.txt'
    $manifestFile = Join-Path $script:Firmware 'manifest.tsv'
    if (!(Test-Path -LiteralPath $boardFile -PathType Leaf) -or
        !(Test-Path -LiteralPath $manifestFile -PathType Leaf)) { throw 'Firmware is missing. Download and extract the complete ZIP.' }
    if ((Get-Content -LiteralPath $boardFile -Raw).Trim() -cne 'FNK0104B') { throw 'Unsupported board profile.' }
    $rows = @(Get-Content -LiteralPath $manifestFile)
    if ($rows.Count -ne 3) { throw 'Invalid firmware manifest.' }
    $names = @('bootloader.bin', 'partitions.bin', 'zachagotchi.bin')
    $offsets = @('0x0', '0x8000', '0x10000')
    $limits = @(32768, 4096, 16711680)
    $flash = @()
    for ($i = 0; $i -lt 3; $i++) {
        $fields = $rows[$i].Split("`t")
        if ($fields.Count -ne 4 -or $fields[0] -cne $offsets[$i] -or $fields[1] -cne $names[$i] -or
            $fields[2] -cnotmatch '^[0-9a-f]{64}$' -or $fields[3] -notmatch '^[1-9][0-9]{0,7}$') { throw 'Invalid firmware manifest entry.' }
        $file = Join-Path $script:Firmware $names[$i]
        $item = Get-Item -LiteralPath $file
        if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            $item.Length -ne [long]$fields[3] -or $item.Length -gt $limits[$i] -or $item.Length -lt 24) { throw 'Invalid firmware file size or path.' }
        if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $fields[2]) { throw ('Checksum mismatch: ' + $names[$i]) }
        $bytes = [IO.File]::ReadAllBytes($file)
        if ($i -eq 1) {
            if ($bytes[0] -ne 0xaa -or $bytes[1] -ne 0x50) { throw 'Invalid partition header.' }
        } elseif ($bytes[0] -ne 0xe9 -or $bytes[12] -ne 9 -or $bytes[13] -ne 0) { throw 'Expected an ESP32-S3 image.' }
        $flash += @($offsets[$i], $file)
    }
    $script:FlashArgs = $flash
}

function Test-WindowsTool {
    if ($env:OS -ne 'Windows_NT') { throw 'Flashing requires Windows 10/11 x64.' }
    if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or
        ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64' -and $env:PROCESSOR_ARCHITEW6432 -ne 'AMD64')) { throw 'This package supports x64 Windows, not ARM64 or 32-bit Windows.' }
    if (!(Test-Path -LiteralPath $script:Tool -PathType Leaf)) { throw 'esptool.exe is missing. Extract the entire ZIP first.' }
}

function Get-BoardPorts { return @([IO.Ports.SerialPort]::GetPortNames() | Sort-Object) }
function Select-BoardPort {
    while ($true) {
        $ports = @(Get-BoardPorts)
        Write-Host "`nSerial ports (unplug/reconnect the board to identify its COM port):"
        for ($i = 0; $i -lt $ports.Count; $i++) { Write-Host ('  {0}) {1}' -f ($i + 1), $ports[$i]) }
        if (!$ports.Count) { Write-Host '  None found. Connect a USB data cable and close other serial tools.' }
        $answer = Read-Host 'Choose a number, r to scan again, or q to quit'
        if ($answer -match '^[qQ]$') { return $null }
        if ($answer -match '^[1-9][0-9]?$' -and [int]$answer -le $ports.Count) { return $ports[[int]$answer - 1] }
    }
}

function Invoke-FlashTool {
    param([string[]]$ToolArgs, [string]$After = 'no-reset')
    # Native stderr is not a PowerShell error: inspect the process exit code instead.
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $global:LASTEXITCODE = -1 # A launch failure must not reuse an earlier success.
        $output = @(& $script:Tool --chip esp32s3 --port $script:Port --baud 460800 --after $After @ToolArgs 2>&1)
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $oldPreference }
    foreach ($line in $output) {
        Write-Host ([string]$line)
        Add-Content -LiteralPath $script:Log -Value ([string]$line)
    }
    if ($code -ne 0) { throw ('Flashing tool failed (exit {0}).' -f $code) }
    return ($output -join "`n")
}

function Start-ZachagotchiInstall {
    Test-Firmware
    Test-WindowsTool
    Write-Host "`nZACHAGOTCHI - Windows firmware flasher`n===================================="
    $script:Port = Select-BoardPort
    if (!$script:Port) { return }
    Write-Host ("`nSelected: " + $script:Port)
    Write-Host 'CLEAN INSTALL - Zachagotchi for FNK0104B. Check the model printed on your board.'
    Write-Host 'This erases ALL flash: the current program, Wi-Fi settings and saved progress.'
    Write-Host 'No backup will be made. Keep USB connected. There is no undo.'
    $confirm = Read-Host 'Type INSTALL to erase and install, or press Enter to cancel'
    if ($confirm -cne 'INSTALL') { Write-Host 'Cancelled. Nothing on the board was changed.'; return }
    $script:Log = Join-Path ([IO.Path]::GetTempPath()) ('zachagotchi-install-' + [guid]::NewGuid().ToString('N') + '.log')
    Write-Host ('Installation log: ' + $script:Log)
    Write-Host "`nChecking chip and flash size..."
    try { $identified = Invoke-FlashTool -ToolArgs @('flash-id') }
    catch { throw 'No connection to the ESP32-S3. No firmware was written. Hold BOOT, tap RESET/RST, release BOOT, then restart this installer and reselect the port.' }
    if ($identified -notmatch '(?m)^Detected flash size: 16\s*MB\s*$') { throw 'Expected 16 MB flash. Nothing was erased or written.' }
    Test-Firmware # Revalidate immediately before any destructive command.
    Write-Host "`nErasing all flash and installing Zachagotchi..."
    try {
        $null = Invoke-FlashTool -ToolArgs (@('write-flash', '--erase-all') + $script:FlashArgs)
        $null = Invoke-FlashTool -ToolArgs (@('verify-flash') + $script:FlashArgs) -After 'watchdog-reset'
    } catch { throw 'Installation or verification failed. The old program may already be erased. Keep USB connected and retry using BOOT/RESET.' }
    Write-Host "`nZachagotchi installed and verified. If the screen stays black, tap RESET/RST without BOOT."
}

if ($MyInvocation.InvocationName -ne '.') {
    $status = 0
    try {
        if ($Check) { Test-Firmware; Write-Host 'Firmware manifest, sizes, headers and SHA-256 checks passed.' }
        elseif ($ToolVersion) {
            Test-WindowsTool
            $global:LASTEXITCODE = -1
            & $script:Tool version
            if ($LASTEXITCODE -ne 0) { throw 'Bundled flashing tool could not run.' }
        } else { Start-ZachagotchiInstall }
    } catch { Write-Host ("`nSTOPPED: " + $_.Exception.Message) -ForegroundColor Red; $status = 1 }
    if (!$NoPause -and !$Check -and !$ToolVersion) { $null = Read-Host 'Press Enter to close' }
    exit $status
}
