import type { ModelMessage } from "ai";
import type { GraphJobStatus } from "@/types/chat";

type GraphUpdateListener = (messages: ModelMessage[]) => void;
type GraphJobStatusListener = (status: GraphJobStatus) => void;

const graphSubscribers = new Map<string, Set<GraphUpdateListener>>();
const graphJobStatus = new Map<string, GraphJobStatus>();
const statusSubscribers = new Map<string, Set<GraphJobStatusListener>>();

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

export function getGraphJobStatus(chatId: string): GraphJobStatus {
  return graphJobStatus.get(chatId) ?? "idle";
}

export function subscribeToGraphJobStatus(
  chatId: string,
  listener: GraphJobStatusListener,
): () => void {
  let subscribers = statusSubscribers.get(chatId);

  if (!subscribers) {
    subscribers = new Set();
    statusSubscribers.set(chatId, subscribers);
  }

  subscribers.add(listener);

  return () => {
    subscribers?.delete(listener);

    if (subscribers?.size === 0) {
      statusSubscribers.delete(chatId);
    }
  };
}

export function publishGraphJobStatus(
  chatId: string,
  status: GraphJobStatus,
): void {
  if (status === "idle") graphJobStatus.delete(chatId);
  else graphJobStatus.set(chatId, status);

  const subscribers = statusSubscribers.get(chatId);
  if (!subscribers) return;

  for (const listener of subscribers) {
    listener(status);
  }
}
