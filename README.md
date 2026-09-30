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

3. Acesse http://localhost:3000 — a listagem de candidatos é a tela inicial.
   O Compose só inicia a API (e, depois dela, o frontend) quando o SQL Server
   responde ao healthcheck, e a API aplica as migrations do banco sozinha ao
   subir. Nos primeiros segundos após o `up` a página ainda não abre, enquanto o
   banco inicializa.

## Portas

| Serviço | URL |
|---|---|
| Frontend (Nginx) | http://localhost:3000 |
| Backend (API direta) | http://localhost:5000 |
| SQL Server | localhost:1433 |

## Telas

| Rota | Tela |
|---|---|
| `/candidates` | listagem, do candidato mais recente para o mais antigo |
| `/candidates/new` | formulário de cadastro |
| `/candidates/{id}` | detalhes do candidato |

O formulário valida os mesmos campos que a API, com as mesmas mensagens, antes
de enviar — e continua exibindo os erros que a API devolve (campo inválido,
e-mail já cadastrado). A raiz (`/`) redireciona para a listagem.

## API

Todas as rotas ficam sob `/api` (acessíveis pela porta 3000 via Nginx ou direto
na 5000). Erros seguem o formato `ProblemDetails`; erros de campo vêm em
`errors`, com a chave igual ao nome do campo no JSON.

| Método | Rota | Respostas |
|---|---|---|
| `POST` | `/api/candidates` | `201` candidato criado (header `Location`) · `400` campos inválidos · `409` e-mail já cadastrado |
| `GET` | `/api/candidates` | `200` lista resumida, do mais recente para o mais antigo |
| `GET` | `/api/candidates/{id}` | `200` candidato completo · `404` não encontrado |
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
`backend/CadastroCurriculos.Api/CadastroCurriculos.Api.http`.

## Testes

```
make test
```

Roda os testes de integração do backend num container do SDK .NET 10. Cada
execução sobe um SQL Server descartável via Testcontainers e aplica as
migrations reais, então é preciso ter o Docker rodando (o comando monta o
socket do Docker no container de testes). Leva cerca de 30 segundos.

`make test` foi testado em Linux com Docker Engine (usa `stat -c`,
`--network host` e o grupo do socket do Docker, específicos de Linux). Em
outro sistema, rode `dotnet test backend/CadastroCurriculos.sln` diretamente
com o SDK .NET 10 e o Docker Desktop instalados.

Os testes do frontend rodam com Node local, dentro de `frontend/`:

```
npm install
npm test
```

São testes de componente com Vitest e Testing Library (jsdom), com a camada de
API mockada: cobrem a validação do formulário, as mensagens de erro vindas da
API, a listagem e a tela de detalhes.

## Tecnologias e versões

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | React | 19.2 |
| Frontend | TypeScript | 6.0 |
| Frontend | Vite | 8.3 |
| Frontend | oxlint | 1.86 |
| Frontend | react-router | 8.4.0 |
| Testes (frontend) | Vitest | 5.0.3 |
| Testes (frontend) | Testing Library (react / dom / user-event / jest-dom) | 16.3.3 / 10.4.2 / 14.6.7 / 7.0.1 |
| Testes (frontend) | jsdom | 30.1.1 |
| Servidor web | Nginx | alpine |
| Backend | ASP.NET Core Web API | .NET 10 |
| Backend | Microsoft.AspNetCore.OpenApi | 10.0.12 |
| ORM | Microsoft.EntityFrameworkCore.SqlServer | 10.0.12 |
| ORM | Microsoft.EntityFrameworkCore.Design / dotnet-ef | 10.0.12 |
| Banco de dados | SQL Server | 2025 |
| Testes | xunit.v3 | 3.2.2 |
| Testes | xunit.runner.visualstudio | 3.1.5 |
| Testes | Microsoft.NET.Test.Sdk | 18.10.1 |
| Testes | Microsoft.AspNetCore.Mvc.Testing | 10.0.12 |
| Testes | Testcontainers.MsSql | 4.15.0 |
| Infraestrutura | Docker + Docker Compose | - |
| Build do frontend (Dockerfile) | Node.js | 24 |

## Limitações conhecidas

- Um corpo de requisição que não é JSON válido (ou vazio) recebe `400` com
  mensagens técnicas em inglês geradas pelo ASP.NET Core. O frontend sempre
  envia JSON válido, então isso só aparece chamando a API diretamente.
- A listagem não tem paginação nem busca.
- Não há edição nem exclusão de candidato: o cadastro é só de entrada e
  consulta.
- A tela de detalhes é acessível por URL direta, mas o app não tem
  autenticação: qualquer pessoa com acesso à porta vê todos os candidatos.
