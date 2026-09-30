using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Testcontainers.MsSql;

[assembly: AssemblyFixture(typeof(CadastroCurriculos.Api.Tests.ApiFactory))]

namespace CadastroCurriculos.Api.Tests;

// Um SQL Server descartável por execução, compartilhado por todas as classes de teste.
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly MsSqlContainer _database = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2025-latest").Build();

    public async ValueTask InitializeAsync()
    {
        await _database.StartAsync();
        // Sobe a API uma vez só, antes dos testes: CreateClient() chamado em paralelo
        // por várias classes criaria mais de um host, com migrations concorrentes.
        StartServer();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        var connectionString = new SqlConnectionStringBuilder(_database.GetConnectionString())
        {
            InitialCatalog = "CadastroCurriculosTests",
        }.ConnectionString;

        builder.UseSetting("ConnectionStrings:Default", connectionString);
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await _database.DisposeAsync();
    }
}
