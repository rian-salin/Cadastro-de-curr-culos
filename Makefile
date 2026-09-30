.DEFAULT_GOAL := help
COMPOSE ?= docker compose
SERVICE ?=
NAME ?=
DOTNET_IMAGE ?= mcr.microsoft.com/dotnet/sdk:10.0
NUGET_CACHE ?= $(HOME)/.nuget/packages

# Container descartável do SDK .NET 10 com backend/ montado em /src. Roda com o
# usuário atual para os arquivos gerados (migrations, bin/obj) não ficarem com dono root.
DOTNET_CONTAINER = docker run --rm \
    --user $(shell id -u):$(shell id -g) \
    -e HOME=/tmp -e DOTNET_NOLOGO=1 -e DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    -e DOTNET_SKIP_WORKLOAD_INTEGRITY_CHECK=1 \
    -e NUGET_PACKAGES=/nuget -v "$(NUGET_CACHE):/nuget" \
    -v "$(CURDIR)/backend:/src" -w /src
DOTNET_RUN = $(DOTNET_CONTAINER) $(DOTNET_IMAGE)

# Os testes sobem um SQL Server via Testcontainers como container irmão no host:
# precisam do socket do Docker (e do grupo dono dele) e da rede do host para
# alcançar a porta mapeada do banco.
DOCKER_SOCKET ?= /var/run/docker.sock
DOTNET_TEST_RUN = $(DOTNET_CONTAINER) \
    -v "$(DOCKER_SOCKET):/var/run/docker.sock" \
    --group-add $(shell stat -c %g $(DOCKER_SOCKET)) \
    --network host -e TESTCONTAINERS_HOST_OVERRIDE=localhost \
    $(DOTNET_IMAGE)

.PHONY: help env up up-d down stop restart build rebuild logs ps clean api web db sh-api sh-web sh-db migration test

help: ## Lista os comandos disponíveis
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

env: ## Cria o .env a partir do .env.example (se não existir)
	@test -f .env || (cp .env.example .env && echo ".env criado — ajuste os valores")

up: env ## Sobe os serviços em primeiro plano (build incluso)
	$(COMPOSE) up --build

up-d: env ## Sobe os serviços em segundo plano (build incluso)
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

migration: ## Cria uma migration do EF Core (use NAME=NomeDaMigration)
	@test -n "$(NAME)" || (echo "Informe o nome: make migration NAME=NomeDaMigration" && exit 1)
	@mkdir -p "$(NUGET_CACHE)"
	$(DOTNET_RUN) sh -c 'dotnet tool restore && dotnet restore CadastroCurriculos.Api && dotnet ef migrations add $(NAME) --project CadastroCurriculos.Api'

test: ## Roda os testes do backend (sobe um SQL Server descartável via Docker)
	@mkdir -p "$(NUGET_CACHE)"
	$(DOTNET_TEST_RUN) dotnet test CadastroCurriculos.sln
