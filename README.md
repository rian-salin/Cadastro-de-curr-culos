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
