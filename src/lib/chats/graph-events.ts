import type { ModelMessage } from "ai";

type GraphUpdateListener = (messages: ModelMessage[]) => void;

const graphSubscribers = new Map<string, Set<GraphUpdateListener>>();

export function subscribeToGraphUpdates(
  chatId: string,
  listener: GraphUpdateListener,
): () => void {
  let subscribers = graphSubscribers.get(chatId);

  if (!subscribers) {
    subscribers = new Set();
    graphSubscribers.set(chatId, subscribers);
  }

  subscribers.add(listener);

  return () => {
    subscribers?.delete(listener);

    if (subscribers?.size === 0) {
      graphSubscribers.delete(chatId);
    }
  };
}

export function publishGraphUpdate(
  chatId: string,
  messages: ModelMessage[],
): void {
  const subscribers = graphSubscribers.get(chatId);

  if (!subscribers) {
    return;
  }

  for (const listener of subscribers) {
    listener(messages);
  }
}
