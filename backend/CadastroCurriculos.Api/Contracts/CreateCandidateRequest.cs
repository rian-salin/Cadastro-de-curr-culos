using System.ComponentModel.DataAnnotations;
using CadastroCurriculos.Api.Domain;

namespace CadastroCurriculos.Api.Contracts;

// A normalização roda no init, durante a desserialização, para que a validação
// enxergue exatamente o valor que será gravado.
public class CreateCandidateRequest
{
    [Required(ErrorMessage = "Informe o nome completo.")]
    [MaxLength(Candidate.FullNameMaxLength, ErrorMessage = "O nome deve ter no máximo {1} caracteres.")]
    public string? FullName { get; init => field = value?.Trim(); }

    [Required(ErrorMessage = "Informe o e-mail.")]
    [RegularExpression(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", ErrorMessage = "Informe um e-mail válido.")]
    [MaxLength(Candidate.EmailMaxLength, ErrorMessage = "O e-mail deve ter no máximo {1} caracteres.")]
    public string? Email { get; init => field = value?.Trim().ToLowerInvariant(); }

    [RegularExpression(@"^[0-9+()\s-]*$", ErrorMessage = "O telefone deve conter apenas números, espaços e os caracteres + ( ) -.")]
    [MaxLength(Candidate.PhoneMaxLength, ErrorMessage = "O telefone deve ter no máximo {1} caracteres.")]
    public string? Phone { get; init => field = NullIfBlank(value); }

    [MaxLength(Candidate.AreaOfInterestMaxLength, ErrorMessage = "A área de interesse deve ter no máximo {1} caracteres.")]
    public string? AreaOfInterest { get; init => field = NullIfBlank(value); }

    [MaxLength(Candidate.ProfessionalSummaryMaxLength, ErrorMessage = "O resumo profissional deve ter no máximo {1} caracteres.")]
    public string? ProfessionalSummary { get; init => field = NullIfBlank(value); }

    private static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
