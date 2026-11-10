param([switch]$SkipBuild)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    if (-not (Test-Path -LiteralPath '.env')) {
        throw 'Create .env from .env.example and replace the password placeholders first.'
    }
    if ($SkipBuild) { docker compose --profile full up -d }
    else { docker compose --profile full up --build -d }
    if ($LASTEXITCODE -ne 0) { throw 'The Docker stack did not start successfully.' }

    $apiPort = '8090'
    $portSetting = Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^APP_PORT=\d+$' } | Select-Object -First 1
    if ($portSetting) { $apiPort = $portSetting.Split('=', 2)[1] }
    $endpoints = @(
        "http://127.0.0.1:$apiPort/actuator/health",
        'http://127.0.0.1:5173/assets/config.json',
        'http://127.0.0.1:8025/api/v1/messages',
        'http://127.0.0.1:8180/realms/shortener/.well-known/openid-configuration'
    )
    $deadline = [DateTime]::UtcNow.AddMinutes(5)
    foreach ($endpoint in $endpoints) {
        $ready = $false
        while ([DateTime]::UtcNow -lt $deadline) {
            try {
                $response = Invoke-WebRequest -Uri $endpoint -UseBasicParsing -TimeoutSec 5
                if ($response.StatusCode -eq 200) { $ready = $true; break }
            } catch { }
            Start-Sleep -Seconds 2
        }
        if (-not $ready) { throw "Service readiness timed out: $endpoint. Check docker compose logs." }
    }

    node scripts/setup-local-auth.mjs --create-user
    if ($LASTEXITCODE -ne 0) { throw 'Local account setup failed.' }
    Write-Output 'Website ready: http://localhost:5173'
    if (Test-Path -LiteralPath '.local/login.json') {
        Write-Output 'Local application credentials: .local/login.json (ignored by Git)'
    } else {
        Write-Output 'Use the existing shortly-local account password; setup does not reset passwords.'
    }
} finally {
    Pop-Location
}
