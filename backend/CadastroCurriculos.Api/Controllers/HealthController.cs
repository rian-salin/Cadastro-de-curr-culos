using CadastroCurriculos.Api.Data;
using Microsoft.AspNetCore.Mvc;

namespace CadastroCurriculos.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public HealthController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        bool isHealthy;
        try
        {
            // No migrations exist yet in this stage, so make sure the
            // database itself exists before checking connectivity to it.
            await _dbContext.Database.EnsureCreatedAsync();
            isHealthy = await _dbContext.Database.CanConnectAsync();
        }
        catch
        {
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
