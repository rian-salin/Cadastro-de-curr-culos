using CadastroCurriculos.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace CadastroCurriculos.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Candidate> Candidates => Set<Candidate>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Candidate>(candidate =>
        {
            candidate.Property(c => c.FullName).HasMaxLength(Candidate.FullNameMaxLength);
            candidate.Property(c => c.Email).HasMaxLength(Candidate.EmailMaxLength);
            candidate.Property(c => c.Phone).HasMaxLength(Candidate.PhoneMaxLength);
            candidate.Property(c => c.AreaOfInterest).HasMaxLength(Candidate.AreaOfInterestMaxLength);
            candidate.Property(c => c.ProfessionalSummary).HasMaxLength(Candidate.ProfessionalSummaryMaxLength);
            candidate.HasIndex(c => c.Email).IsUnique();
        });
    }
}
