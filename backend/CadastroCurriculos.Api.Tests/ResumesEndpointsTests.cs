using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using CadastroCurriculos.Api.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace CadastroCurriculos.Api.Tests;

public class ResumesEndpointsTests
{
    private const int MaxFileSize = 5 * 1024 * 1024;

    private const string UnreadablePdfTitle =
        "Não foi possível ler o texto deste PDF. Ele pode estar corrompido, protegido por senha " +
        "ou ser uma imagem escaneada. Preencha os dados manualmente.";

    private readonly HttpClient _client;

    public ResumesEndpointsTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    private Task<HttpResponseMessage> PostFile(
        byte[] content, string fileName = "curriculo.pdf", string contentType = "application/pdf")
    {
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        var form = new MultipartFormDataContent { { file, "file", fileName } };

        return _client.PostAsync("/api/resumes/extract", form, CancellationToken);
    }

    // Só a assinatura no começo, o resto zerado: passa na checagem de tipo, mas não é um PDF legível.
    private static byte[] BytesWithPdfSignature(int length)
    {
        var bytes = new byte[length];
        "%PDF-"u8.CopyTo(bytes);
        return bytes;
    }

    [Fact]
    public async Task Extract_WithIdentifiableData_ReturnsFields()
    {
        var pdf = TestPdf.WithLines(
            "Maria Souza",
            "maria.souza@example.com | (11) 98888-7777",
            "Desenvolvedora Backend");

        var response = await PostFile(pdf);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<ResumeExtractionResponse>(CancellationToken);
        Assert.Equal(new ResumeExtractionResponse("Maria Souza", "maria.souza@example.com", "(11) 98888-7777"), result);
    }

    [Fact]
    public async Task Extract_WithNothingIdentifiable_ReturnsNullFields()
    {
        var pdf = TestPdf.WithLines("Objetivo", "Vaga aberta em 2026", "Experiencia desde 2019");

        var response = await PostFile(pdf);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<ResumeExtractionResponse>(CancellationToken);
        Assert.Equal(new ResumeExtractionResponse(null, null, null), result);
    }

    [Fact]
    public async Task Extract_WithoutFile_ReturnsInvalidFile()
    {
        var form = new MultipartFormDataContent { { new StringContent("sem arquivo"), "note" } };

        var response = await _client.PostAsync("/api/resumes/extract", form, CancellationToken);

        await AssertInvalidFile(response, "Selecione um arquivo PDF.");
    }

    [Fact]
    public async Task Extract_WithNonPdfContent_ReturnsInvalidFile()
    {
        var response = await PostFile(Encoding.UTF8.GetBytes("isto e um texto qualquer"));

        await AssertInvalidFile(response, "O arquivo precisa ser um PDF.");
    }

    [Fact]
    public async Task Extract_WithEmptyFile_ReturnsInvalidFile()
    {
        var response = await PostFile([]);

        await AssertInvalidFile(response, "O arquivo precisa ser um PDF.");
    }

    [Fact]
    public async Task Extract_AboveSizeLimit_ReturnsInvalidFile()
    {
        var response = await PostFile(BytesWithPdfSignature(MaxFileSize + 1));

        await AssertInvalidFile(response, "O arquivo deve ter no máximo 5 MB.");
    }

    [Fact]
    public async Task Extract_AtSizeLimit_IsNotRejectedForSize()
    {
        var response = await PostFile(BytesWithPdfSignature(MaxFileSize));

        await AssertUnreadablePdf(response);
    }

    [Fact]
    public async Task Extract_WithCorruptedPdf_ReturnsUnprocessable()
    {
        var response = await PostFile(Encoding.ASCII.GetBytes("%PDF-1.7\nisto nao e um pdf de verdade"));

        await AssertUnreadablePdf(response);
    }

    [Fact]
    public async Task Extract_WithPdfWithoutText_ReturnsUnprocessable()
    {
        var response = await PostFile(TestPdf.WithLines());

        await AssertUnreadablePdf(response);
    }

    private static async Task AssertInvalidFile(HttpResponseMessage response, string expectedMessage)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync(CancellationToken);
        var problem = JsonSerializer.Deserialize<ValidationProblemDetails>(raw, JsonSerializerOptions.Web);
        Assert.NotNull(problem);
        Assert.Equal("Arquivo inválido.", problem.Title);
        Assert.True(problem.Errors.TryGetValue("file", out var messages), $"Resposta sem erro para 'file': {raw}");
        Assert.Equal(expectedMessage, Assert.Single(messages));
    }

    private static async Task AssertUnreadablePdf(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        Assert.Equal(UnreadablePdfTitle, problem?.Title);
    }
}
