using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace CadastroCurriculos.Api.Contracts;

// RegularExpressionAttribute usa o motor com backtracking, vulnerável a negação de serviço
// com entradas maliciosamente longas (tempo exponencial em vez de linear). NonBacktracking
// garante tempo linear no tamanho da entrada para o mesmo padrão.
public sealed class SafeRegularExpressionAttribute : ValidationAttribute
{
    private readonly Regex _regex;

    public SafeRegularExpressionAttribute(string pattern)
    {
        _regex = new Regex(pattern, RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);
    }

    public override bool IsValid(object? value) =>
        value is not string text || text.Length == 0 || _regex.IsMatch(text);
}
