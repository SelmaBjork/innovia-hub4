using Innovia.Api.Common.Database;
using Innovia.Api.Common.Database.Entities;
using Innovia.Api.Common.Time;
using Microsoft.EntityFrameworkCore;
using AvailabilityCommand = Innovia.Api.Features.Availability.GetResourceAvailability.Command;
using AvailabilityHandler = Innovia.Api.Features.Availability.GetResourceAvailability.Handler;

namespace Innovia.Api.Features.Assistant;

public sealed record FoundSlot(Guid ResourceId, string ResourceName, DateTimeOffset StartUtc, DateTimeOffset EndUtc);

public sealed class ResourceSearchTool
{
    private readonly AppDbContext _context;
    private readonly AvailabilityHandler _availability;

    public List<FoundSlot> FoundSlots { get; } = new();

    public ResourceSearchTool(AppDbContext context, AvailabilityHandler availability)
    {
        _context = context;
        _availability = availability;
    }

    public async Task<object> SearchAsync(
        string resurstyp,
        DateOnly datum,
        TimeOnly? franTid,
        TimeOnly? tillTid,
        CancellationToken ct)
    {
        var type = await _context.ResourceTypes
            .AsNoTracking()
            .Where(t => EF.Functions.ILike(t.Name, $"%{resurstyp}%"))
            .Select(t => new { t.Id, t.Name })
            .FirstOrDefaultAsync(ct);

        if (type is null)
        {
            var names = await _context.ResourceTypes
                .AsNoTracking()
                .Select(t => t.Name)
                .ToListAsync(ct);

            return new
            {
                fel = $"Hittade ingen resurstyp som matchar '{resurstyp}'.",
                tillgangligaTyper = names
            };
        }

        var resources = await _context.Resources
            .AsNoTracking()
            .Where(r => r.ResourceTypeId == type.Id && r.Status == ResourceStatus.Online)
            .OrderBy(r => r.Name)
            .Select(r => new { r.Id, r.Name, r.Description })
            .ToListAsync(ct);

        var results = new List<object>();

        foreach (var resource in resources)
        {
            var availability = await _availability.HandleAsync(
                new AvailabilityCommand(resource.Id, datum, datum), ct);

            if (!availability.IsSuccess)
                continue;

            var freeSlots = availability.Value!.Slots
                .Where(s => s.IsAvailable)
                .Select(s => new
                {
                    s.StartUtc,
                    s.EndUtc,
                    StartLocal = ToLocalTime(s.StartUtc),
                    EndLocal = ToLocalTime(s.EndUtc)
                })
                .Where(s => (franTid is null || s.StartLocal >= franTid)
                         && (tillTid is null || s.EndLocal <= tillTid))
                .Select(s => new
                {
                    start = s.StartLocal.ToString("HH:mm"),
                    slut = s.EndLocal.ToString("HH:mm"),
                    startUtc = s.StartUtc,
                    slutUtc = s.EndUtc
                })
                .ToList();

            if (freeSlots.Count == 0)
                continue;

            foreach (var slot in freeSlots)
                FoundSlots.Add(new FoundSlot(resource.Id, resource.Name, slot.startUtc, slot.slutUtc));

            results.Add(new
            {
                resursId = resource.Id,
                namn = resource.Name,
                beskrivning = resource.Description,
                ledigaTider = freeSlots
            });
        }

        return new
        {
            datum = datum.ToString("yyyy-MM-dd"),
            resurstyp = type.Name,
            resurser = results
        };
    }

    private static TimeOnly ToLocalTime(DateTimeOffset utc) =>
        TimeOnly.FromDateTime(TimeZoneInfo.ConvertTime(utc, SwedenTimeZone.Instance).DateTime);
}