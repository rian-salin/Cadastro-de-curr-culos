using System.Text.RegularExpressions;
using CadastroCurriculos.Api.Domain;

namespace CadastroCurriculos.Api.Resumes;

public sealed record ParsedResume(string? FullName, string? Email, string? Phone);

// Heurística best-effort: o que não for identificado volta null, nunca erro.
public static partial class ResumeParser
{
    private const int NameSearchLineCount = 5;
    private const int MinNameWords = 2;
    private const int MaxNameWords = 6;

    private static readonly char[] PieceSeparators = ['|', '•', '·'];

    private static readonly HashSet<string> HeadingWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "currículo", "curriculo", "curriculum", "vitae", "resume", "résumé", "cv",
        "dados", "pessoais", "objetivo", "objetivos", "experiência", "experiencia",
        "profissional", "profissionais", "formação", "formacao", "acadêmica", "academica",
        "resumo", "contato", "informações", "informacoes", "habilidades", "competências",
        "competencias",
    };

    [GeneratedRegex(@"[\w.+-]+@[\w-]+(\.[\w-]+)+")]
    private static partial Regex EmailPattern();

    // O DDD obrigatório é o que separa telefone de intervalo de anos, CEP e CPF. Os separadores
    // são só horizontais (\p{Zs} inclui o espaço sem quebra): \s juntaria números de linhas
    // diferentes e deixaria uma quebra de linha, invisível no campo, dentro do telefone.
    [GeneratedRegex(@"(?<!\d)(?:\+?55[\p{Zs}-]?)?\(?\d{2}\)?[\p{Zs}-]?9?\d{4}[\p{Zs}-]?\d{4}(?!\d)")]
    private static partial Regex PhonePattern();

    [GeneratedRegex(@"^nome(\s+completo)?\s*:\s*(?<value>.+)$", RegexOptions.IgnoreCase)]
    private static partial Regex NameLabelPattern();

    [GeneratedRegex(@"^\p{L}+(['-]\p{L}+)*$")]
    private static partial Regex NameWordPattern();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespacePattern();

    public static ParsedResume Parse(string text)
    {
        var email = EmailPattern().Match(text);
        var phone = PhonePattern().Match(text);

        return new ParsedResume(
            FindName(text),
            email.Success ? email.Value.ToLowerInvariant() : null,
            phone.Success ? WhitespacePattern().Replace(phone.Value, " ") : null);
    }

    private static string? FindName(string text)
    {
        var lines = text.Split('\n')
            .Select(SplitIntoPieces)
            .Where(pieces => pieces.Length > 0)
            .ToList();

        var labeledName = lines
            .SelectMany(pieces => pieces)
            .Select(piece => NameLabelPattern().Match(piece))
            .Where(match => match.Success)
            .Select(match => match.Groups["value"].Value)
            .FirstOrDefault(LooksLikeName);

        return labeledName ?? lines
            .Take(NameSearchLineCount)
            .SelectMany(pieces => pieces)
            .FirstOrDefault(LooksLikeName);
    }

    // Cabeçalhos como "Maria Souza | maria@exemplo.com | (11) 98888-7777" são comuns.
    private static string[] SplitIntoPieces(string line) => line
        .Split(PieceSeparators)
        .Select(piece => WhitespacePattern().Replace(piece, " ").Trim())
        .Where(piece => piece.Length > 0)
        .ToArray();

    private static bool LooksLikeName(string value)
    {
        if (value.Length > Candidate.FullNameMaxLength)
        {
            return false;
        }

        var words = value.Split(' ');

        return words.Length is >= MinNameWords and <= MaxNameWords
            && words.All(word => NameWordPattern().IsMatch(word) && !HeadingWords.Contains(word));
    }
}
