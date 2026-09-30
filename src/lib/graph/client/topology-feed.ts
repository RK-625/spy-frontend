/** Browser transport only: SWR owns the topology snapshot and retry policy. */
export function connectTopologyFeed(
  refresh: () => Promise<unknown>,
  createSource: () => Pick<EventSource, "addEventListener" | "removeEventListener" | "close"> =
    () => new EventSource("/api/graph/events"),
): () => void {
  const source = createSource();
  let closed = false;
  let revision: number | null = null;
  let refreshPending = false;
  let refreshing = false;

  const drainRefreshes = async () => {
    try {
      while (!closed && refreshPending) {
        refreshPending = false;
        try {
          await refresh();
        } catch (error: unknown) {
          // SWR retains the last snapshot and retries failed fetches.
          console.warn("Topology refresh failed:", error);
        }
      }
    } finally {
      refreshing = false;
    }
  };

  const resetRevision = () => {
    revision = null;
  };

  const receiveUpdate = (message: Event) => {
    if (closed) return;
    let event: unknown;
    try {
      event = JSON.parse((message as MessageEvent<string>).data);
    } catch {
      return;
    }
    if (
      typeof event !== "object" || event === null ||
      !("type" in event) || event.type !== "graph-topology-updated" ||
      !("revision" in event) || typeof event.revision !== "number" ||
      !Number.isSafeInteger(event.revision) || event.revision < 0
    ) {
      return;
    }
    if (revision !== null && event.revision <= revision) return;
    revision = event.revision;
    refreshPending = true;
    if (refreshing) return;
    refreshing = true;
    // Coalesce events arriving together, then keep one trailing refresh.
    void Promise.resolve().then(drainRefreshes);
  };

  source.addEventListener("open", resetRevision);
  source.addEventListener("graph-topology-updated", receiveUpdate);
  return () => {
    closed = true;
    refreshPending = false;
    source.removeEventListener("open", resetRevision);
    source.removeEventListener("graph-topology-updated", receiveUpdate);
    source.close();
  };
}
