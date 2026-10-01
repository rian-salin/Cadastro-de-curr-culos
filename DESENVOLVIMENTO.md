# Desenvolvimento

Como este desafio foi organizado, executado e verificado, incluindo o uso de
inteligência artificial. A documentação do produto (como rodar, API, telas,
limitações da extração) fica no [README.md](README.md).

## Como organizei e executei o trabalho

Dividi o desafio em **quatro etapas verticais**, cada uma entregando algo que
roda de ponta a ponta antes de a próxima começar:

| # | Etapa | Data | O que entregou |
|---|---|---|---|
| 1 | Configuração base | 29/09 | React + ASP.NET Core + SQL Server no Docker Compose, validados por um health-check ponta a ponta |
| 2 | Cadastro de candidatos (backend) | 30/09 | Entidade, migration, `POST`/`GET`/`GET {id}`, validação e testes de integração |
| 3 | Cadastro de candidatos (frontend) | 30/09 | Roteamento, formulário, listagem e detalhes |
| 4 | Cadastro com PDF | 30/09 | `POST /api/resumes/extract`, heurística de extração e o bloco de upload no formulário |

A ordem não é acidental: a etapa 2 define que **só o `POST /api/candidates`
salva candidato**, e isso é o que garante "as mesmas regras de validação nos
dois caminhos" exigido pelo enunciado. A etapa 3 já nasceu com o formulário
como componente separado da página, justamente para a etapa 4 reaproveitá-lo:
o cadastro com PDF não precisou reescrever nada do cadastro manual.

Cada etapa seguiu o mesmo ciclo:

1. **Alinhamento**: reler o enunciado e decidir o que entra e o que fica fora.
2. **Spec de design**: arquitetura, contrato dos endpoints, mensagens exatas,
   escopo explícito ("dentro" e "fora").
3. **Plano de implementação**: tasks com arquivos, passos e comandos de
   verificação, mais uma seção *Review Focus* listando os casos-limite que
   precisam virar teste.
4. **Execução task por task**, com commit pequeno ao fim de cada uma.

As convenções de cada camada ficaram escritas em `backend/CLAUDE.md` e
`frontend/CLAUDE.md`: stack, estilo de código, regras derivadas do enunciado e
comandos. Isso serviu tanto de documentação para mim quanto de contexto
permanente para a IA, evitando repetir as mesmas instruções a cada sessão.

## Principais decisões técnicas

**Controllers em vez de Minimal APIs.** O `[ApiController]` já gera
`ValidationProblemDetails` a partir das DataAnnotations, com as chaves de
`errors` no nome do campo do JSON. Isso deu validação consistente e um formato
de erro único (`ProblemDetails`) praticamente de graça.

**EF Core direto no controller, sem camada de serviço nem repositório.** O
enunciado pede uma solução simples e explicável. Um repositório genérico sobre
o EF Core seria uma abstração sem uso: o controller é fino, e a lógica que
merecia isolamento (a heurística de extração) foi isolada de verdade.

**Migrations aplicadas na subida da API.** `Database.Migrate()` no
`Program.cs`, mais healthcheck do SQL Server no Compose com
`depends_on: service_healthy`. Assim `docker compose up --build` num checkout
limpo deixa o banco pronto sem passo manual, que é um dos critérios de
avaliação.

**Validação escrita duas vezes, de propósito, com mensagens idênticas.** O
cliente valida para dar resposta imediata; o backend continua sendo a fonte da
verdade. Os limites de tamanho e as regex ficam definidos uma vez em cada lado
(`Candidate` no backend, `candidateLimits` no frontend) e as mensagens são
literalmente as mesmas, para o usuário não ver duas redações da mesma regra.

## Ferramentas de IA e modelos

| Ferramenta | Uso |
|---|---|
| **Claude Code** | o agente que ajudou a desenvolver o código |
| **Claude Sonnet 5** | etapa 1 configuração base |
| **Claude Opus 5** | etapas 2, 3 e 4 |
| **SDD/TDD + engenharia de contexto** | fluxo de trabalho: spec → plano guiado por testes → execução task por task → verificação antes de concluir, sempre com o contexto certo (CLAUDE.md, docs, diffs) na janela |
| **Subagentes** | tarefas isoladas (pesquisa, exploração de código) sem poluir o contexto principal |
| **Skills** | procedimentos empacotados e reaproveitáveis (ex.: revisão de código, verificação antes de concluir) |
| **MCPs** | protocolo que conecta o agente a ferramentas externas, como o Playwright MCP |
| **`CLAUDE.md` por camada** | contexto permanente (stack, convenções, regras do enunciado) |

## Em que etapas a IA ajudou

**Desenho e planejamento.** Foi onde o ganho foi maior. Um pedido típico:

> "Leia `docs/superpowers/CONTEXTO.md`. Vamos desenhar a configuração base:
> React, ASP.NET Core e SQL Server rodando via Docker Compose, com um
> health-check que prove que as três camadas se falam. Sem entidade de negócio
> ainda."

A resposta foi uma spec com arquitetura, stack com versões, estrutura de pastas
e critério de sucesso. Revisei e ajustei o escopo (tirei autenticação e CI, que
não estão no enunciado) antes de pedir o plano de implementação. O plano saiu de
um *dry run* (o agente montou o scaffold e subiu a stack de verdade antes de
escrever os passos), então os comandos no plano já eram comandos que
funcionaram, não suposições. Foi assim que o problema do login com banco
inexistente (erro 18456 do SQL Server) apareceu no planejamento, e não no meio
da implementação.

**Implementação.** Pedidos no formato "implemente a Task 3 do plano". Por ter
plano, arquivos e mensagens exatas definidos antes, o código saiu aderente às
convenções do `CLAUDE.md` e os commits ficaram pequenos e coerentes. O que
aproveitei quase sem mexer: os DTOs com normalização (trim, opcional vazio →
`null`, e-mail em minúsculas), a camada de API do frontend (onde 400/409/404
viram dado tipado e só o inesperado lança exceção) e os testes dos casos-limite.

**Revisão de código.** Pedi revisão do diff ao fim de cada etapa, e foi
produtivo: a revisão do backend apontou dois problemas reais que eu não tinha
visto (`Location` absoluto atrás do proxy e negação de serviço no regex de
e-mail), ambos corrigidos no commit `c55a4f9` com teste.

**Verificação no navegador.** Com o Playwright MCP o agente percorreu o fluxo
real (escolher PDF, conferir o preenchimento, salvar, abrir os detalhes) em vez
de eu só confiar nos testes.

## O que precisei corrigir, adaptar ou descartar

**Corrigido depois de revisão ou de teste manual:**

- O regex de telefone usava `\s`, que atravessa quebra de linha: um número
  podia ser montado com dígitos de duas linhas diferentes, ou chegar ao campo
  com uma quebra invisível dentro. Troquei por `\p{Zs}` (só espaços
  horizontais, incluindo o espaço sem quebra) e acrescentei os lookarounds que
  evitam cortar um número maior pelo meio.
- As cores de erro e sucesso ficavam abaixo do contraste mínimo WCAG AA no modo
  escuro. Corrigido no CSS, e o modo escuro entrou no roteiro de verificação.
- O título do bloco de upload dizia "(opcional)" duas vezes, no título e no
  texto.

**Adaptado:**

- Validações so existiam no backend, achei melhor ter 2 camadas, para o frontend dar um feedback rapido do erro.

**Deixado fora, de propósito, e documentado como limitação:** OCR de PDF
escaneado, extração de área de interesse e resumo profissional (o enunciado pede
nome, e-mail e telefone), edição e exclusão de candidato, paginação e busca na
listagem, e autenticação.

## Como verifiquei se a solução estava correta

**Testes automatizados (140 no total, todos passando):**

```
make test                 # 69 testes do backend
npm test  (em frontend/)  # 71 testes em 8 arquivos
```

No backend, os testes de endpoint sobem um SQL Server descartável via
Testcontainers e aplicam as migrations reais, e os testes da heurística rodam
sem HTTP nem banco. No frontend, são testes de componente em Vitest + Testing
Library com a camada de API mockada.

A seção *Review Focus* de cada plano foi o que definiu o que testar: campo
exatamente no limite com acentos, `id`/`createdAt` enviados pelo cliente no
POST (mass assignment), 404 sem corpo JSON, clique duplo em Salvar, e-mail
duplicado diferindo só na caixa, cancelar a janela de escolha de arquivo,
escolher o mesmo arquivo de novo depois de um erro, duas leituras concorrentes,
PDF com quebras `\r\n`, nome e cabeçalho em maiúsculas com acento.

**Build e lint como portões:** `npm run build` roda `tsc -b`, então erro de tipo
quebra o build; `npm run lint` roda o oxlint.

**Verificação manual roteirizada** em cada etapa, com o que não dá para cobrir
em teste:

- `make down && make up-d` a partir do zero, para provar que a subida aplica a
  migration sozinha, e também sobre um volume antigo, criado pelo
  `EnsureCreated`.
- No navegador, pela porta 3000: enviar o PDF, conferir os campos preenchidos,
  corrigir, salvar, ver na listagem, abrir os detalhes, e repetir com arquivo
  inválido e PDF ilegível para confirmar que o cadastro manual continua
  funcionando. O `curriculo_rian_formulario.pdf` da raiz é o PDF usado nesse
  teste, deixado no repositório para quem for avaliar.

## Tempo dedicado

**Cerca de 8 horas, em dois dias:** aproximadamente 2 horas em 29/09
(configuração base) e 6 horas em 30/09 (backend, frontend e cadastro com PDF).

## Dificuldades, limitações e o que faria com mais tempo

### Dificuldades

- **Corrida entre a API e o banco no `up`.** Nos primeiros segundos a API
  responde 503 enquanto o SQL Server inicializa. Resolvido com healthcheck e
  `depends_on: service_healthy`, e documentado no README como comportamento
  esperado.
- **Calibrar a heurística do telefone.** Intervalos de anos, CEP e CPF parecem
  telefone. Exigir o DDD foi o que separou os casos sem complicar o padrão.

### Limitações conhecidas

As limitações da extração estão detalhadas no
[README](README.md#limitações-da-extração): sem OCR, layouts em colunas podem
sair fora de ordem, o nome só é encontrado rotulado ou nas 5 primeiras linhas,
só telefone brasileiro com DDD, e só o primeiro e-mail e telefone do texto.

Da aplicação: sem paginação nem busca na listagem, sem edição nem exclusão, sem
autenticação (qualquer pessoa com acesso à porta vê todos os candidatos).

### O que faria com mais tempo

**Guardar o PDF.** Hoje o arquivo é lido e descartado. Armazená-lo (em blob
storage, com o caminho no banco) e permitir baixá-lo na tela de detalhes é o que
um time de recrutamento pediria em seguida.

**Pipeline de CI/CD.** Hoje a verificação é manual: eu que rodo `make test`,
`npm run build`, `npm run lint` e `npm test` antes de cada commit. Um pipeline
(GitHub Actions, por exemplo) rodaria isso em cada push e pull request, mais os
fluxos que hoje verifico à mão no navegador transformados em testes Playwright,
tirando o roteiro manual do caminho crítico, e, na sequência, build e
publicação automática das imagens Docker.

**Login e cadastro mais seguros.** O desafio não pediu autenticação, mas, se
fosse para produção, o cadastro de usuários (da equipe de recrutamento, não dos
candidatos) precisaria de: bloqueio escalonado por tentativa de senha errada
(atraso crescente a cada falha, até um bloqueio temporário da conta) e rate
limit por IP no endpoint de login, para dificultar força bruta e
credential stuffing; MFA (segundo fator por app autenticador ou e-mail) para
quem acessa dados pessoais de candidatos; e reCAPTCHA no formulário de login e
no de cadastro, para conter automação.
