# LOCAL AI VIDEO STUDIO — Startup Script
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " LOCAL AI VIDEO STUDIO — Starting Up" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

$port = 3000
$tcp = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($tcp) {
    Write-Host "[OK] Local AI Video Studio server is already running on port $port." -ForegroundColor Green
} else {
    Write-Host "[*] Starting background server on port $port..." -ForegroundColor Yellow
    Start-Process -FilePath "npx.cmd" -ArgumentList "tsx server/index.ts" -NoNewWindow
    Start-Sleep -Seconds 3
}

Write-Host "[*] Opening http://127.0.0.1:$port in default browser..." -ForegroundColor Green
Start-Process "http://127.0.0.1:$port"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " Studio URL: http://127.0.0.1:$port" -ForegroundColor White
Write-Host " Run .\stop.ps1 to shutdown the server." -ForegroundColor Gray
Write-Host "=======================================================" -ForegroundColor Cyan
