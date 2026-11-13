# LOCAL AI VIDEO STUDIO — Shutdown Script
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " LOCAL AI VIDEO STUDIO — Stopping Server" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

if ($connections) {
    foreach ($conn in $connections) {
        $procId = $conn.OwningProcess
        if ($procId -and $procId -gt 0) {
            Write-Host "[*] Terminating process $procId on port 3000..." -ForegroundColor Yellow
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "[OK] Studio server stopped successfully." -ForegroundColor Green
} else {
    Write-Host "[i] No active server found on port 3000." -ForegroundColor Gray
}
Write-Host "=======================================================" -ForegroundColor Cyan
