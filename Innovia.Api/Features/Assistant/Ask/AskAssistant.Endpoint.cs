using Innovia.Api.Common.Result;

namespace Innovia.Api.Features.Assistant.Ask;

public static class Endpoint
{
    public static RouteHandlerBuilder Map (IEndpointRouteBuilder app)
    {
        return app.MapPost("/", async (
            Command command,
            Handler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(command, ct);
            return result.ToHttpResponse();
            
        }

        );
    }
}