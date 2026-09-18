/**
 * In-process serial queue for graph jobs. One Falkor writer per chatId;
 * different chats may overlap. Not debounce: turn N waits for N-1.
 */
export const FALLBACK_GRAPH_CHAT_ID = "unknown";

const tails = new Map<string, Promise<unknown>>();

export function enqueueGraphJob(
  chatId: string,
  job: () => Promise<unknown>,
): Promise<unknown> {
  const key = chatId.trim().length > 0 ? chatId.trim() : FALLBACK_GRAPH_CHAT_ID;
  const previous = tails.get(key);
  // Swallow a failed prior turn so the next job still runs.
  const next = (previous ?? Promise.resolve())
    .catch(() => undefined)
    .then(job);

  tails.set(key, next);

  void next.finally(() => {
    if (tails.get(key) === next) {
      tails.delete(key);
    }
  });

  return next;
}
