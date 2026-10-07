import { useState} from "react";
import { ApiError} from "../../api/client";
import type { AssistantSuggestion } from "../../api/assistant";
import { useAskAssistant}from "../../hooks/useAssistant";
import { useCreateBooking} from "../../hooks/useBookingMutations";
import { formatTime} from "../../lib/date";

type Exchange = {
    question: string;
    reply: string;
    suggestions: AssistantSuggestion[];
}

function suggestionKey(s: AssistantSuggestion) {
    return `${s.resourceId} |${s.startsAt} |${s.endsAt}`;
}

export function AssistantPanel() {
    const [text, setText] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const askMutation = useAskAssistant();
  const bookMutation = useCreateBooking();

  function handleSend() {
    const message = text.trim();
    if (!message || askMutation.isPending) return;
    setError(null);
    askMutation.mutate(message, {
      onSuccess: (data) => {
        setExchanges((prev) => [
          ...prev,
          { question: message, reply: data.reply, suggestions: data.suggestions },
        ]);
        setText("");
      },
      onError: (err) =>
        setError(err instanceof ApiError ? err.message : "Kunde inte nå assistenten"),
    });
  }
  function handleBook(s: AssistantSuggestion) {
    setError(null);
    bookMutation.mutate(
      { resourceId: s.resourceId, startsAt: s.startsAt, endsAt: s.endsAt },
      {
        onSuccess: () => setBooked((prev) => new Set(prev).add(suggestionKey(s))),
        onError: (err) => setError(err instanceof ApiError ? err.message : "Kunde inte boka"),
      }
    );
  }
return(
    <aside className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <h2 className="font-medium text-gray-900 dark:text-gray-100 mb-1">Bokningsassistent</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Skriv vad du behöver, till exempel "Mötesrum i morgon klockan 14".
      </p>

        <div className="space-y-4 mb-3 max-h-96 overflow-y-auto">
        {exchanges.map((ex, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto max-w-[85%] rounded-lg bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
              {ex.question}
            </p>
            <p className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
              {ex.reply}
            </p>
            {ex.suggestions.map((s) => {
              const isBooked = booked.has(suggestionKey(s));
              return (
                <div
                  key={suggestionKey(s)}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{s.resourceName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatTime(s.startsAt)} – {formatTime(s.endsAt)}
                    </p>
                  </div>
                  {isBooked ? (
                    <span className="text-xs font-medium text-emerald-600">Bokad</span>
                  ) : (
                    <button
                      onClick={() => handleBook(s)}
                      disabled={bookMutation.isPending}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      Boka
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {askMutation.isPending && <p className="text-sm text-gray-500">Söker...</p>}
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          maxLength={500}
          placeholder="Skriv vad du behöver…"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
        />
        <button
          onClick={handleSend}
          disabled={askMutation.isPending || !text.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Skicka
        </button>
      </div>
    </aside>
);
}


