# Configuração Base do Projeto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o projeto "Cadastro de Currículos" executável ponta a ponta via `docker-compose up`, com React+TS, ASP.NET Core e SQL Server conectados e validados por um health-check, sem nenhuma entidade de negócio ainda.

**Architecture:** Nginx serve o build estático do React e faz proxy de `/api/` para o ASP.NET Core Web API, que fala com o SQL Server via EF Core. Os três serviços rodam em containers Docker orquestrados por Docker Compose, conectados pela rede padrão do Compose usando os nomes dos serviços (`db`, `api`, `web`) como host.

**Tech Stack:** React 19 + TypeScript + Vite 8 (frontend), Nginx alpine (servidor web/proxy), ASP.NET Core Web API .NET 10 (backend), EF Core 10.x (ORM), SQL Server 2025 (banco), Docker + Docker Compose (infra), Node 24 (build do frontend).

**Spec:** `docs/superpowers/specs/2026-09-29-configuracao-base-design.md`

## Global Constraints

- Frontend: React 19, Vite 8, TypeScript, pacote npm `cadastro-curriculos-frontend`.
- Backend: .NET 10 (`net10.0`), solution `CadastroCurriculos.sln`, projeto/namespace `CadastroCurriculos.Api`, EF Core 10.x.
- Banco: SQL Server 2025 (`mcr.microsoft.com/mssql/server:2025-latest`), nome do banco `CadastroCurriculosDb`.
- Servidor web: `nginx:alpine`; runtime de build do frontend: `node:24-alpine`.
- Nenhuma entidade de negócio, autenticação, suíte de testes automatizados ou CI/CD nesta etapa — isso fica para specs futuras.
- `.env` nunca é commitado (só `.env.example`); toda senha de exemplo deve satisfazer os requisitos de complexidade do SQL Server (mín. 8 caracteres, 3 de 4 categorias: maiúscula/minúscula/dígito/símbolo).
- O browser fala com uma única origem (Nginx, porta 3000); toda chamada do frontend à API usa caminho relativo `/api/...` (nunca URL absoluta), proxiado tanto pelo Vite em dev quanto pelo Nginx em produção.
- Portas publicadas no host: `web` 3000, `api` 5000, `db` 1433 (conforme spec).

## Review Focus

- **Banco inexistente causa falha de login mesmo com o SQL Server no ar** — o driver rejeita o login quando o `Database` da connection string ainda não existe (erro 18456 "Failed to open the explicitly specified database"), então uma checagem ingênua de conectividade nunca sai do estado degradado. Task 2 cobre isso chamando `EnsureCreatedAsync()` antes de `CanConnectAsync()`.
- **Senha do SQL Server abaixo da complexidade exigida derruba o container `db` silenciosamente** — a imagem oficial exige `ACCEPT_EULA=Y` e uma senha de SA com pelo menos 8 caracteres e 3 das 4 categorias (maiúscula, minúscula, dígito, símbolo). Task 1 já define um valor de exemplo compatível em `.env.example`.
- **Corrida entre API e banco na subida do Compose** — logo após `docker-compose up`, a API pode responder 503 por alguns segundos enquanto o SQL Server ainda inicializa; isso é esperado, não é bug. Task 6 verifica explicitamente os dois estados (503 e depois 200).
- **Caminho da API inconsistente entre dev e produção** — se o frontend chamar uma URL absoluta em vez de `/api/health`, funciona num ambiente e quebra no outro. Task 4 usa `fetch('/api/health')` relativo, com proxy configurado tanto no Vite (dev) quanto no Nginx (prod).
- **Contexto de build do Docker incompatível com os `COPY` do Dockerfile** — os Dockerfiles do backend e do frontend assumem que o build context é a própria pasta do serviço, não a raiz do repo. Task 6 fixa `build: ./backend/CadastroCurriculos.Api` e `build: ./frontend` exatamente.

---

## Task 1: Git e variáveis de ambiente na raiz

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `.env` (não commitado)

**Interfaces:**
- Produces: `DB_PASSWORD`, `DB_NAME`, `ASPNETCORE_ENVIRONMENT` — variáveis que as Tasks 2 e 6 vão consumir.

- [ ] **Step 1: Criar `.gitignore` da raiz**

```
.env
.vscode/
.idea/
.DS_Store
```

- [ ] **Step 2: Criar `.env.example`**

```
DB_PASSWORD=ChangeMe_2026!
DB_NAME=CadastroCurriculosDb
ASPNETCORE_ENVIRONMENT=Development
```

- [ ] **Step 3: Criar `.env` com o mesmo conteúdo (arquivo real, usado localmente)**

```
DB_PASSWORD=ChangeMe_2026!
DB_NAME=CadastroCurriculosDb
ASPNETCORE_ENVIRONMENT=Development
```

- [ ] **Step 4: Verificar que o `.env` está ignorado**

Run: `git check-ignore -v .env`
Expected: imprime a linha do `.gitignore` que casa com `.env` (confirma que ele não será commitado).

- [ ] **Step 5: Commit**

```bash
git add .gitignore .env.example
git commit -m "Add root .gitignore and .env.example"
```

---

## Task 2: Backend — Web API + EF Core + health-check

**Files:**
- Create: `backend/CadastroCurriculos.sln`
- Create: `backend/CadastroCurriculos.Api/CadastroCurriculos.Api.csproj`
- Create: `backend/CadastroCurriculos.Api/Program.cs`
- Create: `backend/CadastroCurriculos.Api/appsettings.json`
- Create: `backend/CadastroCurriculos.Api/appsettings.Development.json`
- Create: `backend/CadastroCurriculos.Api/Data/AppDbContext.cs`
- Create: `backend/CadastroCurriculos.Api/Controllers/HealthController.cs`
- Create: `backend/.gitignore`

**Interfaces:**
- Consumes: nenhuma (primeira peça do backend).
- Produces: endpoint `GET /api/health` retornando `{ "status": "ok"|"degraded", "database": "connected"|"unavailable" }` (HTTP 200 ou 503) — consumido pelo frontend na Task 4 e pela verificação de integração na Task 6. Connection string lida de `ConnectionStrings:Default` (via `builder.Configuration.GetConnectionString("Default")`), sobrescrita em produção pela env var `ConnectionStrings__Default` (Task 6).

- [ ] **Step 1: Scaffold da solution e do projeto Web API via SDK .NET 10 em container**

O SDK local pode não ser a versão 10; por isso o scaffold roda dentro do container oficial do SDK, escrevendo os arquivos no volume montado.

Run (a partir da raiz do repo):
```bash
mkdir -p /tmp/dotnet-cli-home
docker run --rm \
  -u "$(id -u):$(id -g)" \
  -e HOME=/tmp/dotnet-cli-home \
  -e DOTNET_CLI_HOME=/tmp/dotnet-cli-home \
  -v "$(pwd)":/src -w /src \
  mcr.microsoft.com/dotnet/sdk:10.0 bash -c "
    dotnet new sln -n CadastroCurriculos -o backend -f sln &&
    dotnet new webapi -n CadastroCurriculos.Api -controllers --no-https -o backend/CadastroCurriculos.Api &&
    dotnet sln backend/CadastroCurriculos.sln add backend/CadastroCurriculos.Api/CadastroCurriculos.Api.csproj &&
    rm -f backend/CadastroCurriculos.Api/WeatherForecast.cs backend/CadastroCurriculos.Api/Controllers/WeatherForecastController.cs &&
    cd backend/CadastroCurriculos.Api &&
    dotnet add package Microsoft.EntityFrameworkCore.SqlServer &&
    dotnet add package Microsoft.EntityFrameworkCore.Design
  "
```

Expected: termina com "PackageReference for package 'Microsoft.EntityFrameworkCore.Design' ... added", sem erros. O `.csproj` gerado deve conter as duas `PackageReference` de EF Core além de `Microsoft.AspNetCore.OpenApi`, com `TargetFramework` `net10.0`.

- [ ] **Step 2: Criar `backend/CadastroCurriculos.Api/Data/AppDbContext.cs`**

```csharp
using Microsoft.EntityFrameworkCore;

namespace CadastroCurriculos.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }
}
```

- [ ] **Step 3: Criar `backend/CadastroCurriculos.Api/Controllers/HealthController.cs`**

```csharp
using CadastroCurriculos.Api.Data;
using Microsoft.AspNetCore.Mvc;

namespace CadastroCurriculos.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public HealthController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        bool isHealthy;
        try
        {
            // No migrations exist yet in this stage, so make sure the
            // database itself exists before checking connectivity to it.
            await _dbContext.Database.EnsureCreatedAsync();
            isHealthy = await _dbContext.Database.CanConnectAsync();
        }
        catch
        {
            isHealthy = false;
        }

        var payload = new
        {
            status = isHealthy ? "ok" : "degraded",
            database = isHealthy ? "connected" : "unavailable",
        };

        return isHealthy ? Ok(payload) : StatusCode(StatusCodes.Status503ServiceUnavailable, payload);
    }
}
```

- [ ] **Step 4: Registrar o `AppDbContext` em `Program.cs`**

Adicionar os `using`s no topo do arquivo e a chamada `AddDbContext` logo após `AddOpenApi()`, deixando o restante do arquivo gerado pelo template intacto:

```csharp
using CadastroCurriculos.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthorization();

app.MapControllers();

app.Run();
```

- [ ] **Step 5: Adicionar a connection string de desenvolvimento em `appsettings.json`**

Editar o arquivo gerado pelo template para incluir a seção `ConnectionStrings` (o `Connect Timeout=5` evita que o teste do Step 7 fique pendurado por muito tempo quando não há banco disponível):

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "Default": "Server=localhost,1433;Database=CadastroCurriculosDb;User Id=sa;Password=changeme;TrustServerCertificate=True;Connect Timeout=5;"
  }
}
```

`appsettings.Development.json` (gerado pelo template) não precisa de alteração.

- [ ] **Step 6: Criar `backend/.gitignore`**

```
bin/
obj/
*.user
.vs/
```

- [ ] **Step 7: Build dentro do container do SDK**

Run:
```bash
docker run --rm \
  -u "$(id -u):$(id -g)" \
  -e HOME=/tmp/dotnet-cli-home \
  -e DOTNET_CLI_HOME=/tmp/dotnet-cli-home \
  -v "$(pwd)":/src -w /src \
  mcr.microsoft.com/dotnet/sdk:10.0 \
  dotnet build backend/CadastroCurriculos.sln
```
Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`.

- [ ] **Step 8: Rodar a API sem banco disponível e confirmar o caminho degradado (503)**

Run:
```bash
docker run --rm -d --name api-verify-task2 \
  -u "$(id -u):$(id -g)" \
  -e HOME=/tmp/dotnet-cli-home -e DOTNET_CLI_HOME=/tmp/dotnet-cli-home \
  -e ASPNETCORE_URLS=http://0.0.0.0:5000 \
  -p 5000:5000 \
  -v "$(pwd)":/src -w /src/backend/CadastroCurriculos.Api \
  mcr.microsoft.com/dotnet/sdk:10.0 \
  dotnet run --no-build --no-launch-profile
sleep 8
curl -s -w "\nHTTP:%{http_code}\n" http://localhost:5000/api/health
docker stop api-verify-task2
```
Expected: `HTTP:503` e corpo `{"status":"degraded","database":"unavailable"}` — não há SQL Server rodando neste ponto, então esse é o resultado correto (prova o branch de erro do `HealthController`).

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "Add ASP.NET Core Web API skeleton with EF Core and health-check endpoint"
```

---

## Task 3: Backend — Dockerfile

**Files:**
- Create: `backend/CadastroCurriculos.Api/Dockerfile`
- Create: `backend/CadastroCurriculos.Api/.dockerignore`

**Interfaces:**
- Consumes: `backend/CadastroCurriculos.Api/CadastroCurriculos.Api.csproj` e o restante do projeto da Task 2.
- Produces: imagem Docker que expõe a porta 5000 rodando `dotnet CadastroCurriculos.Api.dll` — usada pelo serviço `api` no `docker-compose.yml` da Task 6.

- [ ] **Step 1: Criar `backend/CadastroCurriculos.Api/.dockerignore`**

```
bin/
obj/
```

- [ ] **Step 2: Criar `backend/CadastroCurriculos.Api/Dockerfile`**

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY CadastroCurriculos.Api.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 5000
ENV ASPNETCORE_URLS=http://0.0.0.0:5000
ENTRYPOINT ["dotnet", "CadastroCurriculos.Api.dll"]
```

- [ ] **Step 3: Build da imagem**

Run: `docker build -t cadastro-curriculos-api backend/CadastroCurriculos.Api`
Expected: termina com `naming to docker.io/library/cadastro-curriculos-api:latest done`, sem erros.

- [ ] **Step 4: Commit**

```bash
git add backend/CadastroCurriculos.Api/Dockerfile backend/CadastroCurriculos.Api/.dockerignore
git commit -m "Add backend Dockerfile"
```

---

## Task 4: Frontend — Vite + React + TS + página de health-check

**Files:**
- Create: `frontend/` (scaffold completo do Vite, template `react-ts`)
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/index.html`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/api/health.ts`
- Delete: `frontend/src/App.css`, `frontend/src/assets/hero.png`, `frontend/src/assets/react.svg`, `frontend/src/assets/vite.svg`, `frontend/public/icons.svg`

**Interfaces:**
- Consumes: `GET /api/health` (contrato definido na Task 2: `{ status, database }`, HTTP 200 ou 503) via caminho relativo `/api/health`.
- Produces: build estático em `frontend/dist/` — consumido pelo `Dockerfile` do frontend (Task 5).

- [ ] **Step 1: Scaffold do projeto Vite**

Run (a partir da raiz do repo):
```bash
npm create vite@latest frontend -- --template react-ts
```
Expected: cria `frontend/` com o template `react-ts` (React 19, Vite 8, TypeScript).

- [ ] **Step 2: Renomear o pacote**

Em `frontend/package.json`, trocar:
```json
  "name": "frontend",
```
por:
```json
  "name": "cadastro-curriculos-frontend",
```

- [ ] **Step 3: Remover assets do template que não serão usados**

Run:
```bash
rm -f frontend/src/App.css frontend/src/assets/hero.png frontend/src/assets/react.svg frontend/src/assets/vite.svg frontend/public/icons.svg
rmdir frontend/src/assets 2>/dev/null || true
```

- [ ] **Step 4: Criar `frontend/src/api/health.ts`**

```typescript
export type HealthResponse = {
  status: 'ok' | 'degraded'
  database: 'connected' | 'unavailable'
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health')

  if (!response.ok && response.status !== 503) {
    throw new Error(`Unexpected response: ${response.status}`)
  }

  return (await response.json()) as HealthResponse
}
```

- [ ] **Step 5: Substituir `frontend/src/App.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { fetchHealth, type HealthResponse } from './api/health'

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  return (
    <main>
      <h1>Cadastro de Currículos</h1>
      {error && <p>Erro ao consultar a API: {error}</p>}
      {!error && !health && <p>Consultando a API...</p>}
      {health && (
        <p>
          API: {health.status} · Banco: {health.database}
        </p>
      )}
    </main>
  )
}

export default App
```

- [ ] **Step 6: Substituir `frontend/src/index.css`**

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, 'Segoe UI', Roboto, sans-serif;
}

body {
  margin: 0;
  padding: 2rem;
}
```

- [ ] **Step 7: Atualizar o título em `frontend/index.html`**

Trocar `<title>frontend</title>` por `<title>Cadastro de Currículos</title>`.

- [ ] **Step 8: Configurar o proxy de dev em `frontend/vite.config.ts`**

```typescript
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 9: Instalar dependências e rodar o build de produção**

Run:
```bash
cd frontend && npm install && npm run build
```
Expected: `tsc -b` não reporta erros de tipo e `vite build` termina com `✓ built in ...ms`, gerando `frontend/dist/`.

- [ ] **Step 10: Commit**

```bash
git add frontend/
git commit -m "Add React + TypeScript + Vite frontend skeleton with health-check page"
```

---

## Task 5: Frontend — Nginx + Dockerfile

**Files:**
- Create: `frontend/nginx.conf`
- Create: `frontend/Dockerfile`
- Create: `frontend/.dockerignore`

**Interfaces:**
- Consumes: `frontend/dist/` (build gerado pela Task 4 dentro do próprio Dockerfile).
- Produces: imagem Docker que serve os arquivos estáticos na porta 80 e faz proxy de `/api/` para `http://api:5000/api/` — usada pelo serviço `web` no `docker-compose.yml` da Task 6.

- [ ] **Step 1: Criar `frontend/.dockerignore`**

```
node_modules/
dist/
```

- [ ] **Step 2: Criar `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://api:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

- [ ] **Step 3: Criar `frontend/Dockerfile`**

```dockerfile
FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS final
COPY --from=build /src/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 4: Build da imagem**

Run: `docker build -t cadastro-curriculos-web frontend`
Expected: termina com `naming to docker.io/library/cadastro-curriculos-web:latest done`, sem erros.

- [ ] **Step 5: Commit**

```bash
git add frontend/Dockerfile frontend/.dockerignore frontend/nginx.conf
git commit -m "Add frontend Dockerfile with Nginx"
```

---

## Task 6: Docker Compose — orquestração completa

**Files:**
- Create: `docker-compose.yml`

**Interfaces:**
- Consumes: `backend/CadastroCurriculos.Api/Dockerfile` (Task 3), `frontend/Dockerfile` (Task 5), `.env` (Task 1: `DB_PASSWORD`, `DB_NAME`, `ASPNETCORE_ENVIRONMENT`).
- Produces: stack completa acessível em `http://localhost:3000` — este é o critério de sucesso final da spec.

- [ ] **Step 1: Criar `docker-compose.yml`**

```yaml
services:
  db:
    image: mcr.microsoft.com/mssql/server:2025-latest
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: ${DB_PASSWORD}
      MSSQL_PID: Developer
    ports:
      - "1433:1433"
    volumes:
      - db-data:/var/opt/mssql

  api:
    build: ./backend/CadastroCurriculos.Api
    environment:
      ASPNETCORE_ENVIRONMENT: ${ASPNETCORE_ENVIRONMENT}
      ConnectionStrings__Default: "Server=db,1433;Database=${DB_NAME};User Id=sa;Password=${DB_PASSWORD};TrustServerCertificate=True;"
    ports:
      - "5000:5000"
    depends_on:
      - db

  web:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - api

volumes:
  db-data:
```

- [ ] **Step 2: Subir a stack**

Run: `docker compose up --build -d`
Expected: os três containers (`db`, `api`, `web`) ficam com status `Started`/`Running`.

- [ ] **Step 3: Verificar o estado degradado logo após a subida (corrida esperada)**

Run: `curl -s -w "\nHTTP:%{http_code}\n" http://localhost:3000/api/health`
Expected: `HTTP:503` com `{"status":"degraded","database":"unavailable"}` — o SQL Server ainda está inicializando; isso é esperado, não indica um bug.

- [ ] **Step 4: Aguardar o SQL Server terminar de inicializar e verificar o estado saudável**

Run:
```bash
for i in $(seq 1 15); do
  sleep 5
  code=$(curl -s -o /tmp/health.json -w "%{http_code}" http://localhost:3000/api/health)
  echo "tentativa $i: HTTP $code -> $(cat /tmp/health.json)"
  if [ "$code" = "200" ]; then break; fi
done
```
Expected: em algum momento (tipicamente dentro de 1-2 minutos) a saída muda para `HTTP 200 -> {"status":"ok","database":"connected"}`.

- [ ] **Step 5: Verificar o acesso direto à API (porta 5000) também funciona**

Run: `curl -s -w "\nHTTP:%{http_code}\n" http://localhost:5000/api/health`
Expected: `HTTP:200` com `{"status":"ok","database":"connected"}`.

- [ ] **Step 6: Verificar visualmente que o frontend exibe o status**

Abrir `http://localhost:3000` num navegador (ou usar uma ferramenta de automação de browser). Expected: a página mostra o título "Cadastro de Currículos" e o parágrafo "API: ok · Banco: connected".

- [ ] **Step 7: Encerrar a stack de verificação**

Run: `docker compose down`

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml
git commit -m "Add docker-compose.yml wiring web, api and db services"
```

---

## Task 7: README com instruções de execução

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nada (documentação).
- Produces: instruções que qualquer pessoa consegue seguir a partir de um checkout limpo.

- [ ] **Step 1: Substituir o conteúdo de `README.md`**

```markdown
# Cadastro de Currículos

Sistema full-stack (React + ASP.NET Core + SQL Server) orquestrado via Docker Compose.

## Como rodar

1. Copie o arquivo de variáveis de ambiente:
   ```
   cp .env.example .env
   ```
   (opcionalmente troque `DB_PASSWORD` por uma senha própria — precisa ter pelo
   menos 8 caracteres e misturar maiúsculas, minúsculas, dígitos e/ou símbolos)

2. Suba a stack:
   ```
   docker compose up --build
   ```

3. Acesse http://localhost:3000 — a página deve mostrar `API: ok · Banco: connected`
   assim que o SQL Server terminar de inicializar. Nos primeiros segundos após o
   `up` é normal ver `degraded`/`unavailable` enquanto o banco ainda sobe.

## Portas

| Serviço | URL |
|---|---|
| Frontend (Nginx) | http://localhost:3000 |
| Backend (API direta) | http://localhost:5000 |
| SQL Server | localhost:1433 |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add setup and run instructions to README"
```
