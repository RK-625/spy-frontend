"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import useSWR from "swr";
import { connectTopologyFeed } from "@/lib/graph/client/topology-feed";
import type { GraphApiResponse, GraphTopology } from "@/types/graph-topology";

type GraphTopologyState = {
  topology: GraphTopology | null;
  loading: boolean;
  error: Error | undefined;
};

const GraphTopologyContext = createContext<GraphTopologyState | null>(null);

async function fetchTopology(url: string): Promise<GraphTopology> {
  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json()) as GraphApiResponse;
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? `Could not load graph (${response.status})`);
  }
  return { memories: data.memories, links: data.links };
}

export function GraphTopologyProvider({ children }: { children: ReactNode }) {
  const { data, error, isLoading, mutate } = useSWR<GraphTopology, Error>(
    "/api/graph",
    fetchTopology,
  );

  useEffect(() => connectTopologyFeed(() => mutate()), [mutate]);

  const value = useMemo(() => ({
    topology: data ?? null,
    loading: isLoading,
    error,
  }), [data, isLoading, error]);

  return (
    <GraphTopologyContext.Provider value={value}>
      {children}
    </GraphTopologyContext.Provider>
  );
}

export function useGraphTopology(): GraphTopologyState {
  const state = useContext(GraphTopologyContext);
  if (state === null) {
    throw new Error("useGraphTopology must be used within a GraphTopologyProvider");
  }
  return state;
}
