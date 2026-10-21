const IOT_API_URL = import.meta.env.VITE_IOT_API_URL ?? "http://localhost:5101";
const TENANT_ID =
    import.meta.env.VITE_IOT_TENANT_ID?? "95cfd1c4-0694-4ac8-be04-9c0bbcaf6a5c";

    export type IotDevice = {
        id: string;
        tenantId: string;
        roomId: string | null;
        model: string;
        serial: string;
        status: string;
    };

    export async function fetchIotDevices(): Promise<IotDevice[]> {
        const res = await fetch(`${IOT_API_URL}/api/tenants/${TENANT_ID}/devices` );
        if (!res.ok){
            throw new Error(`DeviceRegistry svarade ${res.status}`);
        }
        const devices: IotDevice[] = await res.json();
        return devices.sort((a,b) => a.serial.localeCompare(b.serial));
    }