using Microsoft.EntityFrameworkCore;

namespace CadastroCurriculos.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }
}
