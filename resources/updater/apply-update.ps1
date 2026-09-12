# Applies a staged self-update: copies the staged folder over the install dir
# with a real progress bar, then relaunches the exe. Invoked by apply-update.cmd
# (which waits for the old process to fully exit first) with -WindowStyle Hidden,
# so this script's own console is suppressed while its WinForms window (a real
# GUI window, independent of the console) shows normally — no console flash.
#
# Why PowerShell rather than another copy of the app: Windows won't let a
# running process overwrite its own .exe, so the swap has to happen from a
# genuinely separate process. Why a .cmd hands off to this rather than Node
# spawning powershell.exe directly: spawning powershell.exe with Node's
# `detached: true` silently no-ops it (it gets a PID but never runs the
# script) — a plain cmd.exe helper survives detachment fine, so it does the
# PID-wait and launches this script as its own normal (non-detached) child.

param([Parameter(Mandatory = $true)][string]$ArgsFile)

$cfg = Get-Content -Raw -Path $ArgsFile | ConvertFrom-Json
$src = $cfg.src
$dest = $cfg.dest
$exePath = $cfg.exePath

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = 'PAK-MEN Updater'
$form.FormBorderStyle = 'FixedDialog'
$form.ControlBox = $false
$form.MinimizeBox = $false
$form.MaximizeBox = $false
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true
$form.ClientSize = New-Object System.Drawing.Size(360, 110)
$form.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#1c1e26')

$label = New-Object System.Windows.Forms.Label
$label.Text = 'Applying update...'
$label.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#e5e7ef')
$label.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$label.AutoSize = $false
$label.Size = New-Object System.Drawing.Size(320, 20)
$label.Location = New-Object System.Drawing.Point(20, 24)
$form.Controls.Add($label)

$bar = New-Object System.Windows.Forms.ProgressBar
$bar.Size = New-Object System.Drawing.Size(320, 18)
$bar.Location = New-Object System.Drawing.Point(20, 56)
$bar.Minimum = 0
$bar.Maximum = 100
$bar.Value = 0
$form.Controls.Add($bar)

$form.Show()
[System.Windows.Forms.Application]::DoEvents()

function Set-Status([string]$Text, [int]$Percent) {
    $label.Text = $Text
    $bar.Value = [Math]::Max(0, [Math]::Min(100, $Percent))
    [System.Windows.Forms.Application]::DoEvents()
}

$files = @(Get-ChildItem -Path $src -Recurse -File | ForEach-Object { $_.FullName.Substring($src.Length + 1) })
# app.asar and the main .exe land last: the currently-running app has them
# open until the moment it fully exits above, and every other file copying
# first makes the "did it actually do anything yet" wait feel shorter.
$sensitive = @($files | Where-Object { $_ -match '\.exe$' -or ($_ -replace '\\', '/') -eq 'resources/app.asar' })
$normal = @($files | Where-Object { -not ($_ -match '\.exe$' -or ($_ -replace '\\', '/') -eq 'resources/app.asar') })
$ordered = $normal + $sensitive
$total = [Math]::Max(1, $ordered.Count)
$done = 0

foreach ($rel in $ordered) {
    $s = Join-Path $src $rel
    $d = Join-Path $dest $rel
    $dDir = Split-Path $d -Parent
    if (-not (Test-Path -LiteralPath $dDir)) { New-Item -ItemType Directory -Path $dDir -Force | Out-Null }
    Copy-Item -LiteralPath $s -Destination $d -Force
    $done++
    Set-Status "Applying update... $([int](($done / $total) * 100))%" ([int](($done / $total) * 100))
}

Remove-Item -LiteralPath $src -Recurse -Force -ErrorAction SilentlyContinue

Set-Status 'Restarting...' 100
Start-Sleep -Milliseconds 300

Start-Process -FilePath $exePath
$form.Close()
