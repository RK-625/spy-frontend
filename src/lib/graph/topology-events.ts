/**
 * Global topology update channel (in-process).
 *
 * Unlike `src/lib/chats/graph-events.ts` (per-chat history), topology writes
 * are shared across chats, so this is one unkeyed subscriber set, not a
 * per-id map. Only writes that explicitly publish in this process notify
 * subscribers; direct database writes from separate scripts do not.
 * Each publish advances a
 * revision counter; the SSE route sends the current revision as a connect
 * baseline so clients only react to newer events.
 */
export type TopologyUpdatedEvent = {
  type: "graph-topology-updated";
  revision: number;
  updatedAt: number;
};

type TopologyUpdateListener = (event: TopologyUpdatedEvent) => void;

const topologySubscribers = new Set<TopologyUpdateListener>();

let topologyRevision = 0;

export function getTopologyRevision(): number {
  return topologyRevision;
}

export function subscribeToTopologyUpdates(
  listener: TopologyUpdateListener,
): () => void {
  topologySubscribers.add(listener);
  return () => {
    topologySubscribers.delete(listener);
  };
}

export function publishTopologyUpdate(): void {
  topologyRevision += 1;
  const event: TopologyUpdatedEvent = {
    type: "graph-topology-updated",
    revision: topologyRevision,
    updatedAt: Date.now(),
  };
  for (const listener of topologySubscribers) {
    listener(event);
  }
}
