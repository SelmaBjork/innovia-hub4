import {
    HubConnectionBuilder,
    HubConnectionState,
    LogLevel,
    type HubConnection,
}   from "@microsoft/signalr";

//IoT projektet , inte Innovia.Api)
const IOT_HUB_URL = import.meta.env.VITE_IOT_HUB_URL ?? "http://localhost:5103";
const TENANT_SLUG = import.meta.env.VITE_IOT_TENANT_SLUG ?? "innovia";

const JoinTenant = "JoinTenant";
export const MeasurementReceived = "measurementRecived";

export type RealtimeMeasurement = {
    tenantSlug: string;
    deviceId: string;
    type: string;
    value: number;
    time: string;
};

let connection: HubConnection | null = null;
let startPromise: Promise<void> | null = null;
let tenantJoined = false;

function buildConnection(): HubConnection {
    const conn = new HubConnectionBuilder()
    .withUrl(`${IOT_HUB_URL}/hub/telemetry`)
    .configureLogging(LogLevel.Information)
    .withAutomaticReconnect()
    .build();

    conn.onreconnecting((err) =>{
        console.warn("Telemetry hub connection lost, attempting to reconnect", err);
    });

     conn.onreconnected(async () => {
    if (tenantJoined) {
      try {
        await conn.invoke(JoinTenant, TENANT_SLUG);
      } catch (err) {
        console.error("Failed to rejoin telemetry tenant group", err);
      }
    }
  });

  conn.onclose((err) => {
    console.error("Telemetry hub connection closed permanently", err);
    startPromise = null;
  });

  return conn;
}

export function getTelemetryHubConnection(): HubConnection {
  if (!connection) {
    connection = buildConnection();
  }
  return connection;
}

export function ensureTelemetryStarted(conn: HubConnection): Promise<void> {
  if (conn.state === HubConnectionState.Connected) return Promise.resolve();
  if (!startPromise) {
    startPromise = conn.start().catch((err) => {
      startPromise = null;
      throw err;
    });
  }
  return startPromise;
}

export async function joinTelemetryTenant(conn: HubConnection) {
  await conn.invoke(JoinTenant, TENANT_SLUG);
  tenantJoined = true;
}
