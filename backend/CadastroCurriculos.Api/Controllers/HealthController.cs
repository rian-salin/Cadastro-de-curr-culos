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
            // No migrations exist yet in this stage, so make sure the
            // database itself exists before checking connectivity to it.
            // TODO: remove once migrations exist — EnsureCreated and Migrate
            // are mutually exclusive, and this will need to move out of a
            // per-request health check before the first migration is added.
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
