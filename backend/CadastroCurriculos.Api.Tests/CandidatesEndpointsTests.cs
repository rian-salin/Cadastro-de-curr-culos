using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CadastroCurriculos.Api.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace CadastroCurriculos.Api.Tests;

public class CandidatesEndpointsTests
{
    private readonly HttpClient _client;

    public CandidatesEndpointsTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    private static CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    // O banco é compartilhado entre os testes e o e-mail tem índice único.
    private static string UniqueEmail() => $"candidate-{Guid.NewGuid():N}@example.com";

    private Task<HttpResponseMessage> PostCandidate(object payload) =>
        _client.PostAsJsonAsync("/api/candidates", payload, CancellationToken);

    private async Task<CandidateResponse> CreateCandidate(object payload)
    {
        var response = await PostCandidate(payload);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var candidate = await response.Content.ReadFromJsonAsync<CandidateResponse>(CancellationToken);
        Assert.NotNull(candidate);
        return candidate;
    }

    [Fact]
    public async Task Post_WithValidData_ReturnsCreatedWithNormalizedFields()
    {
        var email = UniqueEmail();

        var response = await PostCandidate(new
        {
            id = 999999,
            createdAt = "2000-01-01T00:00:00+00:00",
            fullName = "  Maria Souza  ",
            email = $"  {email.ToUpperInvariant()} ",
            phone = " +55 (11) 98888-7777 ",
            areaOfInterest = "   ",
            professionalSummary = "",
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<CandidateResponse>(CancellationToken);
        Assert.NotNull(created);
        // Location relativo (sem esquema/host): atrás do Nginx (porta 3000) ou do proxy do
        // Vite, um Location absoluto sairia com o host errado (Nginx derruba a porta do
        // $host) ou com uma origem diferente da que respondeu.
        Assert.Equal($"/api/candidates/{created.Id}", response.Headers.Location?.OriginalString);
        Assert.NotEqual(999999, created.Id);
        Assert.True(created.CreatedAt > DateTimeOffset.UtcNow.AddMinutes(-5));
        Assert.Equal("Maria Souza", created.FullName);
        Assert.Equal(email, created.Email);
        Assert.Equal("+55 (11) 98888-7777", created.Phone);
        Assert.Null(created.AreaOfInterest);
        Assert.Null(created.ProfessionalSummary);

        var fetched = await _client.GetFromJsonAsync<CandidateResponse>(response.Headers.Location, CancellationToken);
        Assert.Equal(created, fetched);
    }

    [Fact]
    public async Task GetById_WhenCandidateDoesNotExist_ReturnsNotFound()
    {
        var response = await _client.GetAsync("/api/candidates/999999", CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(CancellationToken);
        Assert.Equal("Candidato não encontrado.", problem?.Title);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Post_WithoutFullName_ReturnsBadRequest(string? fullName)
    {
        var response = await PostCandidate(new { fullName, email = UniqueEmail() });

        var problem = await AssertValidationError(response, HttpStatusCode.BadRequest, "fullName", "Informe o nome completo.");
        Assert.Equal("Um ou mais campos são inválidos.", problem.Title);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public async Task Post_WithoutEmail_ReturnsBadRequest(string? email)
    {
        var response = await PostCandidate(new { fullName = "Maria Souza", email });

        await AssertValidationError(response, HttpStatusCode.BadRequest, "email", "Informe o e-mail.");
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("a@b")]
    [InlineData("a b@c.com")]
    [InlineData("a@b@c.com")]
    public async Task Post_WithInvalidEmail_ReturnsBadRequest(string email)
    {
        var response = await PostCandidate(new { fullName = "Maria Souza", email });

        await AssertValidationError(response, HttpStatusCode.BadRequest, "email", "Informe um e-mail válido.");
    }

    [Theory]
    [InlineData("11 9999-abcd")]
    [InlineData("tel: 1199990000")]
    public async Task Post_WithInvalidPhone_ReturnsBadRequest(string phone)
    {
        var response = await PostCandidate(new { fullName = "Maria Souza", email = UniqueEmail(), phone });

        await AssertValidationError(
            response,
            HttpStatusCode.BadRequest,
            "phone",
            "O telefone deve conter apenas números, espaços e os caracteres + ( ) -.");
    }

    [Theory]
    [InlineData("fullName", 151, "O nome deve ter no máximo 150 caracteres.")]
    [InlineData("phone", 21, "O telefone deve ter no máximo 20 caracteres.")]
    [InlineData("areaOfInterest", 101, "A área de interesse deve ter no máximo 100 caracteres.")]
    [InlineData("professionalSummary", 2001, "O resumo profissional deve ter no máximo 2000 caracteres.")]
    public async Task Post_WithFieldTooLong_ReturnsBadRequest(string field, int length, string expectedMessage)
    {
        // Dígitos servem para todos os campos, inclusive o telefone, então só o tamanho falha.
        var payload = new Dictionary<string, string>
        {
            ["fullName"] = "Maria Souza",
            ["email"] = UniqueEmail(),
            [field] = new string('1', length),
        };

        var response = await PostCandidate(payload);

        await AssertValidationError(response, HttpStatusCode.BadRequest, field, expectedMessage);
    }

    [Fact]
    public async Task Post_WithMaliciouslyLongInvalidEmail_ReturnsBadRequestQuickly()
    {
        // Regex com backtracking pode levar segundos (ou estourar o timeout padrão de 2s
        // e virar 500) num e-mail inválido longo o bastante. A validação precisa ser O(n).
        var email = "a@" + new string('.', 200_000) + "@";

        var stopwatch = Stopwatch.StartNew();
        var response = await PostCandidate(new { fullName = "Maria Souza", email });
        stopwatch.Stop();

        await AssertValidationError(response, HttpStatusCode.BadRequest, "email", "O e-mail deve ter no máximo 254 caracteres.");
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(1), $"Validação demorou {stopwatch.Elapsed}.");
    }

    [Fact]
    public async Task Post_WithEmailTooLong_ReturnsBadRequest()
    {
        var email = new string('a', 243) + "@example.com";

        var response = await PostCandidate(new { fullName = "Maria Souza", email });

        await AssertValidationError(response, HttpStatusCode.BadRequest, "email", "O e-mail deve ter no máximo 254 caracteres.");
    }

    [Fact]
    public async Task Post_WithFieldsAtMaxLength_ReturnsCreatedAndRoundTrips()
    {
        var email = new string('a', 210) + Guid.NewGuid().ToString("N") + "@example.com";

        var created = await CreateCandidate(new
        {
            fullName = new string('é', 150),
            email,
            phone = new string('9', 20),
            areaOfInterest = new string('ç', 100),
            professionalSummary = new string('ã', 2000),
        });

        Assert.Equal(254, created.Email.Length);
        Assert.Equal(new string('é', 150), created.FullName);
        var fetched = await _client.GetFromJsonAsync<CandidateResponse>($"/api/candidates/{created.Id}", CancellationToken);
        Assert.Equal(created, fetched);
    }

    [Fact]
    public async Task Post_WithDuplicateEmail_ReturnsConflict()
    {
        var email = UniqueEmail();
        await CreateCandidate(new { fullName = "Maria Souza", email });

        var response = await PostCandidate(new { fullName = "Maria S.", email = $" {email.ToUpperInvariant()} " });

        var problem = await AssertValidationError(response, HttpStatusCode.Conflict, "email", "Já existe um candidato com este e-mail.");
        Assert.Equal("Candidato já cadastrado.", problem.Title);
    }

    [Fact]
    public async Task GetAll_ReturnsSummariesNewestFirst()
    {
        var older = await CreateCandidate(new { fullName = "Primeiro", email = UniqueEmail(), phone = "11 9999-0000", professionalSummary = "Resumo" });
        var newer = await CreateCandidate(new { fullName = "Segundo", email = UniqueEmail() });

        var response = await _client.GetAsync("/api/candidates", CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var items = await response.Content.ReadFromJsonAsync<JsonElement[]>(CancellationToken);
        Assert.NotNull(items);
        var ids = items.Select(item => item.GetProperty("id").GetInt32()).ToList();
        Assert.Contains(older.Id, ids);
        Assert.Contains(newer.Id, ids);
        Assert.True(ids.IndexOf(newer.Id) < ids.IndexOf(older.Id), "O candidato mais recente deve vir primeiro.");

        var olderItem = items.Single(item => item.GetProperty("id").GetInt32() == older.Id);
        Assert.Equal("Primeiro", olderItem.GetProperty("fullName").GetString());
        Assert.Equal(older.Email, olderItem.GetProperty("email").GetString());
        Assert.False(olderItem.TryGetProperty("phone", out _));
        Assert.False(olderItem.TryGetProperty("professionalSummary", out _));
    }

    private static async Task<ValidationProblemDetails> AssertValidationError(
        HttpResponseMessage response, HttpStatusCode expectedStatus, string field, string expectedMessage)
    {
        Assert.Equal(expectedStatus, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var raw = await response.Content.ReadAsStringAsync(CancellationToken);
        var problem = JsonSerializer.Deserialize<ValidationProblemDetails>(raw, JsonSerializerOptions.Web);
        Assert.NotNull(problem);
        Assert.True(problem.Errors.TryGetValue(field, out var messages), $"Resposta sem erro para '{field}': {raw}");
        Assert.Contains(expectedMessage, messages);
        return problem;
    }
}
