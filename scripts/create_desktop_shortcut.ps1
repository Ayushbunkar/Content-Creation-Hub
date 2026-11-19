$desktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$repoPath = (Get-Item -Path $PSScriptRoot).Parent.FullName
$batPath = Join-Path -Path $repoPath -ChildPath "AI-Video-Studio.bat"
$shortcutPath = Join-Path -Path $desktopPath -ChildPath "AI Video Studio.lnk"

Write-Host "Creating Desktop Shortcut at: $shortcutPath"

try {
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $batPath
    $shortcut.WorkingDirectory = $repoPath
    $shortcut.Description = "AI Video Studio - Local Autonomous Video Creation Platform"

    # Choose best available icon (Edge or Chrome or System icon)
    $pfX86 = [System.Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
    $pf = [System.Environment]::GetEnvironmentVariable('ProgramFiles')
    $localApp = [System.Environment]::GetEnvironmentVariable('LocalAppData')

    $edgePath = if ($pfX86) { Join-Path $pfX86 "Microsoft\Edge\Application\msedge.exe" } else { $null }
    $chromePath = if ($pf) { Join-Path $pf "Google\Chrome\Application\chrome.exe" } else { $null }
    $chromeUser = if ($localApp) { Join-Path $localApp "Google\Chrome\Application\chrome.exe" } else { $null }

    if ($edgePath -and (Test-Path $edgePath)) {
        $shortcut.IconLocation = "$edgePath,0"
    } elseif ($chromePath -and (Test-Path $chromePath)) {
        $shortcut.IconLocation = "$chromePath,0"
    } elseif ($chromeUser -and (Test-Path $chromeUser)) {
        $shortcut.IconLocation = "$chromeUser,0"
    } else {
        $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,14"
    }

    $shortcut.Save()
    Write-Host "[SUCCESS] Desktop shortcut created successfully!"
} catch {
    Write-Host "[WARNING] Could not create desktop shortcut: $_"
}
