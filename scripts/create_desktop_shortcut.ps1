$desktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$repoPath = (Get-Item -Path $PSScriptRoot).Parent.FullName
$batPath = Join-Path -Path $repoPath -ChildPath "AI-Video-Studio.bat"
$shortcutPath = Join-Path -Path $desktopPath -ChildPath "AI Video Studio.lnk"

Write-Host "Creating Desktop Shortcut at: $shortcutPath"

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $batPath
$shortcut.WorkingDirectory = $repoPath
$shortcut.Description = "AI Video Studio - Local Autonomous Video Creation Platform"

# Choose best available icon (Edge or Chrome or System icon)
$edgePath = "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"
$chromePath = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
if (Test-Path $edgePath) {
    $shortcut.IconLocation = "$edgePath,0"
} elseif (Test-Path $chromePath) {
    $shortcut.IconLocation = "$chromePath,0"
} else {
    $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,14"
}

$shortcut.Save()
Write-Host "[SUCCESS] Desktop shortcut created successfully!"
