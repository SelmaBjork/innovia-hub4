import { useMemo, useState } from "react";
import type { Resource, ResourceType } from "../../api/types";
import { BookingFlowModal } from "./BookingFlowModal";
import { useResources, useResourceTypes } from "../../hooks/useResources";
import { useResourcesAvailability } from "../../hooks/useResourcesAvailability";
import { todayAvailabilitySummary } from "../../lib/availability";
import { todayIso } from "../../lib/date";
import { useResourceStatusUpdates } from "../../hooks/useResourceStatusUpdates";
import { useResourcesBookingUpdates } from "../../hooks/useResourceBookingUpdates";
import { AssistantPanel } from "../../components/assistant/AssistantPanel";

export function ResourcesPage() {
  useResourceStatusUpdates();

  const [flow, setFlow] = useState<ResourceType | null>(null);

  const resourcesQuery = useResources();
  const typesQuery = useResourceTypes();

  const resources = resourcesQuery.data ?? [];
  const types = typesQuery.data ?? [];

  const resourcesByType = useMemo(() => {
    const map = new Map<string, Resource[]>();
    for (const r of resourcesQuery.data ?? []) {
      if (r.status !== "Online") continue;
      const list = map.get(r.resourceTypeId) ?? [];
      list.push(r);
      map.set(r.resourceTypeId, list);
    }
    return map;
  }, [resourcesQuery.data]);

  const today = todayIso();
  const onlineResourceIds = resources.filter((r) => r.status === "Online").map((r) => r.id);
  const {
    byResourceId,
    closedForRestOfTodayByResourceId,
    isLoading: availabilityLoading,
  } = useResourcesAvailability(onlineResourceIds, today, today);
  useResourcesBookingUpdates(onlineResourceIds);

  const loading = resourcesQuery.isLoading || typesQuery.isLoading;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Resurser</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Välj en resurstyp för att se lediga tider och boka.
      </p>

      {loading && <p className="text-gray-500">Laddar...</p>}
      {!loading && types.length === 0 && <p className="text-gray-500">Inga resurstyper finns.</p>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
        {types.map((type) => {
          const typeResources = resourcesByType.get(type.id) ?? [];
          const { availableCount, totalCount, closedForRestOfToday } = todayAvailabilitySummary(
            typeResources.map((r) => r.id),
            byResourceId,
            closedForRestOfTodayByResourceId
          );
          const offlineCount = resources.filter(
            (r) => r.resourceTypeId === type.id && r.status !== "Online"
          ).length;
          const bookable = typeResources.length > 0;

          return (
            <button
              key={type.id}
              onClick={() => bookable && setFlow(type)}
              disabled={!bookable}
              className="text-left rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 dark:disabled:hover:border-gray-800"
            >
              <h2 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{type.name}</h2>

              {!bookable && (
                <p className="text-sm text-gray-400">Inga resurser tillgängliga</p>
              )}

              {bookable && availabilityLoading && (
                <p className="text-sm text-gray-400">Laddar...</p>
              )}

              {bookable && !availabilityLoading && (
                <>
                  {availableCount === 0 ? (
                    <p className="text-sm text-gray-400">
                      {closedForRestOfToday ? "Stängt för idag" : "Fullbokat idag"}
                    </p>
                  ) : (
                    <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      {availableCount}
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                        {" "}
                        / {totalCount} lediga idag
                      </span>
                    </p>
                  )}
                  {offlineCount > 0 && (
                    <p className="text-xs text-gray-400 mt-1">{offlineCount} otillgängliga</p>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
      <AssistantPanel/>
      </div>

      {flow && (
        <BookingFlowModal
          resourceType={flow}
          resources={resourcesByType.get(flow.id) ?? []}
          initialDate={today}
          onClose={() => setFlow(null)}
        />
      )}
      </div>
  );
}


