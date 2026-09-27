"use client";

import type { ModelMessage, ToolCallPart, ToolResultPart } from "ai";

type ToolResultOutput = ToolResultPart["output"];
import { Link2, Pencil, Plus, Search, Unlink } from "lucide-react";
import { getMemoriesInputSchema } from "@/ai/schemas/get-schema";
import { manageLinksInputSchema } from "@/ai/schemas/link-schema";
import { searchMemoriesInputSchema } from "@/ai/schemas/search-schema";
import { upsertMemoryInputSchema } from "@/ai/schemas/upsert-schema";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { cn } from "@/lib/utils";
import type { Links } from "@/types/graph-schema";

export type GraphChangeKind = "created" | "updated" | "linked" | "unlinked" | "read";

export type GraphChange = {
  key: string;
  kind: GraphChangeKind;
  label: string;
  failed: boolean;
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
): void {
  const verb = kind === "linked" ? "Linked" : "Unlinked";
  links.forEach((link, linkIndex) => {
    changes.push({
      key: `${callId}-${kind}-${linkIndex}`,
      kind,
      label: `${verb} ${shortId(link.source)} → ${shortId(link.target)} ${linkRelation(link.type)}`,
      failed,
    });
  });
}

function resultOutputName(output: ToolResultOutput): string | undefined {
  if (output.type !== "json") return undefined;
  const value = output.value;
  if (!isRecord(value)) return undefined;
  const name = value.name;
  return typeof name === "string" && name.length > 0 ? name : undefined;
}

function collectResultNames(messages: ModelMessage[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const message of messages) {
    const content = message.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!isToolResultPart(part)) continue;
      const name = resultOutputName(part.output);
      if (name !== undefined) names.set(part.toolCallId, name);
    }
  }
  return names;
}

function pushToolCallChanges(
  changes: GraphChange[],
  toolName: string,
  toolCallId: string,
  input: unknown,
  failed: boolean,
  resultName: string | undefined,
): void {
  if (toolName === "upsertMemory") {
    const parsed = upsertMemoryInputSchema.safeParse(input);
    if (!parsed.success) return;
    const { id, name } = parsed.data;
    if (id == null) {
      const label = name && name.length > 0 ? name : "untitled memory";
      changes.push({
        key: toolCallId,
        kind: "created",
        label: `Created memory “${label}”`,
        failed,
      });
      return;
    }
    const inputName = name && name.length > 0 ? name : undefined;
    const resolved = inputName ?? (failed ? undefined : resultName);
    changes.push({
      key: toolCallId,
      kind: "updated",
      label:
        resolved !== undefined
          ? `Updated memory “${resolved}”`
          : `Updated memory ${shortId(id ?? toolCallId)}`,
      failed,
    });
    return;
  }
  if (toolName === "manageLinks") {
    const parsed = manageLinksInputSchema.safeParse(input);
    if (!parsed.success) return;
    pushLinkChanges(changes, toolCallId, parsed.data.remove, "unlinked", failed);
    pushLinkChanges(changes, toolCallId, parsed.data.upsert, "linked", failed);
    return;
  }
  if (toolName === "searchMemories") {
    const parsed = searchMemoriesInputSchema.safeParse(input);
    if (!parsed.success) return;
    const [first, ...rest] = parsed.data.questions;
    const query = `“${first.length > 60 ? `${first.slice(0, 60).trimEnd()}…` : first}”${rest.length > 0 ? ` (+${rest.length})` : ""}`;
    changes.push({
      key: toolCallId,
      kind: "read",
      label: `Searched ${query}`,
      failed,
    });
    return;
  }
  if (toolName === "getMemories") {
    const parsed = getMemoriesInputSchema.safeParse(input);
    if (!parsed.success) return;
    const hops = parsed.data.hops ?? 0;
    const hopsLabel = hops > 0 ? ` (${hops} hop${hops === 1 ? "" : "s"})` : "";
    changes.push({
      key: toolCallId,
      kind: "read",
      label: `Read ${shortId(parsed.data.id)}${hopsLabel}`,
      failed,
    });
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

/**
 * Parses graph history into a newest-first change feed: mutating tool calls
 * (creates, updates, link changes) plus trimmed read calls. Reasoning and
 * turns are dropped — the conversation already shows those.
 */
export function parseGraphChanges(messages: ModelMessage[]): GraphChange[] {
  const failedCallIds = collectFailedCallIds(messages);
  const resultNames = collectResultNames(messages);
  const changes: GraphChange[] = [];
  for (const message of messages) {
    const content = message.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!isToolCallPart(part)) continue;
      pushToolCallChanges(
        changes,
        part.toolName,
        part.toolCallId,
        part.input,
        failedCallIds.has(part.toolCallId),
        resultNames.get(part.toolCallId),
      );
    }
  }
  return changes.reverse();
}

const CHANGE_ICON = {
  created: Plus,
  updated: Pencil,
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
