# Configura e sobe o projeto do zero: cria o .env, builda as imagens e espera a
# API responder.
#
#   .\setup.ps1
#
# Para Windows (PowerShell 5.1+ ou PowerShell 7+). Em Linux, macOS, WSL e Git
# Bash use ./setup.sh.
$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath $PSScriptRoot

function Die($message) {
    Write-Host "erro: $message" -ForegroundColor Red
    exit 1
}

# --- pre-requisitos ---------------------------------------------------------
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Die 'Docker nao encontrado. Instale o Docker Desktop: https://docs.docker.com/get-docker/'
}

docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    Die "'docker compose' nao encontrado. Atualize para uma versao do Docker que inclua o Compose v2."
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Die 'o Docker esta instalado mas nao esta rodando. Inicie o Docker Desktop e rode de novo.'
}

# --- .env -------------------------------------------------------------------
# O compose ja tem padroes de desenvolvimento para todas as variaveis; o .env
# existe para quem quiser trocar alguma (a senha do banco, por exemplo).
if (Test-Path -LiteralPath '.env') {
    Write-Host '-> .env ja existe, mantido como esta'
} else {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
    Write-Host '-> .env criado a partir de .env.example'
}

# --- sobe a stack -----------------------------------------------------------
Write-Host '-> buildando as imagens e subindo os servicos (a primeira vez baixa ~2 GB e leva alguns minutos)'
docker compose up --build -d
if ($LASTEXITCODE -ne 0) { Die 'o "docker compose up" falhou. A saida acima diz o motivo.' }

# --- espera a API -----------------------------------------------------------
Write-Host '-> esperando o banco inicializar e a API aplicar as migrations'
foreach ($attempt in 1..120) {
    try {
        $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host ''
            Write-Host 'pronto. Frontend em http://localhost:3000' -ForegroundColor Green
            Write-Host '          API em http://localhost:5000/api/health'
            Write-Host ''
            Write-Host 'Logs: docker compose logs -f    .    Parar: docker compose down'
            exit 0
        }
    } catch {
        Start-Sleep -Seconds 2
    }
}

Die 'a API nao respondeu em 4 minutos. Veja o que aconteceu com: docker compose logs'
