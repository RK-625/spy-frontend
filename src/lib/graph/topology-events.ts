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

type TopologyChannel = {
  subscribers: Set<TopologyUpdateListener>;
  revision: number;
};

// Next can evaluate this module in separate route/tool chunks. Keep one
// channel per process, as with the embedded Falkor client singleton.
const topologyChannel = ((
  globalThis as { __spyTopologyChannel?: TopologyChannel }
).__spyTopologyChannel ??= {
  subscribers: new Set<TopologyUpdateListener>(),
  revision: 0,
});

export function getTopologyRevision(): number {
  return topologyChannel.revision;
}

export function subscribeToTopologyUpdates(
  listener: TopologyUpdateListener,
): () => void {
  topologyChannel.subscribers.add(listener);
  return () => {
    topologyChannel.subscribers.delete(listener);
  };
}

export function publishTopologyUpdate(): void {
  topologyChannel.revision += 1;
  const event: TopologyUpdatedEvent = {
    type: "graph-topology-updated",
    revision: topologyChannel.revision,
    updatedAt: Date.now(),
  };
  for (const listener of topologyChannel.subscribers) {
    listener(event);
  }
}
