namespace CadastroCurriculos.Api.Contracts;

public record CandidateSummaryResponse(
    int Id,
    string FullName,
    string Email,
    string? AreaOfInterest,
    DateTimeOffset CreatedAt);
