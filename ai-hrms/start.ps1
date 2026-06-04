# AI-HRMS Quick Start Script for Windows PowerShell
# Run this from the ai-hrms root directory

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   AI-HRMS — Quick Start (Windows)       " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check PostgreSQL
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
$pgRunning = Get-Process -Name "postgres" -ErrorAction SilentlyContinue
if (-not $pgRunning) {
    Write-Host "  ⚠️  PostgreSQL does not appear to be running." -ForegroundColor Yellow
    Write-Host "     Start PostgreSQL before running this script." -ForegroundColor Gray
} else {
    Write-Host "  ✓ PostgreSQL running" -ForegroundColor Green
}

# Check MongoDB
$mongoRunning = Get-Process -Name "mongod" -ErrorAction SilentlyContinue
if (-not $mongoRunning) {
    Write-Host "  ⚠️  MongoDB does not appear to be running." -ForegroundColor Yellow
    Write-Host "     Start MongoDB before running this script." -ForegroundColor Gray
} else {
    Write-Host "  ✓ MongoDB running" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting backend..." -ForegroundColor Yellow

# Start backend in a new terminal
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$(Join-Path $PSScriptRoot 'backend')'; " +
    "if (-not (Test-Path 'venv')) { python -m venv venv }; " +
    ".\venv\Scripts\Activate.ps1; " +
    "pip install -r requirements.txt -q; " +
    "uvicorn main:app --reload --port 8000"
) -WindowStyle Normal

Write-Host "  ✓ Backend starting at http://localhost:8000" -ForegroundColor Green
Write-Host "  ✓ API Docs at http://localhost:8000/docs" -ForegroundColor Green

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Starting frontend..." -ForegroundColor Yellow

# Start frontend in a new terminal
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$(Join-Path $PSScriptRoot 'frontend')'; npm run dev"
) -WindowStyle Normal

Write-Host "  ✓ Frontend starting at http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Both servers are starting up!" -ForegroundColor Green
Write-Host "  Open http://localhost:5173 in your browser" -ForegroundColor White
Write-Host ""
Write-Host "  Demo logins:" -ForegroundColor White
Write-Host "    Admin:   admin@hrms.com / password123" -ForegroundColor Gray
Write-Host "    Manager: manager@hrms.com / password123" -ForegroundColor Gray
Write-Host "    HR:      hr@hrms.com / password123" -ForegroundColor Gray
Write-Host "    Employee: emp@hrms.com / password123" -ForegroundColor Gray
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To seed demo data (first time only):" -ForegroundColor Yellow
Write-Host "  cd backend && python seed.py" -ForegroundColor Gray
Write-Host ""
