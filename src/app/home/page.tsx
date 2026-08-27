"use client";

import type { CSSProperties } from "react";
import {
  ChatActionButton,
  ChatActionRail,
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  Message,
  MessageAttachments,
  MessageContent,
  MessageFile,
  MessageResponse,
  ChainOfThought,
  ChainOfThoughtStep,
  ChainOfThoughtSearchResults,
  ChainOfThoughtSearchResult,
  Sources,
  Source,
  SourcesContent,
  SourcesTrigger,
  PromptInputWorkspace,
  ChatSidebar,
  MCPAppCard,
  hasMcpAppView,
} from "@/components/chat";
import type {
  DynamicToolUIPart,
  FileUIPart,
  ReasoningUIPart,
  SourceUrlUIPart,
  ToolUIPart,
  UIMessage,
} from "ai";

import { ChatProvider, useChatContext } from "@/contexts/ChatContext";
import { AppToaster, TooltipProvider } from "@/components/ui";
import { Excalidraw } from "@/components/logos";


function isReasoning(
  part: UIMessage["parts"][number],
): part is ReasoningUIPart {
  return part.type === "reasoning";
}

function isWebSearchToolPart(
  part: UIMessage["parts"][number],
): part is ToolUIPart {
  return part.type === "tool-webSearch";
}
function isDynamicToolUIPart(
  part: UIMessage["parts"][number],
): part is DynamicToolUIPart {
  return part.type === "dynamic-tool";
}
function dynamicToolStepStatus(
  state: DynamicToolUIPart["state"],
): "active" | "complete" {
  switch (state) {
    case "output-available":
    case "output-error":
    case "output-denied":
      return "complete";
    case "input-streaming":
    case "input-available":
    case "approval-requested":
    case "approval-responded":
      return "active";
  }
}

const EmptyState = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-12 text-center">
    <div className="text-lavender/40 font-[family-name:var(--font-terminal)] text-2xl">
      _
    </div>
    <p className="max-w-sm text-sm text-text-secondary">
      Ask Spy anything. Throw it a question, a mess, a half-formed idea — and
      watch the web start to weave.
    </p>
  </div>
);

const ChatWorkspace = () => {
  const { status, messages, error } = useChatContext();

  return (
    <div className="relative flex size-full flex-col overflow-hidden">
      <Conversation className="chat-fade-bottom" aria-live="polite">
        <ConversationContent
          aria-label="Conversation messages"
          className="pb-40"
        >
          {error && (
            <div className="mb-4 flex items-center gap-3 rounded-[var(--radius)] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
              <span className="text-status-dot-error" aria-hidden>
                ⚠
              </span>
              <span className="flex-1">{error.message}</span>
            </div>
          )}
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((message, messageIndex) => {
              const fileParts = message.parts.filter(
                (part): part is FileUIPart => part.type === "file",
              );
              const showRail = !(
                messageIndex === messages.length - 1 &&
                (status === "submitted" || status === "streaming")
              );

              return (
                <Message
                  from={message.role === "user" ? "user" : "assistant"}
                  key={message.id}
                >
                  <div className="flex w-full flex-col group-[.is-user]:items-end">
                    {/* 1. Chain of Thought — groups ALL reasoning steps + tool calls into one timeline */}
                    {(() => {
                      const thoughtParts = message.parts.filter(
                        (p) =>
                          p.type === "reasoning" ||
                          isWebSearchToolPart(p) ||
                          isDynamicToolUIPart(p),
                      );

                      if (thoughtParts.length === 0) return null;

                      return (
                        <ChainOfThought
                          isStreaming={
                            (status === "submitted" ||
                              status === "streaming") &&
                            messageIndex === messages.length - 1
                          }
                          className="!bg-transparent !border-transparent !backdrop-blur-none shadow-none !mb-0"
                          style={
                            {
                              "--color-muted-foreground": "var(--lavender-muted)",
                              /* Shimmer glint highlight: on-palette light accent (not pure white / not dark muted) */
                              "--color-background": "var(--primary)",
                            } as CSSProperties
                          }
                        >
                          {thoughtParts.map((part, index) => {
                            if (isReasoning(part)) {
                              const preview = part.text
                                ? part.text
                                  .trim()
                                  .slice(0, 120)
                                  .replace(/\n/g, " ") +
                                (part.text.length > 120 ? "…" : "")
                                : "Thinking…";
                              return (
                                <ChainOfThoughtStep
                                  key={`reasoning-${index}`}
                                  icon="bulb"
                                  label={preview}
                                  status="complete"
                                />
                              );
                            }
                            if (isWebSearchToolPart(part)) {
                              if (part.state !== "output-available") {
                                return null;
                              }
                              const input = part.input as { query?: string };
                              const { results } = part.output as {
                                results?: Array<{
                                  title?: string;
                                  url: string;
                                  text?: string;
                                }>;
                                error?: string;
                              };
                              return (
                                <ChainOfThoughtStep
                                  key={`search-${index}`}
                                  icon="globe"
                                  label={input.query}
                                  status="complete"
                                >
                                  {results && results?.length > 0 ? (
                                    <ChainOfThoughtSearchResults>
                                      {results.slice(0, 6).map((r, ri) => (
                                        <ChainOfThoughtSearchResult
                                          key={ri}
                                          href={r.url}
                                        />
                                      ))}
                                    </ChainOfThoughtSearchResults>
                                  ) : null}
                                </ChainOfThoughtStep>
                              );
                            }
                            if (isDynamicToolUIPart(part)) {
                              const isError = part.state === "output-error";
                              return (
                                <ChainOfThoughtStep
                                  key={part.toolCallId ?? index}
                                  icon={
                                    <Excalidraw
                                      className="size-3 shrink-0"
                                      aria-hidden
                                    />
                                  }
                                  label={part.toolName}
                                  status={dynamicToolStepStatus(part.state)}
                                  description={
                                    isError ? part.errorText : undefined
                                  }
                                />
                              );
                            }
                            return null;
                          })}
                          {/* Done indicator — shown when message is complete (has text) */}
                          {message.parts.some((p) => p.type === "text") && (
                            <ChainOfThoughtStep
                              icon="check"
                              label={"Done"}
                              status="complete"
                              isLast={true}
                            />
                          )}
                        </ChainOfThought>
                      );
                    })()}

                    {/* 2. Sources from native source-url parts works only for google gemini (e.g. Google grounding) */}
                    {(() => {
                      const sources = message.parts.filter(
                        (p): p is SourceUrlUIPart => p.type === "source-url",
                      );
                      if (sources.length === 0) return null;
                      return (
                        <Sources>
                          <SourcesTrigger count={sources.length} />
                          <SourcesContent>
                            {sources.map((src, index) => (
                              <Source
                                key={index}
                                href={src.url}
                                title={src.title || "Source"}
                              />
                            ))}
                          </SourcesContent>
                        </Sources>
                      );
                    })()}

                    {fileParts.length > 0 && (
                      <MessageAttachments>
                        {fileParts.map((part, i) => (
                          <MessageFile
                            key={part.filename ?? part.url ?? i}
                            part={part}
                          />
                        ))}
                      </MessageAttachments>
                    )}

                    {/* 3. Text parts last (+ MCP App views) */}
                    {message.parts.map((part, index) => {
                      if (part.type === "file") {
                        return null;
                      }
                      if (part.type === "text") {
                        return (
                          <MessageContent key={index}>
                            <MessageResponse>{part.text}</MessageResponse>
                          </MessageContent>
                        );
                      }
                      if (isDynamicToolUIPart(part) && hasMcpAppView(part)) {
                        return (
                          <MCPAppCard
                            key={part.toolCallId ?? `mcp-app-${index}`}
                            part={part}
                          />
                        );
                      }
                      return null;
                    })}

                    {showRail && (
                      <ChatActionRail
                        reveal={message.role === "user" ? "hover" : "always"}
                      >
                        <ChatActionButton icon="pencil" label="Edit" />
                        <ChatActionButton icon="copy" label="Copy" />
                      </ChatActionRail>
                    )}
                  </div>
                </Message>
              );
            })
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
        <div className="pointer-events-auto">
          <PromptInputWorkspace />
        </div>
      </div>
    </div>
  );
};

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-chat workspace-root">
      <div className="fixed inset-0 z-50 bg-surface-chat pointer-events-none animate-[dissolve-out_2.5s_linear_0.8s_forwards]" />

      <div className="relative z-10 flex h-screen w-full">
        {/* Chat product shell: tooltips + stream + toaster (chat-only; root layout stays bare) */}
        <TooltipProvider delayDuration={300}>
          <ChatProvider>
            <ChatSidebar />
            {/* Main chat area */}
            <div className="flex h-full flex-1 flex-col items-center overflow-hidden">
              <div className="flex h-full w-full max-w-4xl flex-col bg-[var(--surface-chat-panel)] backdrop-blur-sm">
                <ChatWorkspace />
              </div>
            </div>
          </ChatProvider>
          <AppToaster />
        </TooltipProvider>
      </div>
    </div>
  );
}
