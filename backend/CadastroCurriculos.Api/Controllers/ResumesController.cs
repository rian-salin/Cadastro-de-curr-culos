using CadastroCurriculos.Api.Contracts;
using CadastroCurriculos.Api.Resumes;
using Microsoft.AspNetCore.Mvc;

namespace CadastroCurriculos.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ResumesController : ControllerBase
{
    private const long MaxFileSize = 5 * 1024 * 1024;

    private const string InvalidFileTitle = "Arquivo inválido.";

    private const string UnreadablePdfTitle =
        "Não foi possível ler o texto deste PDF. Ele pode estar corrompido, protegido por senha " +
        "ou ser uma imagem escaneada. Preencha os dados manualmente.";

    private static ReadOnlySpan<byte> PdfSignature => "%PDF-"u8;

    private readonly ILogger<ResumesController> _logger;

    public ResumesController(ILogger<ResumesController> logger)
    {
        _logger = logger;
    }

    // IFormFile? de propósito: com o tipo não anulável, o [ApiController] recusaria sozinho
    // a requisição sem arquivo, com a mensagem padrão em inglês.
    [HttpPost("extract")]
    public async Task<ActionResult<ResumeExtractionResponse>> Extract(IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null)
        {
            return InvalidFile("Selecione um arquivo PDF.");
        }

        if (file.Length > MaxFileSize)
        {
            return InvalidFile("O arquivo deve ter no máximo 5 MB.");
        }

        var bytes = new byte[file.Length];
        await using var stream = file.OpenReadStream();
        await stream.ReadExactlyAsync(bytes, cancellationToken);

        // Confere a assinatura do conteúdo: Content-Type e extensão são o cliente quem define.
        if (!bytes.AsSpan().StartsWith(PdfSignature))
        {
            return InvalidFile("O arquivo precisa ser um PDF.");
        }

        string text;

        try
        {
            text = PdfTextReader.ReadText(bytes);
        }
        catch (PdfReadException ex)
        {
            _logger.LogWarning(ex, "Resume extraction failed: could not read the PDF");
            return UnreadablePdf();
        }

        if (string.IsNullOrWhiteSpace(text))
        {
            _logger.LogInformation("Resume extraction failed: the PDF has no text");
            return UnreadablePdf();
        }

        return ResumeExtractionResponse.FromParsed(ResumeParser.Parse(text));
    }

    private ActionResult InvalidFile(string message)
    {
        ModelState.AddModelError("file", message);
        return ValidationProblem(title: InvalidFileTitle, modelStateDictionary: ModelState);
    }

    private ObjectResult UnreadablePdf() =>
        Problem(title: UnreadablePdfTitle, statusCode: StatusCodes.Status422UnprocessableEntity);
}
