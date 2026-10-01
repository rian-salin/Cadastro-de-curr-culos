-- Cria a base, se ela ainda não existir. Só é necessário em um SQL Server que
-- já existe: no compose, a API cria a base junto com as migrations na subida.
--
-- Se mudou DB_NAME no .env, troque o nome nas duas linhas abaixo.
IF DB_ID(N'CadastroCurriculosDb') IS NULL
    CREATE DATABASE [CadastroCurriculosDb];
GO
