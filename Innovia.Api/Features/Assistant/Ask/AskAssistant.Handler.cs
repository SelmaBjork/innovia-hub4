using System.Globalization;
using System.Text;
using System.Text.Json;
using Innovia.Api.Common.Errors;
using Innovia.Api.Common.Result;
using Innovia.Api.Common.Time;

namespace Innovia.Api.Features.Assistant.Ask;

public sealed class Handler
{
    private const string Model = "gpt-5.5";
    private const int MaxToolRounds = 4;

       private static readonly object[] Tools =
    [
        new
        {
            type = "function",
            name = "sokLedigaResurser",
            description = "Söker lediga tider för en typ av resurs ett visst datum. Returnerar resurser med beskrivning och lediga tidsluckor i svensk tid.",
            parameters = new
            {
                type = "object",
                properties = new
                {
                    resurstyp = new { type = "string", description = "Namnet på resurstypen, t.ex. Mötesrum eller Skrivbord." },
                    datum = new { type = "string", description = "Datum i formatet YYYY-MM-DD." },
                    franTid = new { type = "string", description = "Tidigaste starttid, HH:mm. Utelämna om användaren inte angett någon." },
                    tillTid = new { type = "string", description = "Senaste sluttid, HH:mm. Utelämna om användaren inte angett någon." }
                },
                required = new[] { "resurstyp", "datum" }
            }
        },
        new
        {
            type = "function",
            name = "foreslaBokning",
            description = "Registrerar ett bokningsförslag som användaren kan boka med ett klick. Anropa en gång per alternativ du föreslår, efter att du sökt. Kopiera resursId, startUtc och slutUtc exakt som de står i sökresultatet.",
            parameters = new
            {
                type = "object",
                properties = new
                {
                    resursId = new { type = "string", description = "resursId från sökresultatet." },
                    startUtc = new { type = "string", description = "startUtc från sökresultatet, exakt som den står." },
                    slutUtc = new { type = "string", description = "slutUtc från sökresultatet, exakt som den står." }
                },
                required = new[] { "resursId", "startUtc", "slutUtc" }
            }
        }
    ];

    private readonly IHttpClientFactory _factory;
    private readonly ResourceSearchTool _searchTool;
    private readonly ILogger<Handler> _logger;

    public Handler(IHttpClientFactory factory, ResourceSearchTool searchTool, ILogger<Handler> logger)
    {
        _factory = factory;
        _searchTool = searchTool;
        _logger = logger;
    }

    public async Task<Result<Response>> HandleAsync(Command command, CancellationToken ct)
    {
        var nowLocal = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, SwedenTimeZone.Instance);

        var instructions =
            "Du är bokningsassistent för Innovia Hub. Svara alltid på svenska, kort och vänligt. " +
            $"Idag är det {nowLocal.DayOfWeek} {nowLocal:yyyy-MM-dd}, klockan {nowLocal:HH:mm} (svensk tid). " +
            "Du söker lediga resurser med verktyget sokLedigaResurser. Räkna om uttryck som 'på torsdag' eller 'imorgon' till ett riktigt datum. " +
            "Beskrivningen av en resurs kan innehålla antal platser, använd den för att välja rum som är stora nog. " +
                       "Du kan inte boka själv. Välj 1–3 alternativ från sökresultatet och anropa foreslaBokning en gång för varje, med resursId, startUtc och slutUtc exakt som i resultatet. " +
            "Skriv sedan ett kort svar som nämner varje alternativs namn och tid i svensk tid, och säg att användaren bokar med knappen. " +
            "Hitta aldrig på resurser eller tider som inte kommit från verktyget. " +
            "Om frågan inte handlar om Innovia Hubs resurser, svara kort att du bara hjälper till med bokningar.";

        var suggestions = new List<Suggestion>();
        object input = new object[] { new { role = "user", content = command.Message } };
        string? previousResponseId = null;

        for (var round = 0; round <= MaxToolRounds; round++)
        {
            var body = new Dictionary<string, object?>
            {
                ["model"] = Model,
                ["instructions"] = instructions,
                ["input"] = input,
                ["tools"] = Tools
            };
            if (previousResponseId is not null)
                body["previous_response_id"] = previousResponseId;

            var (ok, raw) = await SendAsync(body, ct);
            if (!ok)
                return Result<Response>.Fail(Error.Failure("Assistenten kunde inte svara just nu. Försök igen om en stund."));

            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            previousResponseId = root.GetProperty("id").GetString();

            var toolOutputs = new List<object>();
            var reply = new StringBuilder();

            foreach (var item in root.GetProperty("output").EnumerateArray())
            {
                if (!item.TryGetProperty("type", out var typeProp))
                    continue;

                switch (typeProp.GetString())
                {
                    case "message":
                        {
                            foreach (var part in item.GetProperty("content").EnumerateArray())
                            {
                                if (part.TryGetProperty("text", out var text))
                                    reply.Append(text.GetString());
                            }
                            break;
                        }
                    case "function_call":
                        {
                            var name = item.GetProperty("name").GetString() ?? "";
                            var arguments = item.GetProperty("arguments").GetString() ?? "{}";
                            var callId = item.GetProperty("call_id").GetString();

                            _logger.LogInformation("Assistenten kör verktyget {Tool} med {Arguments}", name, arguments);

                            var output = name == "foreslaBokning"
        ? RegisterSuggestion(arguments, suggestions)
        : await RunToolAsync(name, arguments, ct);
                            toolOutputs.Add(new { type = "function_call_output", call_id = callId, output });
                            break;
                        }
                }
            }

            if (toolOutputs.Count == 0)
            {
                if (reply.Length == 0)
                {
                    _logger.LogError("OpenAI-svaret saknade text: {Body}", raw);
                    return Result<Response>.Fail(Error.Failure("Assistenten gav inget svar. Försök igen."));
                }

                return Result<Response>.Ok(new Response(reply.ToString(), suggestions));
            }
            input = toolOutputs;
        }

        _logger.LogError("Assistenten nådde maxgränsen på {Max} verktygsrundor", MaxToolRounds);
        return Result<Response>.Fail(Error.Failure("Assistenten kunde inte slutföra sökningen. Försök igen."));
    }
    private async Task<(bool Ok, string Raw)> SendAsync(object body, CancellationToken ct)
    {
        var http = _factory.CreateClient("openAi");
        var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var response = await http.PostAsync("responses", content, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            _logger.LogError("OpenAI svarade {Status}: {Body}", (int)response.StatusCode, raw);

        return (response.IsSuccessStatusCode, raw);
    }

    private async Task<string> RunToolAsync(string name, string argumentsJson, CancellationToken ct)
    {
        if (name != "sokLedigaResurser")
            return JsonSerializer.Serialize(new { fel = $"Okänd funktion '{name}'." });

        using var args = JsonDocument.Parse(argumentsJson);
        var a = args.RootElement;

        var resurstyp = a.TryGetProperty("resurstyp", out var rt) ? rt.GetString() : null;
        var datumText = a.TryGetProperty("datum", out var dt) ? dt.GetString() : null;

        if (string.IsNullOrWhiteSpace(resurstyp))
            return JsonSerializer.Serialize(new { fel = "resurstyp saknas." });

        if (!DateOnly.TryParseExact(datumText, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var datum))
            return JsonSerializer.Serialize(new { fel = "datum måste anges som YYYY-MM-DD." });

        var result = await _searchTool.SearchAsync(
            resurstyp, datum, ParseTime(a, "franTid"), ParseTime(a, "tillTid"), ct);

        return JsonSerializer.Serialize(result);
    }

    private string RegisterSuggestion(string argumentsJson, List<Suggestion> suggestions)
    {
        using var args = JsonDocument.Parse(argumentsJson);
        var a = args.RootElement;

        var idText = a.TryGetProperty("resursId", out var id) ? id.GetString() : null;
        var startText = a.TryGetProperty("startUtc", out var s) ? s.GetString() : null;
        var endText = a.TryGetProperty("slutUtc", out var e) ? e.GetString() : null;

        if (!Guid.TryParse(idText, out var resourceId)
        || !DateTimeOffset.TryParse(startText, CultureInfo.InvariantCulture, DateTimeStyles.None, out var start)
        || !DateTimeOffset.TryParse(endText, CultureInfo.InvariantCulture, DateTimeStyles.None, out var end))
        {
            return JsonSerializer.Serialize(new { fel = "Ogiltigt förslag. resursId, startUtc och slutUtc måste vara exakt som i sökresultatet." });
        }
        var match = _searchTool.FoundSlots.FirstOrDefault(f =>
        f.ResourceId == resourceId && f.StartUtc == start && f.EndUtc == end );

        if (match is null)
        {
            return JsonSerializer.Serialize(new { fel = "Den tiden fanns inte i sökresultatet. Föreslå bara tider som sökningen gav." });
        }
         if (!suggestions.Any(x => x.ResourceId == match.ResourceId && x.StartsAt == match.StartUtc))
        suggestions.Add(new Suggestion(match.ResourceId, match.ResourceName, match.StartUtc, match.EndUtc));

    return JsonSerializer.Serialize(new { ok = true });
    }

    
    private static TimeOnly? ParseTime(JsonElement args, string property)
    {
        if (!args.TryGetProperty(property, out var p) || p.ValueKind != JsonValueKind.String)
            return null;

        return TimeOnly.TryParseExact(p.GetString(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var t)
            ? t
            : null;
    }
}
