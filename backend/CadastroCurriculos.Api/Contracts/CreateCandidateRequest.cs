namespace CadastroCurriculos.Api.Contracts;

// A normalização roda no init, durante a desserialização, para que a validação
// enxergue exatamente o valor que será gravado.
public class CreateCandidateRequest
{
    public string? FullName { get; init => field = value?.Trim(); }

    public string? Email { get; init => field = value?.Trim().ToLowerInvariant(); }

    public string? Phone { get; init => field = NullIfBlank(value); }

    public string? AreaOfInterest { get; init => field = NullIfBlank(value); }

    public string? ProfessionalSummary { get; init => field = NullIfBlank(value); }

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
