"use client";

import type { ModelMessage, ToolCallPart, ToolResultPart } from "ai";
import type { GraphMessageSource } from "@/types/chat";

type ToolResultOutput = ToolResultPart["output"];
import { Link2, Pencil, Plus, Search, Trash2, Unlink } from "lucide-react";
import { deleteMemoriesInputSchema } from "@/ai/schemas/delete-schema";
import { getMemoriesInputSchema } from "@/ai/schemas/get-schema";
import { manageLinksInputSchema } from "@/ai/schemas/link-schema";
import { searchMemoriesInputSchema } from "@/ai/schemas/search-schema";
import { upsertMemoryInputSchema } from "@/ai/schemas/upsert-schema";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { cn } from "@/lib/utils";
import type { Links } from "@/types/graph-schema";

export type GraphChangeKind = "created" | "updated" | "deleted" | "linked" | "unlinked" | "read";

const GRAPH_FEED_TOOLS = [
  "upsertMemory",
  "deleteMemories",
  "manageLinks",
  "searchMemories",
  "getMemories",
] as const;

type GraphFeedToolName = (typeof GRAPH_FEED_TOOLS)[number];

function isGraphFeedTool(toolName: string): toolName is GraphFeedToolName {
  return (GRAPH_FEED_TOOLS as readonly string[]).includes(toolName);
}

export type GraphChange = {
  key: string;
  kind: GraphChangeKind;
  label: string;
  failed: boolean;
  /** Absent on history written before messages were stamped. */
  origin: GraphMessageSource | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isToolCallPart(part: unknown): part is ToolCallPart {
  return (
    isRecord(part) &&
    part.type === "tool-call" &&
    typeof part.toolCallId === "string" &&
    typeof part.toolName === "string"
  );
}

function isToolResultPart(part: unknown): part is ToolResultPart {
  return (
    isRecord(part) &&
    part.type === "tool-result" &&
    typeof part.toolCallId === "string"
  );
}

function shortId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "unknown";
  return value.length > 8 ? `${value.slice(0, 6)}…` : value;
}

function linkRelation(type: Links["type"]): string {
  return type === "PARENT_OF" ? "as parent" : "as related";
}

function pushLinkChanges(
  changes: GraphChange[],
  callId: string,
  links: Links[],
  kind: Extract<GraphChangeKind, "linked" | "unlinked">,
  failed: boolean,
  origin: GraphMessageSource | null,
): void {
  const verb = kind === "linked" ? "Linked" : "Unlinked";
  links.forEach((link, linkIndex) => {
    changes.push({
      key: `${callId}-${kind}-${linkIndex}`,
      kind,
      label: `${verb} ${shortId(link.source)} → ${shortId(link.target)} ${linkRelation(link.type)}`,
      failed,
      origin,
    });
  });
}

function resultOutputName(output: ToolResultOutput | undefined): string | undefined {
  if (output?.type !== "json") return undefined;
  const value = output.value;
  if (!isRecord(value)) return undefined;
  const name = value.name;
  return typeof name === "string" && name.length > 0 ? name : undefined;
}

function collectResultOutputs(messages: ModelMessage[]): Map<string, ToolResultOutput> {
  const outputs = new Map<string, ToolResultOutput>();
  for (const message of messages) {
    const content = message.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!isToolResultPart(part)) continue;
      outputs.set(part.toolCallId, part.output);
    }
  }
  return outputs;
}

function pushToolCallChanges(
  changes: GraphChange[],
  toolName: GraphFeedToolName,
  toolCallId: string,
  input: unknown,
  failed: boolean,
  resultOutput: ToolResultOutput | undefined,
  origin: GraphMessageSource | null,
): void {
  switch (toolName) {
    case "upsertMemory": {
      const parsed = upsertMemoryInputSchema.safeParse(input);
      if (!parsed.success) return;
      const { id, name } = parsed.data;
      if (id == null) {
        const label = name && name.length > 0 ? name : "untitled memory";
        changes.push({
          key: toolCallId,
          kind: "created",
          label: `Created memory \u201c${label}\u201d`,
          failed,
          origin,
        });
        return;
      }
      const inputName = name && name.length > 0 ? name : undefined;
      const resolved =
        inputName ?? (failed ? undefined : resultOutputName(resultOutput));
      changes.push({
        key: toolCallId,
        kind: "updated",
        label:
          resolved !== undefined
            ? `Updated memory \u201c${resolved}\u201d`
            : `Updated memory ${shortId(id ?? toolCallId)}`,
        failed,
        origin,
      });
      return;
    }
    case "deleteMemories": {
      const parsed = deleteMemoriesInputSchema.safeParse(input);
      if (!parsed.success) return;
      const outputValue =
        resultOutput?.type === "json" ? resultOutput.value : undefined;
      const missingIds = new Set(
        isRecord(outputValue) && Array.isArray(outputValue.missingIds)
          ? outputValue.missingIds.filter((id): id is string => typeof id === "string")
          : [],
      );
      const deletedIds = new Set(
        isRecord(outputValue) && Array.isArray(outputValue.deleted)
          ? outputValue.deleted.flatMap((memory: unknown) =>
              isRecord(memory) && typeof memory.id === "string" ? [memory.id] : [],
            )
          : [],
      );
      [...new Set(parsed.data.ids)].forEach((id, index) => {
        const verb = failed
          ? "Failed to delete"
          : missingIds.has(id)
            ? "Already absent:"
            : deletedIds.has(id)
              ? "Deleted"
              : "Deletion requested for";
        changes.push({
          key: `${toolCallId}-deleted-${index}`,
          kind: "deleted",
          label: `${verb} memory ${shortId(id)}`,
          failed,
          origin,
        });
      });
      return;
    }
    case "manageLinks": {
      const parsed = manageLinksInputSchema.safeParse(input);
      if (!parsed.success) return;
      pushLinkChanges(changes, toolCallId, parsed.data.remove, "unlinked", failed, origin);
      pushLinkChanges(changes, toolCallId, parsed.data.upsert, "linked", failed, origin);
      return;
    }
    case "searchMemories": {
      const parsed = searchMemoriesInputSchema.safeParse(input);
      if (!parsed.success) return;
      const [first, ...rest] = parsed.data.questions;
      const query = `\u201c${first.length > 60 ? `${first.slice(0, 60).trimEnd()}\u2026` : first}\u201d${rest.length > 0 ? ` (+${rest.length})` : ""}`;
      changes.push({
        key: toolCallId,
        kind: "read",
        label: `Searched ${query}`,
        failed,
        origin,
      });
      return;
    }
    case "getMemories": {
      const parsed = getMemoriesInputSchema.safeParse(input);
      if (!parsed.success) return;
      const outputValue =
        resultOutput?.type === "json" ? resultOutput.value : undefined;
      const results =
        isRecord(outputValue) && Array.isArray(outputValue.results)
          ? outputValue.results
          : [];
      parsed.data.memories.forEach(({ id, hops = 0 }, index) => {
        const result: unknown = results[index];
        const lookupFailed = failed || (isRecord(result) && result.ok === false);
        const hopsLabel = hops > 0 ? ` (${hops} hop${hops === 1 ? "" : "s"})` : "";
        changes.push({
          key: `${toolCallId}-read-${index}`,
          kind: "read",
          label: `${lookupFailed ? "Failed to read" : "Read"} ${shortId(id)}${hopsLabel}`,
          failed: lookupFailed,
          origin,
        });
      });
      return;
    }
    default: {
      const _exhaustive: never = toolName;
      return _exhaustive;
    }
  }
}

function collectFailedCallIds(messages: ModelMessage[]): Set<string> {
  const failed = new Set<string>();
  for (const message of messages) {
    const content = message.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!isToolResultPart(part)) continue;
      const output = part.output;
      if (output.type === "error-text" || output.type === "error-json") {
        failed.add(part.toolCallId);
        continue;
      }
      if (
        output.type === "json" &&
        isRecord(output.value) &&
        "error" in output.value
      ) {
        failed.add(part.toolCallId);
      }
    }
  }
  return failed;
}

function messageSource(message: ModelMessage): GraphMessageSource | null {
  const record = message as unknown as Record<string, unknown>;
  const source = record.graphSource;
  if (source === "graph" || source === "chat") return source;
  return null;
}

/**
 * Parses graph history into a newest-first change feed: mutating tool calls
 * (creates, updates, link changes) plus trimmed read calls. Reasoning and
 * turns are dropped — the conversation already shows those. Non-graph tools
 * (web search, ask-user, MCP apps) fail the feed-tool gate below and are
 * skipped. Chat and graph calls both stay in the feed. A missing marker
 * is legacy history and renders with no agent prefix.
 */
export function parseGraphChanges(messages: ModelMessage[]): GraphChange[] {
  const failedCallIds = collectFailedCallIds(messages);
  const resultOutputs = collectResultOutputs(messages);
  const changes: GraphChange[] = [];
  for (const message of messages) {
    const content = message.content;
    if (!Array.isArray(content)) continue;
    const source = messageSource(message);
    for (const part of content) {
      if (!isToolCallPart(part)) continue;
      if (!isGraphFeedTool(part.toolName)) continue;
      pushToolCallChanges(
        changes,
        part.toolName,
        part.toolCallId,
        part.input,
        failedCallIds.has(part.toolCallId),
        resultOutputs.get(part.toolCallId),
        source,
      );
    }
  }
  return changes.reverse();
}

function originPrefix(origin: GraphMessageSource | null): string | null {
  if (origin === "chat") return "chat · ";
  if (origin === "graph") return "graph · ";
  return null;
}

const CHANGE_ICON = {
  created: Plus,
  updated: Pencil,
  deleted: Trash2,
  linked: Link2,
  unlinked: Unlink,
  read: Search,
} as const;

export function GraphChangeFeed({ changes }: { changes: GraphChange[] }) {
  return (
    <div aria-label="Graph changes" className="flex flex-col gap-1 px-4 py-4">
      {changes.map((change) => {
        const Icon = CHANGE_ICON[change.kind];
        return (
          <div
            key={change.key}
            className={cn(
              "flex items-center gap-2.5 rounded-[var(--radius)] px-2 py-1.5",
              change.failed && "opacity-60",
            )}
          >
            <Icon
              size={ICON_GLYPH.badge}
              strokeWidth={1.5}
              aria-hidden
              className="shrink-0 text-text-secondary"
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                change.kind === "read"
                  ? "text-text-secondary"
                  : "text-text-primary",
              )}
            >
              {originPrefix(change.origin)}
              {change.label}
            </span>
            {change.failed ? (
              <span className="shrink-0 text-sm text-text-secondary">
                · failed
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
