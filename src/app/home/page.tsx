"use client";

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/chat/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/chat/ai-elements/conversation";
import {
  Message,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageResponse,
} from "@/components/chat/ai-elements/message";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/chat/ai-elements/model-selector";
import type { PromptInputMessage } from "@/components/chat/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  PromptInputProvider,
  useOptionalPromptInputController,
} from "@/components/chat/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/chat/ai-elements/reasoning";
import {
  Sources,
  Source,
  SourcesContent,
  SourcesTrigger,
} from "@/components/chat/ai-elements/sources";
import { SpeechInput } from "@/components/chat/ai-elements/speech-input";
import {
  Suggestion,
  Suggestions,
} from "@/components/chat/ai-elements/suggestion";
import type { FileUIPart, SourceUrlUIPart } from "ai";

import { cn } from "@/lib/utils";
import { DotMatrixIcon } from "@/components/chat/ai-elements/dot-matrix-icons";
import { useCallback, useMemo } from "react";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatProvider, useChatContext } from "@/contexts/ChatContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { models, chefs } from "@/types/models";

const suggestions = [
  "What are the latest trends in AI?",
  "How does machine learning work?",
  "Explain quantum computing",
  "Best practices for React development",
  "Tell me about TypeScript benefits",
  "How to optimize database queries?",
  "What is the difference between SQL and NoSQL?",
  "Explain cloud computing basics",
];

const AttachmentItem = ({
  attachment,
  onRemove,
}: {
  attachment: FileUIPart & { id: string };
  onRemove: (id: string) => void;
}) => {
  const handleRemove = useCallback(() => {
    onRemove(attachment.id);
  }, [onRemove, attachment.id]);

  return (
    <Attachment data={attachment} onRemove={handleRemove}>
      <AttachmentPreview />
      <AttachmentRemove />
    </Attachment>
  );
};

const PromptInputAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments();

  const handleRemove = useCallback(
    (id: string) => {
      attachments.remove(id);
    },
    [attachments],
  );

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <AttachmentItem
          attachment={attachment}
          key={attachment.id}
          onRemove={handleRemove}
        />
      ))}
    </Attachments>
  );
};

const SuggestionItem = ({
  suggestion,
  onClick,
}: {
  suggestion: string;
  onClick: (suggestion: string) => void;
}) => {
  const handleClick = useCallback(() => {
    onClick(suggestion);
  }, [onClick, suggestion]);

  return (
    <Suggestion
      className="rounded-[var(--radius)] font-[family-name:var(--font-body)] text-[0.75rem] font-medium tracking-wide
                 text-[#9a8cc0] border-[rgba(200,172,251,0.1)] bg-[rgba(14,7,32,0.5)]
                 hover:border-[rgba(232,223,248,0.2)] hover:bg-[rgba(232,223,248,0.06)]
                 hover:text-[#f0eaff]
                 data-[state=selected]:border-[rgba(232,223,248,0.2)]
                 data-[state=selected]:bg-[rgba(232,223,248,0.06)]
                 transition-all duration-200"
      onClick={handleClick}
      suggestion={suggestion}
    />
  );
};

const ModelItem = ({
  m,
  isSelected,
  onSelect,
}: {
  m: (typeof models)[0];
  isSelected: boolean;
  onSelect: (id: string) => void;
}) => {
  const handleSelect = useCallback(() => {
    onSelect(m.id);
  }, [onSelect, m.id]);

  return (
    <ModelSelectorItem onSelect={handleSelect} value={m.name}>
      <ModelSelectorLogo icon={m.icon} />
      <ModelSelectorName>{m.name}</ModelSelectorName>
      {isSelected ? (
        <DotMatrixIcon name="check" size={10} className="ml-auto" />
      ) : (
        <div className="ml-auto size-2.5" />
      )}
    </ModelSelectorItem>
  );
};

const EmptyState = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-12 text-center">
    <div className="text-[#C8ACFB]/40 font-[family-name:var(--font-terminal)] text-2xl">
      _
    </div>
    <p className="max-w-sm text-sm text-[#7a7685]">
      Ask Spy anything. Throw it a question, a mess, a half-formed idea — and
      watch the web start to weave.
    </p>
  </div>
);

const Example = () => {
  const {
    model,
    setModel,
    mode,
    setMode,
    modelSelectorOpen,
    setModelSelectorOpen,
    modeSelectorOpen,
    setModeSelectorOpen,
    useWebSearch,
    status,
    messages,
    toggleWebSearch,
    error,
    sendMessage,
    stop,
    handleSubmit,
  } = useChatContext();

  const controller = useOptionalPromptInputController();
  const attachments = usePromptInputAttachments();

  const selectedModelData = useMemo(
    () => models.find((m) => m.id === model),
    [model],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (status !== "ready") return;
      sendMessage(
        {
          role: "user",
          parts: [{ type: "text", text: suggestion }],
        },
        {
          body: { model, useWebSearch },
        },
      );
    },
    [sendMessage, status, model, useWebSearch],
  );

  const handleTranscriptionChange = useCallback(
    (transcript: string) => {
      if (controller) {
        controller.textInput.setInput(
          controller.textInput.value
            ? `${controller.textInput.value} ${transcript}`
            : transcript,
        );
      }
    },
    [controller],
  );

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (controller) {
        controller.textInput.setInput(event.target.value);
      }
    },
    [controller],
  );

  const handleModelSelect = useCallback(
    (modelId: string) => {
      setModel(modelId);
      setModelSelectorOpen(false);
    },
    [setModel, setModelSelectorOpen],
  );

  const isSubmitDisabled = useMemo(
    () =>
      status === "ready" &&
      !controller?.textInput.value.trim() &&
      attachments.files.length === 0,
    [controller?.textInput.value, attachments.files.length, status],
  );

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  return (
    <div className="relative flex size-full flex-col divide-y overflow-hidden">
      <Conversation className="chat-fade-bottom" aria-live="polite">
        <ConversationContent aria-label="Conversation messages">
          {error && (
            <div className="mb-4 flex items-center gap-3 rounded-[var(--radius)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <span className="text-red-400">⚠</span>
              <span className="flex-1">{error.message}</span>
            </div>
          )}
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((message) => (
              <MessageBranch defaultBranch={0} key={message.id}>
                <MessageBranchContent>
                  <Message
                    from={message.role === "user" ? "user" : "assistant"}
                    key={message.id}
                  >
                    <div>
                      {/* 1. Reasoning parts first */}
                      {message.parts.map((part, index) => {
                        if (part.type === "reasoning") {
                          return (
                            <Reasoning key={index} duration={0}>
                              <ReasoningTrigger />
                              <ReasoningContent>
                                {part.text || ""}
                              </ReasoningContent>
                            </Reasoning>
                          );
                        }
                        return null;
                      })}

                      {/* 2. Sources (Grouped) */}
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
                </MessageBranchContent>
              </MessageBranch>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="flex shrink-0 flex-col gap-3 pt-4">
        <Suggestions className="px-4">
          {suggestions.map((suggestion) => (
            <SuggestionItem
              key={suggestion}
              onClick={handleSuggestionClick}
              suggestion={suggestion}
            />
          ))}
        </Suggestions>
        <div className="w-full px-4 pb-4 pt-1">
          <div className="chat-input-wrap relative">
            <div className="chat-input-glow" />
            <PromptInput
              globalDrop
              multiple
              onSubmit={handleSubmit}
              accept="image/*,.pdf,.txt,.md,.json,.ts,.tsx,.js,.jsx"
              maxFiles={5}
              maxFileSize={10 * 1024 * 1024}
            >
              <PromptInputHeader>
                <PromptInputAttachmentsDisplay />
              </PromptInputHeader>
              <PromptInputBody>
                <PromptInputTextarea
                  onChange={handleTextChange}
                  value={controller?.textInput.value || ""}
                />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools className="[&_button]:!size-8 [&_button]:!rounded-[var(--radius)] [&_button[data-model-trigger]]:!w-auto [&_button[data-model-trigger]]:!px-2">
                  <PromptInputButton
                    onClick={attachments.openFileDialog}
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Add photos or files"
                    tooltip={{
                      content: "Add photos or files",
                      side: "top",
                    }}
                    className="text-text-primary hover:bg-[rgba(200,172,251,0.08)]"
                  >
                    <DotMatrixIcon name="plus" size={16} />
                  </PromptInputButton>
                  <SpeechInput
                    className="shrink-0 text-text-primary hover:bg-[rgba(200,172,251,0.08)]"
                    onTranscriptionChange={handleTranscriptionChange}
                    size="icon-sm"
                    variant="ghost"
                  />
                  <PromptInputButton
                    onClick={toggleWebSearch}
                    size="icon-sm"
                    variant={useWebSearch ? "default" : "ghost"}
                    aria-label={
                      useWebSearch ? "Disable web search" : "Enable web search"
                    }
                    tooltip={{
                      content: useWebSearch
                        ? "Disable web search"
                        : "Enable web search",
                      side: "top",
                    }}
                    className={cn(
                      "transition-colors",
                      useWebSearch
                        ? "bg-[#e8dff8] text-[#0a0a0c] hover:bg-white"
                        : "text-text-primary hover:bg-[rgba(200,172,251,0.08)]",
                    )}
                  >
                    <DotMatrixIcon name="globe" size={16} />
                  </PromptInputButton>
                  <ModelSelector
                    onOpenChange={setModelSelectorOpen}
                    open={modelSelectorOpen}
                  >
                    <ModelSelectorTrigger asChild>
                      <PromptInputButton
                        data-model-trigger
                        className="shrink-0 text-text-primary hover:bg-[rgba(200,172,251,0.08)] flex items-center gap-1.5"
                        variant="ghost"
                        aria-label={`Select model, currently ${selectedModelData?.name ?? "none"}`}
                      >
                        {selectedModelData ? (
                          <selectedModelData.icon className="size-3 shrink-0" />
                        ) : (
                          <DotMatrixIcon name="settings" size={16} />
                        )}
                        {selectedModelData ? (
                          <span className="text-[11px] font-[family-name:var(--font-body)] font-medium tracking-wide">
                            {selectedModelData.name}
                          </span>
                        ) : null}
                      </PromptInputButton>
                    </ModelSelectorTrigger>
                    <ModelSelectorContent>
                      <ModelSelectorInput placeholder="Search models..." />
                      <ModelSelectorList>
                        <ModelSelectorEmpty>
                          No models found.
                        </ModelSelectorEmpty>
                        {chefs.map((chef) => (
                          <ModelSelectorGroup heading={chef} key={chef}>
                            {models
                              .filter((m) => m.chef === chef)
                              .map((m) => (
                                <ModelItem
                                  isSelected={model === m.id}
                                  key={m.id}
                                  m={m}
                                  onSelect={handleModelSelect}
                                />
                              ))}
                          </ModelSelectorGroup>
                        ))}
                      </ModelSelectorList>
                    </ModelSelectorContent>
                  </ModelSelector>
                  {selectedModelData?.mode && selectedModelData.mode.length > 0 && (
                    <ModelSelector
                      onOpenChange={setModeSelectorOpen}
                      open={modeSelectorOpen}
                    >
                      <ModelSelectorTrigger asChild>
                        <PromptInputButton
                          data-model-trigger
                          className="shrink-0 text-text-primary hover:bg-[rgba(200,172,251,0.08)] flex items-center justify-center px-2"
                          variant="ghost"
                          aria-label="Select mode"
                        >
                          <span className="text-[11px] font-[family-name:var(--font-body)] font-medium tracking-wide capitalize">
                            {mode}
                          </span>
                        </PromptInputButton>
                      </ModelSelectorTrigger>
                      <ModelSelectorContent className="w-auto">
                        <ModelSelectorList>
                          {selectedModelData.mode.map((m) => (
                            <ModelSelectorItem
                              key={m}
                              value={m}
                              onSelect={(val) => {
                                setMode(val);
                                setModeSelectorOpen(false);
                              }}
                            >
                              <span className="capitalize">{m}</span>
                              {mode === m && (
                                <DotMatrixIcon
                                  name="check"
                                  size={14}
                                  className="ml-auto opacity-50"
                                />
                              )}
                            </ModelSelectorItem>
                          ))}
                        </ModelSelectorList>
                      </ModelSelectorContent>
                    </ModelSelector>
                  )}
                </PromptInputTools>
                <PromptInputSubmit
                  className={cn(
                    "!size-8 !rounded-[var(--radius)] transition-colors duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] disabled:!opacity-100",
                    !isSubmitDisabled
                      ? "bg-[#e8dff8] text-[#0a0a0c] hover:bg-white"
                      : "text-text-primary hover:bg-[rgba(200,172,251,0.08)]",
                  )}
                  variant={!isSubmitDisabled ? "default" : "ghost"}
                  disabled={isSubmitDisabled}
                  onStop={handleStop}
                  status={status}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>
    </div>
  );
};

import dynamic from "next/dynamic";
import ShinyText from "@/components/ui/ShinyText";

const ShaderGradientCanvas = dynamic(
  () =>
    import("@shadergradient/react").then((mod) => ({
      default: mod.ShaderGradientCanvas,
    })),
  { ssr: false },
);
const ShaderGradient = dynamic(
  () =>
    import("@shadergradient/react").then((mod) => ({
      default: mod.ShaderGradient,
    })),
  { ssr: false },
);

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#150c28] workspace-root">
      <div className="fixed inset-0 z-50 bg-[#150c28] pointer-events-none animate-[dissolve-out_2.5s_linear_0.8s_forwards]" />

      <div className="fixed inset-0 -z-10">
        <ShaderGradientCanvas>
          <ShaderGradient
            animate="on"
            brightness={0.7}
            cAzimuthAngle={250}
            cDistance={1.5}
            cPolarAngle={140}
            cameraZoom={10}
            color1="#4A1280"
            color2="#8838DE"
            color3="#DDB8F8"
            envPreset="city"
            grain="on"
            lightType="3d"
            positionX={0}
            positionY={0}
            positionZ={0}
            reflection={0.5}
            rotationX={0}
            rotationY={0}
            rotationZ={140}
            shader="defaults"
            type="sphere"
            uAmplitude={7}
            uDensity={0.8}
            uFrequency={5.5}
            uSpeed={0.3}
            uStrength={0.4}
            uTime={0}
            wireframe={false}
          />
        </ShaderGradientCanvas>
      </div>

      <div className="fixed inset-0 z-0 bg-[#150c28]/50 pointer-events-none" />

      <div className="relative z-10 flex h-screen w-full">
        {/* Sidebar — sibling to main chat area, but shares chat context */}
        <ChatProviderWrapper>
          <ChatSidebar />
          {/* Main chat area */}
          <div className="flex h-full flex-1 flex-col items-center overflow-hidden">
            <div className="flex h-full w-full max-w-4xl flex-col bg-[#150c28]/80 backdrop-blur-sm">
              <header className="relative flex items-center gap-3 border-b border-[#d0b8f5]/10 px-6 py-4">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C8ACFB]/15 to-transparent" />
                <ShinyText
                  className="font-[family-name:var(--font-terminal)] text-lg font-bold tracking-widest uppercase"
                  spread={120}
                >
                  SPY
                </ShinyText>
                <span className="text-[0.65rem] font-[family-name:var(--font-terminal)] uppercase tracking-[0.3em] text-[#C8ACFB]">
                  WEAVING SIGNAL
                </span>
              </header>
              <PromptInputProvider>
                <Example />
              </PromptInputProvider>
            </div>
          </div>
        </ChatProviderWrapper>
      </div>
    </div>
  );
}

// Wrap sidebar + chat area in a single ChatProvider so they share state
function ChatProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <ChatProvider>{children}</ChatProvider>
    </TooltipProvider>
  );
}
