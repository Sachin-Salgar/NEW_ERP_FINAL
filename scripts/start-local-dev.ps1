$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $repoRoot '.local-dev-logs'
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

function Get-PortOwnerPid {
    param([int]$Port)

    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $connection) { return $null }
    return [int]$connection.OwningProcess
}

function Get-ProcessCommandLine {
    param([int]$ProcessId)

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    if (-not $process) { return '' }
    return ($process | Select-Object -ExpandProperty CommandLine)
}

function Test-BackendReady {
    try {
        $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/v1/health' -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ([int]$response.StatusCode -ne 200) { return $false }
        $payload = $response.Content | ConvertFrom-Json
        if ($payload.database.connected -ne $true) { return $false }
        return $true
    }
    catch {
        return $false
    }
}

function Test-FrontendReady {
    try {
        $response = Invoke-WebRequest -Uri 'http://localhost:3001' -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        return ([int]$response.StatusCode -eq 200)
    }
    catch {
        return $false
    }
}

function Wait-ForUrl {
    param(
        [string]$Url,
        [scriptblock]$ReadyCheck,
        [string]$Label,
        [int]$TimeoutSeconds = 90
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (& $ReadyCheck) {
            Write-Host "READY: $Label"
            return
        }
        Start-Sleep -Seconds 2
    }

    throw "Timed out waiting for $Label at $Url"
}

Write-Host 'Checking PostgreSQL connectivity...'
& npm.cmd run db:diagnose
if ($LASTEXITCODE -ne 0) {
    throw 'PostgreSQL validation failed. Fix the local database configuration before starting the ERP stack.'
}

$backendPortOwner = Get-PortOwnerPid -Port 3000
if ($backendPortOwner) {
    $backendCommand = Get-ProcessCommandLine -ProcessId $backendPortOwner
    if ($backendCommand -match 'tsx.*src/main\.ts' -or $backendCommand -match 'node.*tsx.*src/main\.ts') {
        Write-Host "Backend is already running on port 3000 (PID $backendPortOwner)"
    }
    else {
        throw "Port 3000 is already in use by PID $backendPortOwner and is not the ERP backend. Free the port or stop the unrelated process before starting the local ERP stack."
    }
}
else {
    $backendLog = Join-Path $logsDir 'backend.log'
    Write-Host 'Starting backend on http://localhost:3000 ...'
    $backendProc = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev' -WorkingDirectory $repoRoot -RedirectStandardOutput $backendLog -RedirectStandardError $backendLog -PassThru -NoNewWindow
    Write-Host "Backend started with PID $($backendProc.Id)"
}

Wait-ForUrl -Url 'http://localhost:3000/api/v1/health' -Label 'backend health' -ReadyCheck { Test-BackendReady }

$frontendPortOwner = Get-PortOwnerPid -Port 3001
if ($frontendPortOwner) {
    $frontendCommand = Get-ProcessCommandLine -ProcessId $frontendPortOwner
    if ($frontendCommand -match 'flutter run .*web-server.*--web-port 3001' -or $frontendCommand -match 'dartvm.exe.*flutter_tools.snapshot run -d web-server --web-port 3001') {
        Write-Host "Frontend is already running on port 3001 (PID $frontendPortOwner)"
    }
    else {
        throw "Port 3001 is already in use by PID $frontendPortOwner and is not the ERP Flutter dev server. Free the port or stop the unrelated process before starting the local ERP stack."
    }
}
else {
    $frontendLog = Join-Path $logsDir 'frontend.log'
    $frontendDir = Join-Path $repoRoot 'frontend'
    Write-Host 'Starting Flutter frontend on http://localhost:3001 ...'
    $frontendProc = Start-Process -FilePath 'flutter.bat' -ArgumentList 'run', '-d', 'web-server', '--web-port', '3001', '--dart-define=API_BASE_URL=http://localhost:3000' -WorkingDirectory $frontendDir -RedirectStandardOutput $frontendLog -RedirectStandardError $frontendLog -PassThru -NoNewWindow
    Write-Host "Frontend started with PID $($frontendProc.Id)"
}

Wait-ForUrl -Url 'http://localhost:3001' -Label 'frontend response' -ReadyCheck { Test-FrontendReady }

$backendHealth = Invoke-WebRequest -Uri 'http://localhost:3000/api/v1/health' -UseBasicParsing -TimeoutSec 10
$backendPayload = $backendHealth.Content | ConvertFrom-Json
$backendReady = ($backendPayload.status -eq 'ok' -or $backendPayload.database.connected -eq $true)
if (-not $backendReady) {
    throw 'Backend health check did not report ready state.'
}

$envFile = Join-Path $repoRoot '.env.local'
if (-not (Test-Path $envFile)) {
    throw '.env.local is required for local startup and is missing.'
}

function Get-LocalLoginCredentials {
    $loginPassword = $null
    $loginIdentifier = $null
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^CUSTOM_TENANT_USER_PASSWORD=') {
            $loginPassword = $_.Split('=', 2)[1].Trim()
        }
        if ($_ -match '^CUSTOM_TENANT_ADMIN_EMAIL=') {
            $loginIdentifier = $_.Split('=', 2)[1].Trim()
        }
    }

    if (-not $loginPassword) {
        return $null
    }

    if (-not $loginIdentifier) {
        $loginIdentifier = 'admin@magodfusion.in'
    }

    return @{ identifier = $loginIdentifier; password = $loginPassword }
}

function Ensure-LocalDevTenantUser {
    $bootstrapOutput = Join-Path $repoRoot '.tmp-bootstrap-output.json'
    Remove-Item $bootstrapOutput -Force -ErrorAction SilentlyContinue
    & npx.cmd tsx --env-file .env.local bootstrap-dev-user.ts | Out-File -FilePath $bootstrapOutput -Encoding utf8
    if ($LASTEXITCODE -ne 0) {
        throw 'The local dev tenant bootstrap failed. The ERP stack cannot authenticate without a seeded tenant user.'
    }

    $bootstrapInfo = Get-Content $bootstrapOutput -Raw | ConvertFrom-Json
    if (-not $bootstrapInfo.username -or -not $bootstrapInfo.password) {
        throw 'The local dev tenant bootstrap did not produce a usable login credential.'
    }

    return @{ identifier = $bootstrapInfo.username; password = $bootstrapInfo.password }
}

$loginCredentials = Get-LocalLoginCredentials
if (-not $loginCredentials) {
    throw 'CUSTOM_TENANT_USER_PASSWORD is not set in .env.local. Local login cannot be validated.'
}

$loginBody = @{ identifier = $loginCredentials.identifier; password = $loginCredentials.password } | ConvertTo-Json -Compress
try {
    $loginResponse = Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/auth/login' -Method Post -ContentType 'application/json' -Body $loginBody -ErrorAction Stop
}
catch {
    $loginResponse = $null
    Write-Host 'No valid tenant user was found for the configured local auth state; bootstrapping the local developer tenant...'
    $loginCredentials = Ensure-LocalDevTenantUser
    $loginBody = @{ identifier = $loginCredentials.identifier; password = $loginCredentials.password } | ConvertTo-Json -Compress
    $loginResponse = Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/auth/login' -Method Post -ContentType 'application/json' -Body $loginBody -ErrorAction Stop
}

if ($loginResponse.success -ne $true) {
    Write-Host 'Auth rejected the initial local login attempt; bootstrapping the local developer tenant...'
    $loginCredentials = Ensure-LocalDevTenantUser
    $loginBody = @{ identifier = $loginCredentials.identifier; password = $loginCredentials.password } | ConvertTo-Json -Compress
    $loginResponse = Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/auth/login' -Method Post -ContentType 'application/json' -Body $loginBody -ErrorAction Stop
}

if ($loginResponse.success -ne $true) {
    throw 'Login request failed. The backend is running but auth rejected the configured local user.'
}

$accessToken = $null
if ($loginResponse.resolution -eq 'SELECT') {
    $context = $loginResponse.contexts[0]
    if (-not $context -or -not $context.contextRef) {
        throw 'Login returned a selection challenge but no usable context was provided.'
    }
    $selectBody = @{ pendingSelectionToken = $loginResponse.pendingSelectionToken; contextRef = $context.contextRef } | ConvertTo-Json -Compress
    $selected = Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/auth/select-context' -Method Post -ContentType 'application/json' -Body $selectBody -ErrorAction Stop
    if ($selected.success -ne $true) {
        throw 'Context selection failed after login challenge.'
    }
    $accessToken = $selected.accessToken
}
else {
    $accessToken = $loginResponse.accessToken
}

if (-not $accessToken) {
    throw 'Auth response did not include a usable access token.'
}

$meHeaders = @{ Authorization = "Bearer $accessToken" }
$meResponse = Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/auth/me' -Method Get -Headers $meHeaders -ErrorAction Stop
if ($meResponse.success -ne $true) {
    throw 'Authenticated user lookup failed.'
}

Write-Host "Login verification passed for $($meResponse.user.email)"
Write-Host 'Local ERP stack is running and ready for use.'
Write-Host "Backend health: http://localhost:3000/api/v1/health"
Write-Host "Frontend: http://localhost:3001"

$bootstrapOutput = Join-Path $repoRoot '.tmp-bootstrap-output.json'
Remove-Item $bootstrapOutput -Force -ErrorAction SilentlyContinue
