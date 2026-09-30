using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace CadastroCurriculos.Api.Tests;

public class HealthEndpointTests
{
    private readonly HttpClient _client;

    public HealthEndpointTests(ApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Get_WhenDatabaseIsReachable_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        Assert.Equal("ok", body.GetProperty("status").GetString());
        Assert.Equal("connected", body.GetProperty("database").GetString());
    }
}
