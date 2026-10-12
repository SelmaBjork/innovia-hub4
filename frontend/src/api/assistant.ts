import { api } from "./client";

export type AssistantSuggestion = {
  resourceId: string;
  resourceName: string;
  startsAt: string;
  endsAt: string;
};

export type AssistantReply = {
  reply: string;
  suggestions: AssistantSuggestion[];
};

export const assistantApi = {
  ask: (message: string) => api.post<AssistantReply>("/assistant", { message }),
};