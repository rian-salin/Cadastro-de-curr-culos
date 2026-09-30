using CadastroCurriculos.Api.Domain;

namespace CadastroCurriculos.Api.Contracts;

public record CandidateResponse(
    int Id,
    string FullName,
    string Email,
    string? Phone,
    string? AreaOfInterest,
    string? ProfessionalSummary,
    DateTimeOffset CreatedAt)
{
    public static CandidateResponse FromEntity(Candidate candidate) => new(
        candidate.Id,
        candidate.FullName,
        candidate.Email,
        candidate.Phone,
        candidate.AreaOfInterest,
        candidate.ProfessionalSummary,
        candidate.CreatedAt);
}
