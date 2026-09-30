using CadastroCurriculos.Api.Data;
using Microsoft.AspNetCore.Mvc;

namespace CadastroCurriculos.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly ILogger<HealthController> _logger;

    public HealthController(AppDbContext dbContext, ILogger<HealthController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        bool isHealthy;
        try
        {
            // Ainda não há migrations nesta etapa, então garante que o banco
            // exista antes de testar a conexão com ele.
            // TODO: remover quando houver migrations — EnsureCreated e Migrate
            // são mutuamente exclusivos, e isto precisa sair do health-check
            // (que roda a cada requisição) antes da primeira migration.
            await _dbContext.Database.EnsureCreatedAsync();
            isHealthy = await _dbContext.Database.CanConnectAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Health check could not reach the database");
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
