namespace CadastroCurriculos.Api.Domain;

public class Candidate
{
    public const int FullNameMaxLength = 150;
    public const int EmailMaxLength = 254;
    public const int PhoneMaxLength = 20;
    public const int AreaOfInterestMaxLength = 100;
    public const int ProfessionalSummaryMaxLength = 2000;

    public int Id { get; set; }
    public required string FullName { get; set; }
    public required string Email { get; set; }
    public string? Phone { get; set; }
    public string? AreaOfInterest { get; set; }
    public string? ProfessionalSummary { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
