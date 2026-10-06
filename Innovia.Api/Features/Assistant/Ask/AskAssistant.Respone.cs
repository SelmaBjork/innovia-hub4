namespace Innovia.Api.Features.Assistant.Ask;

public sealed record Suggestion(
    Guid ResourceId,
    string ResourceName,
    DateTimeOffset StartsAt,
    DateTimeOffset EndsAt
);

public sealed record Response (string reply, IReadOnlyList<Suggestion> Suggestions);