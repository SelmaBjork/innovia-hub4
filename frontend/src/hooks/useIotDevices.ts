import { useQuery} from "@tanstack/react-query";
import {fetchIotDevices }from "../api/iotDevices";

export function useIotDevices() {
    return useQuery({
        queryKey: ["iotDevices"],
        queryFn: fetchIotDevices,
        retry: 1,
    });
}