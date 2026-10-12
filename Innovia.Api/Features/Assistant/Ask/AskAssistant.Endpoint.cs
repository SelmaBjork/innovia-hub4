using Innovia.Api.Common.Result;

namespace Innovia.Api.Features.Assistant.Ask;

public static class Endpoint
{
    public static RouteHandlerBuilder Map (IEndpointRouteBuilder app)
    {
        return app.MapPost("/", async (
            Command command,
            Handler handler,
            Validator validator,
            CancellationToken ct) =>
        {
            
            var validation = validator.Validate(command);
            if (!validation.IsValid)
            
                return validation.ToProblemResult();

            var result = await handler.HandleAsync(command, ct);
            return result.ToHttpResponse();
        
            
        });

        
    }
}