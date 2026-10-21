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

export function useTelemetryUpdates() {
     const [latest, setLatest] = useState<LatestByDevice>({});
  const [connected, setConnected] = useState(false);

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
        setConnected(true);
      } catch (err) {
        console.error("Could not connect to telemetry hub", err);
        setConnected(false);
      }
    })();

    return () => {
      conn.off(MeasurementReceived, onMeasurement);
    };
  }, []);

  return { latest, connected };

}
