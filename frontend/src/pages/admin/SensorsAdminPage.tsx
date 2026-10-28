import { useIotDevices } from "../../hooks/useIotDevices";
import { useTelemetryUpdates, type LatestReading } from "../../hooks/useTelemetryUpdates";
import type { IotDevice } from "../../api/iotDevices";

// Färg på CO₂-värdet: grönt = bra luft, gult = vädra snart, rött = dålig luft
function co2Class(ppm?: number) {
  if (ppm === undefined) return "text-gray-400";
  if (ppm < 1000) return "text-green-600 dark:text-green-400";
  if (ppm < 1400) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function formatTime(iso?: string) {
  if (!iso) return "Väntar på data…";
  return new Date(iso).toLocaleTimeString("sv-SE");
}

function SensorCard({ device, reading }: { device: IotDevice; reading?: LatestReading }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{device.serial}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{device.model}</p>
        </div>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
          {device.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Temperatur</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {reading?.temperature !== undefined ? `${reading.temperature.toFixed(1)} °C` : "–"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">CO₂</p>
          <p className={`text-xl font-semibold ${co2Class(reading?.co2)}`}>
            {reading?.co2 !== undefined ? `${Math.round(reading.co2)} ppm` : "–"}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Senast: {formatTime(reading?.time)}
      </p>
    </div>
  );
}

export function SensorsAdminPage() {
  const { data: devices, isLoading, isError, refetch } = useIotDevices(); 
  const { latest, status } = useTelemetryUpdates();                 

  return (
    <div>
      <div className="sticky top-14 z-10 -mx-4 px-4 bg-gray-50 dark:bg-gray-950 pt-4 pb-3 mb-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Sensorer</h1>
                    <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              status === "live"
                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                : status === "offline"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {status === "live" ? "● Live" : status === "offline" ? "Offline" : "Ansluter…"}
          </span>
        </div>
        {devices && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {devices.length} enheter registrerade i DeviceRegistry
          </p>
        )}
      </div>

      {isLoading && <p className="text-gray-500">Laddar sensorer...</p>}

           {isError && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            IoT-enheterna är offline just nu
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
            Sensorservern kan inte nås. Bokningar och övriga delar av Innovia Hub fungerar som vanligt.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 text-sm font-medium text-amber-800 underline dark:text-amber-300"
          >
            Försök igen
          </button>
        </div>
      )}

        {devices && (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {devices.map((d) => (
            <SensorCard key={d.id} device={d} reading={latest[d.id]} />
          ))}
        </div>
      )}
    </div>
  );
}