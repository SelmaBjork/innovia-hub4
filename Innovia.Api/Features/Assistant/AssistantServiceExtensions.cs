using System.Net.Http.Headers;
using Innovia.Api.Common.Auth;

namespace Innovia.Api.Features.Assistant;

public static class AssistantServiceExtensions
{
    public static IServiceCollection AddAssistantFeature(this IServiceCollection services)
    {
        services.AddHttpClient("openAi", (sp, client) =>
        {
            var key = sp.GetRequiredService<IConfiguration>().GetValue<string>("OpenAi:ApiKey")
            ?? throw new InvalidOperationException("OpenAi:ApiKey configuration is missing.");

            client.BaseAddress = new Uri("https://api.openai.com/v1/");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", key);
        });
        services.AddScoped<Ask.Handler>();
        services.AddScoped<Ask.Validator>();
        services.AddScoped<ResourceSearchTool>();

        return services;
    }

    public static IEndpointRouteBuilder MapAssistantEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/assistant")
            .WithTags("Assistant")
            .AddEndpointFilter<RequireCurrentUserFilter>();

        Ask.Endpoint.Map(group)
            .RequireAuthorization(AuthorizationPolicies.MemberOrAdmin);

        return group;
    }
};

