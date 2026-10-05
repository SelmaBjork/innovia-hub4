using System.Text;
using System.Text.Json;
using Innovia.Api.Common.Result;
using Microsoft.AspNetCore.Identity;

namespace Innovia.Api.Features.Assistant.Ask;

public sealed class Handler
{
    private readonly IHttpClientFactory _factory;

    public Handler (IHttpClientFactory factory)

    {
        _factory = factory;
    }

    public async Task<Result<Response>>HandleAsync(Command command, CancellationToken ct)
    {
        var http = _factory.CreateClient("openAi");
        var body = new
        {
            model = "gpt-5.5",
            input = new object[]
            {
                new {role = "system", content = "Du är en bokningsassistent" },
                new {role = "user", content = command.Message }
            }
        };

        var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var httpResponse = await http.PostAsync("responses", content, ct);
        var rawResponse = await httpResponse.Content.ReadAsStringAsync(ct);

        if (!httpResponse.IsSuccessStatusCode)
        {
           throw new InvalidOperationException($"AI-anropet misslyckades: {rawResponse}");
        }

        using var doc = JsonDocument.Parse(rawResponse);

        foreach(var item in doc.RootElement.GetProperty("output").EnumerateArray())
        {
            if (item.TryGetProperty("type", out var type)&& type.GetString() == "message")
            {
                var text = item.GetProperty("content")[0].GetProperty("text").GetString()??"";
                return Result<Response>.Ok(new Response(text));
            }
        }
        return Result<Response>.Ok(new Response (""));
    }
}
