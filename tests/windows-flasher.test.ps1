# No board is accessed. Every port/hardware operation is mocked.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../installer/flash.ps1')
$originalNativeInvoke = ${function:Invoke-FlashTool}
$temp = Join-Path ([IO.Path]::GetTempPath()) ('zach-windows-test-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path (Join-Path $temp 'firmware') -Force
$script:Root = $temp
$script:Firmware = Join-Path $temp 'firmware'
$script:Count = 0
function Assert($value, $message) { if (!$value) { throw $message }; $script:Count++ }
function Expect-Failure($action) { $failed = $false; try { & $action } catch { $failed = $true }; Assert $failed 'Expected a failure' }
function Reset-Fixture {
    [IO.File]::WriteAllText((Join-Path $script:Firmware 'board.txt'), "FNK0104B`n")
    $lines = @()
    foreach ($entry in @(@('0x0','bootloader.bin'), @('0x8000','partitions.bin'), @('0x10000','zachagotchi.bin'))) {
        $image = New-Object byte[] 128
        $image[0] = 0xe9; $image[12] = 9
        if ($entry[1] -eq 'partitions.bin') { $image[0] = 0xaa; $image[1] = 0x50 }
        $file = Join-Path $script:Firmware $entry[1]
        [IO.File]::WriteAllBytes($file, $image)
        $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
        $lines += ($entry[0] + "`t" + $entry[1] + "`t" + $hash + "`t128")
    }
    [IO.File]::WriteAllText((Join-Path $script:Firmware 'manifest.tsv'), ($lines -join "`n") + "`n")
    $script:Calls = New-Object 'System.Collections.Generic.List[object]'
    $script:Answers = New-Object 'System.Collections.Generic.Queue[string]'
    $script:Answers.Enqueue('1'); $script:Answers.Enqueue('INSTALL')
    $script:Scenario = ''
}
function Test-WindowsTool {} # Never invoke an actual bundled flashing executable here.
function Get-BoardPorts { return @('COM-TEST-ONLY') }
function Read-Host { param($Prompt) if (!$script:Answers.Count) { throw 'Unexpected input/EOF' }; return $script:Answers.Dequeue() }
function Invoke-FlashTool {
    param([string[]]$ToolArgs, [string]$After = 'no-reset')
    $script:Calls.Add([pscustomobject]@{Args=$ToolArgs; After=$After})
    switch ($ToolArgs[0]) {
        'flash-id' {
            if ($script:Scenario -eq 'connection') { throw 'mock connection failure' }
            if ($script:Scenario -eq 'size') { return 'Detected flash size: 8MB' }
            if ($script:Scenario -eq 'corrupt') { Add-Content -LiteralPath (Join-Path $script:Firmware 'zachagotchi.bin') -Value 'corrupt' }
            return 'Detected flash size: 16 MB'
        }
        'write-flash' { if ($script:Scenario -eq 'write') { throw 'mock write failure' }; return 'mock write OK' }
        'verify-flash' { if ($script:Scenario -eq 'verify') { throw 'mock verification failure' }; return 'mock verify OK' }
        default { throw 'Unexpected tool command' }
    }
}
try {
    Reset-Fixture
    Test-Firmware
    Assert ($script:FlashArgs.Count -eq 6) 'Expected exactly three offset/file pairs'
    Assert (($script:FlashArgs -join ' ') -notmatch '0x9000') 'Must not include an NVS payload'
    Start-ZachagotchiInstall
    Assert ($script:Calls.Count -eq 3) 'Expected identify, write and verify'
    Assert ($script:Calls[0].Args[0] -eq 'flash-id') 'Must identify first'
    Assert (($script:Calls[1].Args[0..1] -join ' ') -eq 'write-flash --erase-all') 'Must explicitly erase all on clean install'
    Assert ($script:Calls[2].After -eq 'watchdog-reset') 'Must reset after verification'
    Assert (($script:Calls.Args -join ' ') -notmatch 'read-flash|--force') 'Never back up or force unsupported chips'
    foreach ($caseName in @('connection','size','corrupt','write','verify')) {
        Reset-Fixture; $script:Scenario = $caseName
        Expect-Failure { Start-ZachagotchiInstall }
        $expected = 1
        if ($caseName -eq 'write') { $expected = 2 }
        if ($caseName -eq 'verify') { $expected = 3 }
        Assert ($script:Calls.Count -eq $expected) ('Unexpected calls after ' + $caseName)
    }
    foreach ($answer in @('', 'install', 'q')) {
        Reset-Fixture; $script:Answers.Clear()
        if ($answer -ne 'q') { $script:Answers.Enqueue('1') }
        $script:Answers.Enqueue($answer)
        Start-ZachagotchiInstall
        Assert ($script:Calls.Count -eq 0) 'Cancellation must not access hardware'
    }
    Reset-Fixture; $script:Answers.Clear(); $script:Answers.Enqueue('1')
    Expect-Failure { Start-ZachagotchiInstall }
    Assert ($script:Calls.Count -eq 0) 'EOF must not access hardware'
    Reset-Fixture
    [IO.File]::WriteAllText((Join-Path $script:Firmware 'board.txt'), 'FNK0104A')
    Expect-Failure { Start-ZachagotchiInstall }
    Assert ($script:Calls.Count -eq 0) 'Wrong board must not access hardware'
    Reset-Fixture
    Add-Content -LiteralPath (Join-Path $script:Firmware 'zachagotchi.bin') -Value 'corrupt'
    Expect-Failure { Start-ZachagotchiInstall }
    Assert ($script:Calls.Count -eq 0) 'Corrupt image must not access hardware'
    Reset-Fixture
    Remove-Item -LiteralPath (Join-Path $script:Firmware 'bootloader.bin')
    Expect-Failure { Test-Firmware }
    Reset-Fixture
    $manifest = Join-Path $script:Firmware 'manifest.tsv'
    Add-Content -LiteralPath $manifest -Value '0x9000 malicious.bin hash 1'
    Expect-Failure { Test-Firmware }

    # Exercise the REAL native process wrapper with a harmless fake executable.
    Set-Item -Path function:Invoke-FlashTool -Value $originalNativeInvoke
    $script:Port = 'COM-TEST-ONLY'
    $script:Log = Join-Path $temp 'native.log'
    if ($env:OS -eq 'Windows_NT') {
        $script:Tool = Join-Path $temp 'fake-tool.cmd'
        [IO.File]::WriteAllText($script:Tool, "@echo off`r`necho Detected flash size: 16MB`r`nexit /b %ZACH_FAKE_EXIT%`r`n")
    } else {
        $script:Tool = Join-Path $temp 'fake-tool.sh'
        [IO.File]::WriteAllText($script:Tool, "#!/bin/sh`nprintf 'Detected flash size: 16MB\n'`nexit `"`$ZACH_FAKE_EXIT`"`n")
        & chmod +x $script:Tool
    }
    $env:ZACH_FAKE_EXIT = '0'
    $output = Invoke-FlashTool -ToolArgs @('flash-id')
    Assert ($output -match '16MB') 'Native stdout must reach chip check'
    $env:ZACH_FAKE_EXIT = '7'
    Expect-Failure { Invoke-FlashTool -ToolArgs @('flash-id') }
    Assert (Test-Path -LiteralPath $script:Log) 'Native output must be logged'
    $script:Tool = Join-Path $temp 'missing-executable'
    $global:LASTEXITCODE = 0
    Expect-Failure { Invoke-FlashTool -ToolArgs @('flash-id') }
    Write-Host ("PASS: " + $script:Count + ' Windows flasher safety assertions. No real board was accessed.')
} finally {
    Remove-Item Env:ZACH_FAKE_EXIT -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $temp -Recurse -Force
}
