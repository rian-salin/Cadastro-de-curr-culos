.DEFAULT_GOAL := help
COMPOSE ?= docker compose
COMPOSE_TEST ?= docker compose -f docker-compose.test.yml
SERVICE ?=
NAME ?=
DOTNET_IMAGE ?= mcr.microsoft.com/dotnet/sdk:10.0
NUGET_CACHE ?= $(HOME)/.nuget/packages

# Atalhos para Linux, macOS, WSL e Git Bash. No PowerShell, use os comandos
# `docker compose` diretamente (o README lista o equivalente de cada alvo).

# Container descartável do SDK .NET 10 com o repositório montado em /repo. Roda com
# o usuário atual para os arquivos gerados (migrations, bin/obj) não ficarem com dono root.
DOTNET_RUN = docker run --rm \
    --user $(shell id -u):$(shell id -g) \
    -e HOME=/tmp -e DOTNET_NOLOGO=1 -e DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    -e DOTNET_SKIP_WORKLOAD_INTEGRITY_CHECK=1 \
    -e NUGET_PACKAGES=/nuget -v "$(NUGET_CACHE):/nuget" \
    -v "$(CURDIR):/repo" -w /repo/backend \
    $(DOTNET_IMAGE)

.PHONY: help setup env up up-d down stop restart build rebuild logs ps clean \
        api web db sh-api sh-web sh-db migration schema test test-api test-web

help: ## Lista os comandos disponíveis
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: ## Configura e sobe tudo do zero, esperando a API responder
	./setup.sh

env: ## Cria o .env a partir do .env.example (se não existir)
	@test -f .env || (cp .env.example .env && echo ".env criado — ajuste os valores")

up: ## Sobe os serviços em primeiro plano (build incluso)
	$(COMPOSE) up --build

up-d: ## Sobe os serviços em segundo plano (build incluso)
	$(COMPOSE) up --build -d

down: ## Para e remove os containers
	$(COMPOSE) down

stop: ## Para os containers sem removê-los
	$(COMPOSE) stop

restart: ## Reinicia os serviços (use SERVICE=api para um só)
	$(COMPOSE) restart $(SERVICE)

build: ## Builda as imagens (use SERVICE=api para uma só)
	$(COMPOSE) build $(SERVICE)

rebuild: ## Builda sem cache e sobe em segundo plano
	$(COMPOSE) build --no-cache $(SERVICE)
	$(COMPOSE) up -d

logs: ## Acompanha os logs (use SERVICE=api para um só)
	$(COMPOSE) logs -f $(SERVICE)

ps: ## Lista o status dos containers
	$(COMPOSE) ps

clean: ## Remove containers, volumes (apaga o banco!) e imagens locais
	$(COMPOSE) down -v --rmi local

api: ## Logs da API
	$(COMPOSE) logs -f api

web: ## Logs do frontend
	$(COMPOSE) logs -f web

db: ## Logs do banco
	$(COMPOSE) logs -f db

sh-api: ## Abre um shell no container da API
	$(COMPOSE) exec api sh

sh-web: ## Abre um shell no container do frontend
	$(COMPOSE) exec web sh

sh-db: ## Abre um shell no container do banco
	$(COMPOSE) exec db bash

test: test-api test-web ## Roda todos os testes (backend + frontend)

test-api: ## Testes do backend em container (sobe um SQL Server descartável)
	$(COMPOSE_TEST) run --rm tests

test-web: ## Testes do frontend em container (Vitest)
	$(COMPOSE_TEST) run --rm tests-web

migration: ## Cria uma migration do EF Core (use NAME=NomeDaMigration) e regenera o schema.sql
	@test -n "$(NAME)" || (echo "Informe o nome: make migration NAME=NomeDaMigration" && exit 1)
	@mkdir -p "$(NUGET_CACHE)"
	$(DOTNET_RUN) sh -c 'dotnet tool restore && dotnet restore CadastroCurriculos.Api && dotnet ef migrations add $(NAME) --project CadastroCurriculos.Api'
	@$(MAKE) --no-print-directory schema

# O `dotnet ef` escreve o script com BOM, e o sqlcmd não o reconhece quando lê o
# script da entrada padrão. O sed roda dentro do container, então o alvo não
# depende do sed do host (o do macOS não aceita `-i` sem argumento).
schema: ## Regenera database/schema.sql a partir das migrations
	@mkdir -p "$(NUGET_CACHE)"
	$(DOTNET_RUN) sh -c 'dotnet tool restore >/dev/null \
	    && dotnet ef migrations script --idempotent --project CadastroCurriculos.Api --output /repo/database/schema.sql \
	    && sed -i "1s/^\xef\xbb\xbf//" /repo/database/schema.sql'
	@echo "database/schema.sql regenerado"
