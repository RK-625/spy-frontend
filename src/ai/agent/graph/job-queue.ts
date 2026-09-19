/**
 * In-process serial queue for graph jobs. One Falkor writer per chatId;
 * different chats may overlap. Not debounce: turn N waits for N-1.
 */
const tails = new Map<string, Promise<unknown>>();

export function enqueueGraphJob(
  chatId: string,
  job: () => Promise<unknown>,
): Promise<unknown> {
  const previous = tails.get(chatId);
  // Swallow a failed prior turn so the next job still runs.
  const next = (previous ?? Promise.resolve())
    .catch(() => undefined)
    .then(job);

  tails.set(chatId, next);

  void next.finally(() => {
    if (tails.get(chatId) === next) {
      tails.delete(chatId);
    }
  });

  return next;
}
