#!/usr/bin/env sh
# Configura e sobe o projeto do zero: cria o .env, builda as imagens e espera a
# API responder.
#
#   ./setup.sh
#
# Para Linux, macOS, WSL e Git Bash no Windows. No PowerShell use .\setup.ps1.
set -eu

cd "$(dirname "$0")"

say() { printf '%s\n' "$1"; }
die() { printf 'erro: %s\n' "$1" >&2; exit 1; }

# --- pré-requisitos ---------------------------------------------------------
command -v docker >/dev/null 2>&1 \
    || die "Docker não encontrado. Instale o Docker Desktop (Windows/macOS) ou o Docker Engine (Linux): https://docs.docker.com/get-docker/"

docker compose version >/dev/null 2>&1 \
    || die "'docker compose' não encontrado. Atualize para uma versão do Docker que inclua o Compose v2."

docker info >/dev/null 2>&1 \
    || die "o Docker está instalado mas não está rodando. Inicie o Docker Desktop (ou 'sudo systemctl start docker') e rode de novo."

# --- .env -------------------------------------------------------------------
# O compose já tem padrões de desenvolvimento para todas as variáveis; o .env
# existe para quem quiser trocar alguma (a senha do banco, por exemplo).
if [ -f .env ]; then
    say "→ .env já existe, mantido como está"
else
    cp .env.example .env
    say "→ .env criado a partir de .env.example"
fi

# --- sobe a stack -----------------------------------------------------------
say "→ buildando as imagens e subindo os serviços (a primeira vez baixa ~2 GB e leva alguns minutos)"
docker compose up --build -d

# --- espera a API -----------------------------------------------------------
if ! command -v curl >/dev/null 2>&1; then
    say ""
    say "serviços subindo. Em alguns segundos: http://localhost:3000"
    say "Acompanhe com: docker compose logs -f"
    exit 0
fi

say "→ esperando o banco inicializar e a API aplicar as migrations"
i=0
while [ "$i" -lt 120 ]; do
    if curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; then
        say ""
        say "pronto. Frontend em http://localhost:3000"
        say "          API em http://localhost:5000/api/health"
        say ""
        say "Logs: docker compose logs -f    ·    Parar: docker compose down"
        exit 0
    fi
    i=$((i + 1))
    sleep 2
done

die "a API não respondeu em 4 minutos. Veja o que aconteceu com: docker compose logs"
