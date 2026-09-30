using System.Net;
using System.Net.Http.Json;
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
        Assert.Equal($"/api/candidates/{created.Id}", response.Headers.Location?.AbsolutePath);
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
}
