"use client";

import type { CSSProperties } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  Message,
  MessageContent,
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
} from "@/components/chat";
import type { SourceUrlUIPart, ToolUIPart, UIMessage } from "ai";

import { ChatProvider, useChatContext } from "@/contexts/ChatContext";
import ShinyText from "@/components/landing/shiny-text";

/** Mirrors src/ai/toolset.ts webSearch input/output for UI parts */
type SpyUITools = {
  webSearch: {
    input: { query: string };
    output: {
      results?: Array<{ title?: string; url: string; text?: string }>;
      error?: string;
    };
  };
};

type WebSearchToolPart = Extract<
  ToolUIPart<SpyUITools>,
  { type: "tool-webSearch" }
>;

function isWebSearchToolPart(
  part: UIMessage["parts"][number],
): part is WebSearchToolPart {
  return part.type === "tool-webSearch";
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
    <div className="relative flex size-full flex-col divide-y overflow-hidden">
      <Conversation className="chat-fade-bottom" aria-live="polite">
        <ConversationContent aria-label="Conversation messages">
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
            messages.map((message, messageIndex) => (
              <Message
                from={message.role === "user" ? "user" : "assistant"}
                key={message.id}
              >
                <div>
                  {/* 1. Chain of Thought — groups ALL reasoning steps + tool calls into one timeline */}
                  {(() => {
                    const thoughtParts = message.parts.filter(
                      (p) =>
                        p.type === "reasoning" || isWebSearchToolPart(p),
                    );

                    if (thoughtParts.length === 0) return null;

                    return (
                      <ChainOfThought
                        isStreaming={
                          (status === "submitted" ||
                            status === "streaming") &&
                          messageIndex === messages.length - 1
                        }
                        className="!bg-transparent !border-transparent !backdrop-blur-none shadow-none"
                        style={
                          {
                            "--color-muted-foreground": "var(--lavender-muted)",
                            /* Shimmer glint highlight: on-palette light accent (not pure white / not dark muted) */
                            "--color-background": "var(--primary)",
                          } as CSSProperties
                        }
                      >
                        {thoughtParts.map((part, index) => {
                          if (part.type === "reasoning") {
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
                            const query = part.input.query ?? "Web search";
                            const results =
                              part.output.error != null
                                ? []
                                : (part.output.results ?? []);

                            return (
                              <ChainOfThoughtStep
                                key={`search-${index}`}
                                icon="globe"
                                label={query}
                                status="complete"
                              >
                                {results.length > 0 ? (
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

                  {/* 3. Text parts last */}
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return (
                        <MessageContent key={index}>
                          <MessageResponse>{part.text}</MessageResponse>
                        </MessageContent>
                      );
                    }
                    return null;
                  })}
                </div>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="shrink-0 pt-4">
        <PromptInputWorkspace />
      </div>
    </div>
  );
};

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-chat workspace-root">
      <div className="fixed inset-0 z-50 bg-surface-chat pointer-events-none animate-[dissolve-out_2.5s_linear_0.8s_forwards]" />

      <div className="relative z-10 flex h-screen w-full">
        {/* Sidebar + workspace share ChatProvider (stream); prompt shell scoped in workspace */}
        <ChatProvider>
          <ChatSidebar />
          {/* Main chat area */}
          <div className="flex h-full flex-1 flex-col items-center overflow-hidden">
            <div className="flex h-full w-full max-w-4xl flex-col bg-[var(--surface-chat-panel)] backdrop-blur-sm">
              <header className="relative flex items-center gap-3 border-b border-[var(--border-subtle)] px-6 py-4">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lavender/15 to-transparent" />
                <ShinyText
                  className="font-[family-name:var(--font-terminal)] text-lg font-bold tracking-widest uppercase"
                  spread={120}
                >
                  SPY
                </ShinyText>
                <span className="text-[0.65rem] font-[family-name:var(--font-terminal)] uppercase tracking-[0.3em] text-lavender">
                  WEAVING SIGNAL
                </span>
              </header>
              <ChatWorkspace />
            </div>
          </div>
        </ChatProvider>
      </div>
    </div>
  );
}
