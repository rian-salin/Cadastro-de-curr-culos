# Cadastro de Currículos

Cadastro e consulta de candidatos, com duas formas de entrada: **manual** pelo
formulário e **a partir de um currículo em PDF**, de onde o backend extrai nome,
e-mail e telefone para preencher o mesmo formulário. Depois de salvar, o
candidato aparece na listagem e tem tela de detalhes.

React + ASP.NET Core + SQL Server, orquestrados por Docker Compose.

```
Navegador ──► Nginx (web, :3000) ──► ASP.NET Core (api, :5000) ──► SQL Server (db, :1433)
              SPA + proxy de /api/        EF Core + PdfPig
```

---

## Requisitos

Para rodar a aplicação e os testes, **só o Docker é necessário** — nem .NET nem
Node.js precisam estar instalados na máquina.

| Requisito | Versão mínima | Observação |
|---|---|---|
| [Docker](https://docs.docker.com/get-docker/) | Engine 20.10 | Docker Desktop no Windows/macOS; Docker Engine no Linux |
| Docker Compose | v2 (plugin) | já vem no Docker Desktop e no plugin `docker-compose-plugin`; só quem for usar um SQL Server externo (abaixo) precisa de v2.24+, por causa do `!reset` em `docker-compose.external-db.yml` |
| Git | qualquer | para clonar |

Espaço em disco: a primeira subida baixa cerca de **2 GB** de imagens (a do SQL
Server é a maior) e leva alguns minutos; as seguintes são rápidas.

Opcional, e só para desenvolver fora do Docker:

| Ferramenta | Versão | Para quê |
|---|---|---|
| [.NET SDK](https://dotnet.microsoft.com/download) | 10.0 | `dotnet run` / `dotnet test` direto no backend |
| [Node.js](https://nodejs.org/) | 24 | `npm run dev` com hot reload no frontend |
| `sqlcmd` | 18 | aplicar os scripts de `database/` sem passar pelo container |

---

## Início rápido

Clone e rode **um** comando. O script confere o Docker, cria o `.env`, builda as
imagens, sobe os serviços e só devolve o terminal quando a API responde.

**Linux, macOS, WSL e Git Bash no Windows:**

```sh
git clone https://github.com/rian-salin/Cadastro-de-curr-culos.git cadastro-de-curriculos
cd cadastro-de-curriculos
./setup.sh
```

**Windows (PowerShell):**

```powershell
git clone https://github.com/rian-salin/Cadastro-de-curr-culos.git cadastro-de-curriculos
cd cadastro-de-curriculos
.\setup.ps1
```

**Sem script, em qualquer sistema** — o Compose já tem padrões de
desenvolvimento para todas as variáveis, então um clone novo sobe sem nenhum
passo anterior:

```sh
docker compose up --build
```

Ao terminar, a aplicação está em **http://localhost:3000**.

> A API espera o healthcheck do SQL Server e aplica as migrations na subida, então
> o banco já nasce com a estrutura pronta. Nos primeiros segundos após o `up` a
> página ainda não abre, enquanto o banco inicializa — o `setup.sh`/`setup.ps1`
> espera por isso; com `docker compose up` direto, aguarde o log
> `Now listening on: http://0.0.0.0:5000`.

Verifique que subiu:

```sh
curl http://localhost:3000/api/health
# {"status":"ok","database":"connected"}
```

### Portas

| Serviço | URL |
|---|---|
| Frontend (Nginx) | http://localhost:3000 |
| Backend (API direta) | http://localhost:5000 |
| SQL Server | localhost:1433 |

Se alguma dessas portas já estiver em uso na sua máquina, mude o lado esquerdo
do mapeamento em `docker-compose.yml` (por exemplo `"3001:80"`).

---

## Configuração da conexão com o SQL Server

A conexão é configurada por **variáveis de ambiente**, lidas do `.env` na raiz.
O `.env` é ignorado pelo Git; o modelo versionado é o
[`.env.example`](.env.example), **sem credenciais reais**.

```sh
cp .env.example .env     # PowerShell: Copy-Item .env.example .env
```

| Variável | Padrão | O que é |
|---|---|---|
| `DB_PASSWORD` | `ChangeMe_2026!` | senha do usuário `sa` do SQL Server do Compose |
| `DB_NAME` | `CadastroCurriculosDb` | nome da base criada pelas migrations |
| `ASPNETCORE_ENVIRONMENT` | `Development` | `Development` expõe o OpenAPI em `/openapi/v1.json` |
| `DB_CONNECTION_STRING` | — | só para usar um SQL Server externo (veja abaixo) |

O Compose monta a connection string a partir de `DB_NAME` e `DB_PASSWORD` e a
entrega à API como `ConnectionStrings__Default`:

```
Server=db,1433;Database=${DB_NAME};User Id=sa;Password=${DB_PASSWORD};TrustServerCertificate=True;Connect Timeout=5;
```

A senha do `sa` precisa ter ao menos 8 caracteres e 3 destas 4 categorias:
maiúsculas, minúsculas, dígitos e símbolos.

> **O SQL Server só aplica `DB_PASSWORD` na primeira subida**, quando cria o
> volume `db-data`. Para trocar a senha depois, recrie o volume — o que **apaga
> os dados**:
>
> ```sh
> docker compose down -v && docker compose up --build
> ```

O `appsettings.json` do backend também traz uma connection string, usada apenas
quando se roda a API fora do Docker (`dotnet run`). Ela aponta para
`localhost,1433` com senha de exemplo e é sobrescrita pela variável de ambiente
sempre que ela existe.

### Usar um SQL Server que já existe

Para apontar a API para uma instância sua em vez do container `db`, preencha
`DB_CONNECTION_STRING` no `.env` e suba com o arquivo de override:

```sh
docker compose -f docker-compose.yml -f docker-compose.external-db.yml up --build
```

```ini
# .env — um SQL Server rodando na própria máquina
DB_CONNECTION_STRING=Server=host.docker.internal,1433;Database=CadastroCurriculosDb;User Id=sa;Password=SUA_SENHA;TrustServerCertificate=True;Connect Timeout=5;
```

O override remove o container `db` do projeto e faz `host.docker.internal`
resolver também no Linux. A base precisa existir
([`database/create-database.sql`](database/create-database.sql) a cria); as
tabelas a API cria sozinha pelas migrations.

Rodando a API fora do Docker, a mesma configuração vem da variável de ambiente:

```sh
# bash / zsh
export ConnectionStrings__Default="Server=localhost,1433;Database=CadastroCurriculosDb;User Id=sa;Password=SUA_SENHA;TrustServerCertificate=True;"
dotnet run --project backend/CadastroCurriculos.Api
```

```powershell
# PowerShell
$env:ConnectionStrings__Default = "Server=localhost,1433;Database=CadastroCurriculosDb;User Id=sa;Password=SUA_SENHA;TrustServerCertificate=True;"
dotnet run --project backend/CadastroCurriculos.Api
```

---

## Estrutura do banco

A fonte da verdade são as **migrations do EF Core**, em
[`backend/CadastroCurriculos.Api/Migrations/`](backend/CadastroCurriculos.Api/Migrations/).
A API as aplica na subida (`Database.Migrate()` em
[`Program.cs`](backend/CadastroCurriculos.Api/Program.cs)), então **o caminho
padrão não exige nenhum passo manual**: `docker compose up` já deixa o banco com
a estrutura criada.

Para quem precisa aplicar a estrutura à mão — em um SQL Server que já existe, ou
onde o deploy não pode rodar migrations — a pasta [`database/`](database/) traz
os scripts equivalentes:

| Script | O que faz |
|---|---|
| [`database/create-database.sql`](database/create-database.sql) | cria a base `CadastroCurriculosDb` se ela não existir |
| [`database/schema.sql`](database/schema.sql) | cria a tabela `Candidates`, o índice único de e-mail e a `__EFMigrationsHistory` |

`schema.sql` é gerado das migrations com
`dotnet ef migrations script --idempotent` e é **idempotente**: rodar duas vezes
não dá erro nem duplica nada.

```sh
sqlcmd -S localhost,1433 -U sa -P "SUA_SENHA" -C -i database/create-database.sql
sqlcmd -S localhost,1433 -U sa -P "SUA_SENHA" -C -d CadastroCurriculosDb -i database/schema.sql
```

Sem `sqlcmd` instalado, use o que já vem na imagem do SQL Server:

```sh
docker compose exec -T db /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "SUA_SENHA" -C -i /dev/stdin < database/schema.sql
```

Tabela `Candidates`:

| Coluna | Tipo | Nulo | Observação |
|---|---|---|---|
| `Id` | `int` | não | `IDENTITY`, chave primária |
| `FullName` | `nvarchar(150)` | não | |
| `Email` | `nvarchar(254)` | não | índice único `IX_Candidates_Email` |
| `Phone` | `nvarchar(20)` | sim | |
| `AreaOfInterest` | `nvarchar(100)` | sim | |
| `ProfessionalSummary` | `nvarchar(2000)` | sim | |
| `CreatedAt` | `datetimeoffset` | não | |

Mais detalhes, e o comando equivalente no PowerShell, em
[`database/README.md`](database/README.md).

### Criar uma migration

```sh
make migration NAME=NomeDaMigration   # cria a migration e regenera o schema.sql
make schema                           # só regenera o schema.sql
```

Os dois alvos rodam o `dotnet ef` em um container do SDK .NET 10, sem exigir o
SDK instalado. Com o SDK local, o equivalente é
`dotnet ef migrations add NomeDaMigration --project backend/CadastroCurriculos.Api`
— nesse caso regenere o `schema.sql` com `make schema` depois.

No PowerShell, sem `make` nem SDK local, o equivalente aos dois alvos juntos é:

```powershell
docker run --rm `
    -e DOTNET_NOLOGO=1 -e DOTNET_CLI_TELEMETRY_OPTOUT=1 -e DOTNET_SKIP_WORKLOAD_INTEGRITY_CHECK=1 `
    -e NUGET_PACKAGES=/nuget -v "$HOME/.nuget/packages:/nuget" `
    -v "${PWD}:/repo" -w /repo/backend `
    mcr.microsoft.com/dotnet/sdk:10.0 `
    sh -c 'dotnet tool restore && dotnet restore CadastroCurriculos.Api && dotnet ef migrations add NomeDaMigration --project CadastroCurriculos.Api && dotnet ef migrations script --idempotent --project CadastroCurriculos.Api --output /repo/database/schema.sql && sed -i "1s/^\xef\xbb\xbf//" /repo/database/schema.sql'
```

(Troque `NomeDaMigration` pelo nome real. O `--user` do Makefile fica de fora —
não tem equivalente no Windows e não é necessário lá.)

---

## Executar a aplicação

| Ação | Comando |
|---|---|
| Subir em primeiro plano | `docker compose up --build` |
| Subir em segundo plano | `docker compose up --build -d` |
| Ver os logs | `docker compose logs -f` (ou `... logs -f api`) |
| Status dos containers | `docker compose ps` |
| Parar | `docker compose down` |
| Parar e **apagar o banco** | `docker compose down -v` |

Em Linux, macOS, WSL e Git Bash há atalhos no `Makefile` — `make help` lista
todos (`make up-d`, `make logs`, `make clean`, …). Para os comandos desta tabela,
o `Makefile` é só conveniência: todo comando dele tem o equivalente em
`docker compose` acima, que é o que se usa no PowerShell. Já `make migration` e
`make schema` (seção anterior) não têm atalho nativo do Compose — o equivalente
em PowerShell está descrito lá.

### Desenvolvimento com hot reload

O frontend pode rodar com o Vite local, contra a API do Compose:

```sh
docker compose up -d db api          # backend em localhost:5000
cd frontend && npm install && npm run dev
```

O Vite sobe em http://localhost:5173 e faz proxy de `/api` para
`localhost:5000`.

---

## Testes

Os testes também rodam **em container**, com o mesmo comando nos três sistemas —
sem .NET nem Node.js instalados:

```sh
docker compose -f docker-compose.test.yml run --rm tests        # backend  (69 testes)
docker compose -f docker-compose.test.yml run --rm tests-web    # frontend (71 testes)
```

Com `make`: `make test` roda os dois, `make test-api` e `make test-web` rodam um
de cada vez.

**Backend** — testes de integração dos endpoints (`WebApplicationFactory`) e
unitários da heurística de extração do PDF. Cada execução sobe um SQL Server
descartável via **Testcontainers** e aplica as migrations reais, então o Docker
precisa estar rodando; leva cerca de 30 segundos. O container de testes recebe o
socket do Docker para criar esse banco como container irmão, e o alcança por
`host.docker.internal` — que o Docker Desktop resolve e o `extra_hosts` do
`docker-compose.test.yml` cobre no Linux.

**Frontend** — testes de componente com Vitest + Testing Library (jsdom), com a
camada de API mockada: cobrem a validação do formulário, as mensagens de erro
vindas da API, a listagem, a tela de detalhes, a validação do arquivo do
currículo e o preenchimento do formulário a partir do PDF.

Com os SDKs instalados, dá para rodar direto no host:

```sh
dotnet test backend/CadastroCurriculos.sln
cd frontend && npm install && npm test
```

---

## Tecnologias e versões

As versões do frontend são as do `package-lock.json`; as do backend, as dos
`.csproj`.

### Frontend

| Tecnologia | Versão |
|---|---|
| React / React DOM | 19.3.0 |
| TypeScript | 6.0.3 |
| Vite | 8.3.1 |
| `@vitejs/plugin-react` | 6.1.1 |
| react-router | 8.4.0 |
| oxlint | 1.86.0 |
| Node.js (build da imagem) | `node:24-alpine` (hoje 24.21 — tag flutuante) |
| Nginx (runtime da imagem) | `nginx:alpine` (hoje 1.31 — tag flutuante) |

### Backend

| Tecnologia | Versão |
|---|---|
| .NET / ASP.NET Core Web API | 10.0 |
| Microsoft.AspNetCore.OpenApi | 10.0.12 |
| Microsoft.EntityFrameworkCore.SqlServer | 10.0.12 |
| Microsoft.EntityFrameworkCore.Design / `dotnet-ef` | 10.0.12 |
| PdfPig (leitura do PDF) | 0.1.16 |

### Banco e infraestrutura

| Tecnologia | Versão |
|---|---|
| SQL Server | 2025 (17.0, `2025-latest`, Developer Edition) |
| Docker Compose | v2 (schema sem `version:`) |

### Dependências de teste

| Tecnologia | Versão |
|---|---|
| xunit.v3 | 3.2.2 |
| xunit.runner.visualstudio | 3.1.5 |
| Microsoft.NET.Test.Sdk | 18.10.1 |
| Microsoft.AspNetCore.Mvc.Testing | 10.0.12 |
| Testcontainers.MsSql | 4.15.0 |
| Vitest | 5.0.3 |
| Testing Library — react / dom / user-event / jest-dom | 16.3.3 / 10.4.2 / 14.6.7 / 7.0.1 |
| jsdom | 30.1.1 |

---

## Estrutura do repositório

```
├── setup.sh / setup.ps1              configuração em um comando (Unix / Windows)
├── docker-compose.yml                stack principal: db + api + web
├── docker-compose.test.yml           testes de backend e frontend em container
├── docker-compose.external-db.yml    override para usar um SQL Server externo
├── .env.example                      modelo de configuração, sem credenciais
├── Makefile                          atalhos (opcional)
├── database/                         scripts SQL equivalentes às migrations
├── backend/
│   ├── CadastroCurriculos.Api/       API: Controllers, Domain, Data, Resumes, Migrations
│   └── CadastroCurriculos.Api.Tests/ testes de integração e unitários
├── frontend/                         SPA React (src/api, src/components, src/pages)
├── curriculo_rian_formulario.pdf     PDF de exemplo para testar a extração (veja Cadastro com PDF)
└── DESENVOLVIMENTO.md                processo, decisões e uso de IA
```

---

## Telas

| Rota | Tela |
|---|---|
| `/candidates` | listagem, do candidato mais recente para o mais antigo |
| `/candidates/new` | formulário de cadastro |
| `/candidates/{id}` | detalhes do candidato |
| qualquer outra | página "não encontrada", com link de volta para a listagem |

O formulário valida os mesmos campos que a API, com as mesmas mensagens, antes
de enviar — e continua exibindo os erros que a API devolve (campo inválido,
e-mail já cadastrado). A raiz (`/`) redireciona para a listagem.

No topo do formulário, um bloco recebe um currículo em PDF: o que for
identificado (nome, e-mail e telefone) preenche os campos, que continuam
editáveis antes de salvar. Detalhes em [Cadastro com PDF](#cadastro-com-pdf).

---

## API

Todas as rotas ficam sob `/api` (acessíveis pela porta 3000 via Nginx ou direto
na 5000). Erros seguem o formato `ProblemDetails`; erros de campo vêm em
`errors`, com a chave igual ao nome do campo no JSON.

| Método | Rota | Respostas |
|---|---|---|
| `POST` | `/api/candidates` | `201` candidato criado (header `Location`) · `400` campos inválidos · `409` e-mail já cadastrado |
| `GET` | `/api/candidates` | `200` lista resumida, do mais recente para o mais antigo |
| `GET` | `/api/candidates/{id}` | `200` candidato completo · `404` não encontrado |
| `POST` | `/api/resumes/extract` | `200` campos identificados (`null` no que não foi achado) · `400` arquivo ausente, acima de 5 MB ou que não é PDF · `422` PDF ilegível ou sem texto |
| `GET` | `/api/health` | `200` API e banco no ar · `503` banco indisponível |

Exemplo de cadastro:

```json
{
  "fullName": "Maria Souza",
  "email": "maria.souza@example.com",
  "phone": "(11) 98888-7777",
  "areaOfInterest": "Desenvolvimento Backend",
  "professionalSummary": "Desenvolvedora .NET com 5 anos de experiência."
}
```

Regras de validação (as mesmas para o cadastro manual e o com PDF):

| Campo | Regras |
|---|---|
| `fullName` | obrigatório, até 150 caracteres |
| `email` | obrigatório, formato `nome@dominio.ext`, até 254 caracteres, único (sem diferenciar maiúsculas) |
| `phone` | opcional, só números, espaços e `+ ( ) -`, até 20 caracteres |
| `areaOfInterest` | opcional, até 100 caracteres |
| `professionalSummary` | opcional, até 2000 caracteres |

Espaços nas pontas são removidos, campos opcionais vazios são gravados como
nulos e o e-mail é gravado em minúsculas.

Exemplos prontos para o VS Code / Rider em
[`backend/CadastroCurriculos.Api/CadastroCurriculos.Api.http`](backend/CadastroCurriculos.Api/CadastroCurriculos.Api.http).
Com `ASPNETCORE_ENVIRONMENT=Development`, o OpenAPI fica em
http://localhost:5000/openapi/v1.json.

---

## Cadastro com PDF

O PDF é opcional e só preenche o formulário: quem salva é sempre o mesmo
`POST /api/candidates` do cadastro manual, com as mesmas regras de validação.

1. Em `/candidates/new`, escolha um PDF no bloco "Tem o currículo em PDF?".
   Há um exemplo em [`curriculo_rian_formulario.pdf`](curriculo_rian_formulario.pdf).
2. O navegador confere tipo e tamanho e envia o arquivo para
   `POST /api/resumes/extract`. A API valida de novo (até 5 MB e a assinatura
   `%PDF-` no início do arquivo, sem confiar no `Content-Type`), extrai o texto
   com o PdfPig e procura nome, e-mail e telefone.
3. O que for identificado preenche os campos; o que não for fica como estava. Uma
   mensagem diz o que foi preenchido e o que falta preencher.
4. Arquivo inválido, arquivo grande demais ou PDF ilegível mostram uma mensagem e
   não bloqueiam o formulário: dá para preencher e salvar à mão.

Nada do PDF é gravado: nem o arquivo, nem o texto extraído.

### Como a extração funciona

| Campo | Heurística |
|---|---|
| E-mail | o primeiro endereço no formato `nome@dominio.ext` do texto, em minúsculas |
| Telefone | o primeiro número brasileiro com DDD, com ou sem `+55` e parênteses, celular ou fixo: `(11) 98888-7777`, `+55 11 98888-7777`, `11988887777`, `(11) 3333-4444` |
| Nome | uma linha `Nome:` ou `Nome completo:` em qualquer ponto do texto; senão, a primeira linha, entre as 5 primeiras não vazias, com 2 a 6 palavras só de letras (acentos, `'` e `-` aceitos), até 150 caracteres (o limite do campo) e sem palavras de cabeçalho como "Currículo" ou "Dados Pessoais" |

Antes de procurar o nome, cada linha é quebrada nos separadores `|`, `•` e `·`,
para cobrir cabeçalhos como `Maria Souza | maria@exemplo.com | (11) 98888-7777`.

---

O processo de desenvolvimento, as decisões de arquitetura e como a IA participou
estão em [DESENVOLVIMENTO.md](DESENVOLVIMENTO.md).
