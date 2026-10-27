import { useEffect, useState } from "react";
import {
  ensureTelemetryStarted,
  getTelemetryHubConnection,
  joinTelemetryTenant,
  MeasurementReceived,
  type RealtimeMeasurement,
} from "../lib/telemetryHubConnection";

export type LatestReading = {
  temperature?: number;
  co2?: number;
  time: string;
};

export type LatestByDevice = Record<string, LatestReading>;
export type TelemetryStatus = "connecting" | "live" | "offline";

export function useTelemetryUpdates() {
  const [latest, setLatest] = useState<LatestByDevice>({});
  const [status, setStatus] = useState<TelemetryStatus>("connecting");

  useEffect(() => {
    const conn = getTelemetryHubConnection();

    function onMeasurement(m: RealtimeMeasurement) {
      setLatest((prev) => {
        const next: LatestReading = { ...prev[m.deviceId], time: m.time };
        if (m.type === "temperature") next.temperature = m.value;
        else if (m.type === "co2") next.co2 = m.value;
        return { ...prev, [m.deviceId]: next };
      });
    }

    conn.on(MeasurementReceived, onMeasurement);

    (async () => {
      try {
        await ensureTelemetryStarted(conn);
        await joinTelemetryTenant(conn);
        setStatus("live");
      } catch (err) {
        console.warn("Telemetry hub is offline", err);
        setStatus("offline");
      }
    })();

    return () => {
      conn.off(MeasurementReceived, onMeasurement);
    };
  }, []);

  return { latest, status };
}