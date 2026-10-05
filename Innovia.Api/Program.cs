using Innovia.Api.Features.Assistant;
using Innovia.Api.Common.Auth;
using Innovia.Api.Common.Database;
using Innovia.Api.Common.Database.Entities;
using Innovia.Api.Common.Database.Seed;
using Innovia.Api.Common.OpenApi;
using Innovia.Api.Features.Auth;
using Innovia.Api.Features.Availability;
using Innovia.Api.Features.Bookings;
using Innovia.Api.Features.Occupancy;
using Innovia.Api.Features.Realtime;
using Innovia.Api.Features.Resources;
using Innovia.Api.Features.ResourceTypes;
using Innovia.Api.Features.Users;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using System.Text.Json.Serialization;



var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
});

builder.Services.AddIdentityCore<ApplicationUser>(options =>
{
    options.Password.RequiredLength = 8;
})
.AddRoles<ApplicationRole>()
.AddEntityFrameworkStores<AppDbContext>()
.AddSignInManager()
.AddDefaultTokenProviders();

builder.Services.AddProblemDetails();

builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer<BearerSecuritySchemeTransformer>();
    options.CreateSchemaReferenceId = jsonTypeInfo =>
    {
        var type = jsonTypeInfo.Type;
        var defaultId = Microsoft.AspNetCore.OpenApi.OpenApiOptions.CreateDefaultSchemaReferenceId(jsonTypeInfo);
        return type.FullName?.StartsWith("Innovia.Api.", StringComparison.Ordinal) == true
            ? type.FullName.Replace("Innovia.Api.", "").Replace('.', '_').Replace('+', '_')
            : defaultId;
    };
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddCors(options =>
{
    var frontendOrigin = builder.Configuration["Cors:FrontendOrigin"] ?? "http://localhost:5173";
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(frontendOrigin)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

builder.Services.AddSignalR(options => 
    options.EnableDetailedErrors = builder.Environment.IsDevelopment());

builder.Services.AddAppAuthentication(builder.Configuration);
builder.Services.AddSeeders();

builder.Services.AddAuthFeatures();
builder.Services.AddBookingsFeature();
builder.Services.AddResourcesFeature();
builder.Services.AddResourceTypesFeature();
builder.Services.AddAvailabilityFeature();
builder.Services.AddOccupancyFeature();
builder.Services.AddUsersFeature();
builder.Services.AddAssistantFeature();

var app = builder.Build();

app.UseForwardedHeaders();

await app.ApplyMigrationsAsync();
await app.SeedAppDataAsync();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
    app.MapScalarApiReference().AllowAnonymous();
}

app.UseStatusCodePages();

app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapHub<BookingHub>("/hubs/bookings").RequireAuthorization();
app.MapHub<ResourceHub>("/hubs/resources").RequireAuthorization();

app.MapAuthEndpoints();
app.MapBookingsEndpoints();
app.MapResourcesEndpoints();
app.MapResourceTypesEndpoints();
app.MapAvailabilityEndpoints();
app.MapOccupancyEndpoints();
app.MapUsersEndpoints();
app.MapAssistantEndpoints();


app.Run();

public partial class Program { }
