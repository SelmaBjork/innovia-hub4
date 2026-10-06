import { useMutation} from "@tanstack/react-query";
import { assistantApi} from "../api/assistant";

export function useAskAssistant() {
return useMutation({
    mutationFn: (message: string) => assistantApi.ask(message),

});
}