# Configuração Base do Projeto — Cadastro de Currículos

Data: 2026-09-29

## Propósito

Estabelecer o esqueleto executável do projeto "Cadastro de Currículos": todas as
camadas (frontend, backend, banco de dados) orquestradas via Docker Compose,
conectadas entre si e validadas por um health-check ponta a ponta. Este
trabalho **não** inclui entidades de negócio (currículos, candidatos, vagas
etc.) nem autenticação — isso fica para specs futuras que evoluirão a partir
desta base.

Critério de sucesso: rodar `docker-compose up` a partir de uma checkout limpo
e, ao acessar `http://localhost:3000`, ver uma página que confirma que o
React conseguiu falar com a API e que a API conseguiu falar com o banco.

## Arquitetura

```
Navegador ──► Nginx (web) ──► ASP.NET Core (api) ──► SQL Server (db)
              :3000            :5000                   :1433
              serve o React    /api/... via proxy      dados no volume
```

O navegador conversa com uma única origem (o Nginx). Os arquivos estáticos do
React são servidos diretamente; qualquer requisição para `/api/` é repassada
para o backend. Isso evita configurar CORS. A API acessa o banco pela rede
interna do Docker Compose, usando o nome do serviço (`db`) como host.

## Stack e versões

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | React + TypeScript | React 19 |
| Build do frontend | Vite | 8 |
| Servidor web | Nginx | alpine |
| Backend | ASP.NET Core Web API | .NET 10 (LTS) |
| ORM | Entity Framework Core | 10.x |
| Banco de dados | SQL Server | 2025 |
| Infraestrutura | Docker + Docker Compose | - |
| Runtime do build (só no Dockerfile do frontend) | Node.js | 24 (LTS) |

## Nomenclatura

- Solution .NET: `CadastroCurriculos.sln`
- Projeto/namespace do backend: `CadastroCurriculos.Api`
- Pacote do frontend (`package.json`): `cadastro-curriculos-frontend`
- Banco de dados: `CadastroCurriculosDb`

## Estrutura de pastas

```
cadastro-de-corriculos/
├── backend/
│   ├── CadastroCurriculos.Api/
│   │   ├── Controllers/
│   │   │   └── HealthController.cs
│   │   ├── Data/
│   │   │   └── AppDbContext.cs
│   │   ├── Migrations/
│   │   ├── Program.cs
│   │   ├── appsettings.json
│   │   ├── appsettings.Development.json
│   │   ├── CadastroCurriculos.Api.csproj
│   │   ├── Dockerfile
│   │   └── .dockerignore
│   └── .gitignore
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── api/
│   │       └── health.ts
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── nginx.conf
│   ├── Dockerfile
│   ├── .dockerignore
│   └── .gitignore
│
├── docker-compose.yml
├── .env.example
├── .env                 (não versionado)
├── .gitignore           (regras compartilhadas na raiz)
├── docs/
│   └── superpowers/specs/
└── README.md
```

## Componentes

### `AppDbContext` (backend/Data)
DbContext do EF Core sem `DbSet`s de negócio nesta etapa. Serve apenas para
que o health-check consiga testar conectividade via
`Database.CanConnectAsync()`. Configurado em `Program.cs` para usar o
provider SQL Server, lendo a connection string a partir de variáveis de
ambiente (compostas a partir de `DB_NAME`, `DB_PASSWORD` e do host `db`).

### `HealthController` (backend/Controllers)
Endpoint `GET /api/health` que:
1. Chama `AppDbContext.Database.CanConnectAsync()`.
2. Retorna JSON `{ "status": "ok" | "degraded", "database": "connected" | "unavailable" }` com HTTP 200 quando conectado e 503 quando não.

Não há autenticação nem outros endpoints nesta etapa.

### Frontend (`src/App.tsx`, `src/api/health.ts`)
Uma página simples que, ao montar, chama `GET /api/health` e exibe o
resultado (ex: "API: ok · Banco: connected" ou uma mensagem de erro). Serve
como prova visual de que a stack inteira está de pé — não há roteamento nem
outras telas nesta etapa.

### Nginx (`frontend/nginx.conf`)
Serve os arquivos estáticos gerados pelo build do Vite (`dist/`) e repassa
(`proxy_pass`) qualquer requisição que comece com `/api/` para
`http://api:5000`.

### Docker Compose
Três serviços:
- `db`: imagem oficial do SQL Server 2025, variável `SA_PASSWORD` vinda de
  `DB_PASSWORD`, volume nomeado para persistir os dados, porta `1433`
  publicada no host.
- `api`: build a partir de `backend/CadastroCurriculos.Api/Dockerfile`
  (multi-stage SDK → runtime), depende de `db`, porta `5000` publicada no
  host, variáveis de ambiente para a connection string.
- `web`: build a partir de `frontend/Dockerfile` (multi-stage Node → Nginx),
  depende de `api`, porta `3000` publicada no host.

Rede padrão do Compose conecta os três serviços pelo nome do serviço.

## Variáveis de ambiente

`.env.example` (versionado, com valores de exemplo):
```
DB_PASSWORD=changeme_StrongPassword123!
DB_NAME=CadastroCurriculosDb
ASPNETCORE_ENVIRONMENT=Development
```

`.env` (real, no `.gitignore`) segue o mesmo formato com valores reais.

## Fluxo de dados (cenário de validação)

1. Usuário acessa `http://localhost:3000`.
2. Nginx serve `index.html` + assets do React.
3. React monta e chama `GET /api/health`.
4. Nginx repassa para `http://api:5000/api/health`.
5. API executa `Database.CanConnectAsync()` contra `db:1433`.
6. API responde; React exibe o status na tela.

## Tratamento de erros

- Se o banco não estiver acessível, `HealthController` retorna 503 com
  `database: "unavailable"` em vez de deixar a exceção estourar — o
  frontend deve tratar tanto a resposta 503 quanto falha de rede/timeout,
  exibindo uma mensagem de erro amigável.
- Não há retry automático nesta etapa; é só uma checagem pontual.

## Testes

- Validação manual: `docker-compose up --build` a partir de um checkout
  limpo deve resultar em `http://localhost:3000` mostrando o status "ok"
  após o banco subir.
- Não há suíte de testes automatizados nesta etapa (fica para quando
  existir lógica de negócio para testar).

## Fora de escopo

- Autenticação/autorização.
- Entidades de negócio (currículo, candidato, vaga) e seus CRUDs.
- Migrations de schema de negócio.
- Testes automatizados (unitários/integração).
- CI/CD.
