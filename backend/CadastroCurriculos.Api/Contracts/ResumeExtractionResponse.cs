using CadastroCurriculos.Api.Resumes;

namespace CadastroCurriculos.Api.Contracts;

public record ResumeExtractionResponse(string? FullName, string? Email, string? Phone)
{
    public static ResumeExtractionResponse FromParsed(ParsedResume parsed) =>
        new(parsed.FullName, parsed.Email, parsed.Phone);
}
