$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$frontendPort = 3100
$backendPort = 8100

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  MR. RAED ZEID - CLEAN LOCAL START" -ForegroundColor Cyan
Write-Host "  Fresh URL: http://127.0.0.1:$frontendPort" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

function Require-Command([string]$Name, [string]$Message) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw $Message
    }
}

Require-Command powershell "PowerShell was not found."
Require-Command node "Node.js was not found. Install Node.js 20+ first."
Require-Command npm "npm was not found."

$pythonExe = $null
if (Test-Path (Join-Path $root '.venv\Scripts\python.exe')) {
    $pythonExe = Join-Path $root '.venv\Scripts\python.exe'
} elseif (Test-Path (Join-Path (Split-Path $root -Parent) '.venv\Scripts\python.exe')) {
    $pythonExe = Join-Path (Split-Path $root -Parent) '.venv\Scripts\python.exe'
} else {
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) { $pythonExe = $pythonCmd.Source }
}
if (-not $pythonExe) { throw 'Python 3.11+ was not found.' }

# Stop stale copies only when they are Node/Python processes on our dedicated ports.
Write-Host "Checking for an older local copy..."
foreach ($port in @($frontendPort, $backendPort)) {
    $listeners = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        $proc = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
        if (-not $proc) { continue }
        if ($proc.ProcessName -match '^(node|python|pythonw)$') {
            Write-Host "Stopping stale $($proc.ProcessName) on port $port..." -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        } else {
            throw "Port $port is already used by $($proc.ProcessName). Close it, then run again."
        }
    }
}
Start-Sleep -Milliseconds 500

# Create or repair local environment without overwriting a user's Gemini key.
$envPath = Join-Path $root '.env'
if (-not (Test-Path $envPath)) {
    $jwt = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    $pwd = 'Raed@' + [guid]::NewGuid().ToString('N').Substring(0,18) + '!Aa1'
    @(
        'ENV=development',
        "SITE_ADDRESS=http://127.0.0.1:$frontendPort",
        "JWT_SECRET=$jwt",
        'ADMIN_EMAIL=m47662226@gmail.com',
        "ADMIN_PASSWORD=$pwd",
        'ADMIN_OTP_REQUIRED=false',
        "ALLOWED_ORIGINS=http://localhost:$frontendPort,http://127.0.0.1:$frontendPort,http://localhost:3000,http://127.0.0.1:3000",
        'GEMINI_API_KEY=',
        'GEMINI_MODEL=gemini-3.8-flash',
        'SMTP_HOST=',
        'SMTP_PORT=587',
        'SMTP_USERNAME=',
        'SMTP_PASSWORD=',
        'SMTP_FROM='
    ) | Set-Content -Path $envPath -Encoding UTF8
    Write-Host "Created .env. Generated local admin password: $pwd" -ForegroundColor Green
} else {
    $content = Get-Content $envPath -Raw
    if ($content -notmatch '(?m)^ENV=') { $content = "ENV=development`r`n" + $content }
    if ($content -match '(?m)^JWT_SECRET=\s*$') {
        $jwt = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
        $content = [regex]::Replace($content, '(?m)^JWT_SECRET=\s*$', "JWT_SECRET=$jwt")
    }
    if ($content -match '(?m)^ADMIN_PASSWORD=\s*$') {
        $pwd = 'Raed@' + [guid]::NewGuid().ToString('N').Substring(0,18) + '!Aa1'
        $content = [regex]::Replace($content, '(?m)^ADMIN_PASSWORD=\s*$', "ADMIN_PASSWORD=$pwd")
        Write-Host "Generated local admin password: $pwd" -ForegroundColor Green
    }
    $origins = "ALLOWED_ORIGINS=http://localhost:$frontendPort,http://127.0.0.1:$frontendPort,http://localhost:3000,http://127.0.0.1:3000"
    if ($content -match '(?m)^ALLOWED_ORIGINS=.*$') {
        $content = [regex]::Replace($content, '(?m)^ALLOWED_ORIGINS=.*$', $origins)
    } else {
        $content += "`r`n$origins`r`n"
    }
    Set-Content -Path $envPath -Value $content -Encoding UTF8
}

# First-run dependencies.
$frontend = Join-Path $root 'frontend'
$backend = Join-Path $root 'backend'
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
    Write-Host "Installing frontend packages - first run only..." -ForegroundColor Yellow
    Push-Location $frontend
    & npm install
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'npm install failed.' }
    Pop-Location
}

& $pythonExe -c "import fastapi,sqlalchemy,uvicorn" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing backend packages - first run only..." -ForegroundColor Yellow
    & $pythonExe -m pip install -r (Join-Path $backend 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
}

# Always remove stale Next output before a local run.
$nextCache = Join-Path $frontend '.next'
if (Test-Path $nextCache) {
    Write-Host "Removing old Next.js cache..." -ForegroundColor Yellow
    Remove-Item $nextCache -Recurse -Force
}

# Seed first in this process so startup cannot hide a database/config error.
Write-Host "Preparing the database..."
$oldPyPath = $env:PYTHONPATH
$env:PYTHONPATH='.'
Push-Location $backend
& $pythonExe -m app.seed
$seedCode = $LASTEXITCODE
Pop-Location
$env:PYTHONPATH=$oldPyPath
if ($seedCode -ne 0) { throw 'Database preparation failed. Read the error above.' }

# Start backend in a visible window.
$backendCmd = "`$env:PYTHONPATH='.'; Set-Location '$backend'; & '$pythonExe' -m uvicorn app.main:app --host 127.0.0.1 --port $backendPort"
Start-Process powershell.exe -ArgumentList @('-NoExit','-Command',$backendCmd) -WindowStyle Normal | Out-Null

Write-Host "Waiting for Backend..."
$backendOk = $false
for ($i=0; $i -lt 45; $i++) {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:$backendPort/api/v1/health"
        if ($r.StatusCode -eq 200) { $backendOk=$true; break }
    } catch {}
    Start-Sleep -Milliseconds 600
}
if (-not $backendOk) { throw 'Backend did not become ready. Read the Backend window.' }

# Start frontend in a visible window with an explicit backend target.
$frontendCmd = "`$env:API_INTERNAL_URL='http://127.0.0.1:$backendPort/api/v1'; Set-Location '$frontend'; npm run dev -- --hostname 127.0.0.1 --port $frontendPort"
Start-Process powershell.exe -ArgumentList @('-NoExit','-Command',$frontendCmd) -WindowStyle Normal | Out-Null

Write-Host "Waiting for Frontend..."
$frontendOk = $false
for ($i=0; $i -lt 70; $i++) {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://127.0.0.1:$frontendPort/"
        if ($r.StatusCode -eq 200 -and $r.Headers['X-Mr-Raed-Runtime'] -eq 'stable-3100') { $frontendOk=$true; break }
    } catch {}
    Start-Sleep -Milliseconds 700
}
if (-not $frontendOk) { throw 'Frontend did not start as the NEW copy. Read the Frontend window.' }

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "[OK] THE FRESH COPY IS RUNNING" -ForegroundColor Green
Write-Host "Open ONLY: http://127.0.0.1:$frontendPort" -ForegroundColor Green
Write-Host "Do NOT use an old http://127.0.0.1:3000 tab." -ForegroundColor Yellow
Write-Host "===============================================" -ForegroundColor Green
Start-Process "http://127.0.0.1:$frontendPort/?runtime=stable-3100"
Read-Host 'Press Enter only when you want to close this launcher'
