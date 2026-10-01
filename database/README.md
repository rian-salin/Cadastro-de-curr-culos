# Banco de dados

A fonte da verdade do schema são as **migrations do EF Core**, em
[`backend/CadastroCurriculos.Api/Migrations/`](../backend/CadastroCurriculos.Api/Migrations/).
A API as aplica sozinha na subida (`Database.Migrate()` em
[`Program.cs`](../backend/CadastroCurriculos.Api/Program.cs)), então quem usa o
`docker compose up` não precisa rodar nada daqui.

Os scripts desta pasta existem para aplicar a mesma estrutura à mão, em um SQL
Server que já existe ou onde o deploy não pode rodar migrations.

| Arquivo | O que faz |
|---|---|
| `create-database.sql` | cria a base `CadastroCurriculosDb` se ela não existir |
| `schema.sql` | cria a tabela `Candidates`, o índice único de e-mail e a `__EFMigrationsHistory` |

`schema.sql` é **gerado** a partir das migrations com
`dotnet ef migrations script --idempotent`, e é idempotente: rodar duas vezes não
dá erro nem duplica nada. Regenere com `make schema` depois de criar uma
migration nova.

## Estrutura

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

A tabela `__EFMigrationsHistory` registra as migrations já aplicadas, para a API
não tentar reaplicá-las.

## Como aplicar

Com o `sqlcmd` instalado na máquina:

```sh
sqlcmd -S localhost,1433 -U sa -P "SUA_SENHA" -C -i database/create-database.sql
sqlcmd -S localhost,1433 -U sa -P "SUA_SENHA" -C -d CadastroCurriculosDb -i database/schema.sql
```

Sem `sqlcmd` na máquina, o `sqlcmd` que já vem na imagem do SQL Server resolve —
igual nos três sistemas:

```sh
docker compose exec -T db /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "SUA_SENHA" -C -i /dev/stdin < database/create-database.sql
```

No PowerShell, o redirecionamento muda:

```powershell
Get-Content database/create-database.sql | docker compose exec -T db `
  /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "SUA_SENHA" -C -i /dev/stdin
```
