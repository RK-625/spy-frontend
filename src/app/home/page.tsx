"use client";

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
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
} from "@/components/ai-elements/message";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Sources,
  Source,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import type { FileUIPart, ToolUIPart } from "ai";

import { cn } from "@/lib/utils";
import { DotMatrixIcon } from "@/components/ai-elements/dot-matrix-icons";
import { Globe } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatProvider, useChatContext } from "@/contexts/ChatContext";
import { TooltipProvider } from "@/components/ui/tooltip";

interface MessageType {
  key: string;
  from: "user" | "assistant";
  sources?: { href: string; title: string }[];
  versions: {
    id: string;
    content: string;
  }[];
  reasoning?: {
    content: string;
    duration: number;
  };
  tools?: {
    name: string;
    description: string;
    status: ToolUIPart["state"];
    parameters: Record<string, unknown>;
    result: string | undefined;
    error: string | undefined;
  }[];
}

const initialMessages: MessageType[] = [
  {
    from: "user",
    key: nanoid(),
    versions: [
      {
        content: "Can you explain how to use React hooks effectively?",
        id: nanoid(),
      },
    ],
  },
  {
    from: "assistant",
    key: nanoid(),
    sources: [
      {
        href: "https://react.dev/reference/react",
        title: "React Documentation",
      },
      {
        href: "https://react.dev/reference/react-dom",
        title: "React DOM Documentation",
      },
    ],
    tools: [
      {
        description: "Searching React documentation",
        error: undefined,
        name: "mcp",
        parameters: {
          query: "React hooks best practices",
          source: "react.dev",
        },
        result: `{
  "query": "React hooks best practices",
  "results": [
    {
      "title": "Rules of Hooks",
      "url": "https://react.dev/warnings/invalid-hook-call-warning",
      "snippet": "Hooks must be called at the top level of your React function components or custom hooks. Don't call hooks inside loops, conditions, or nested functions."
    },
    {
      "title": "useState Hook",
      "url": "https://react.dev/reference/react/useState",
      "snippet": "useState is a React Hook that lets you add state to your function components. It returns an array with two values: the current state and a function to update it."
    },
    {
      "title": "useEffect Hook",
      "url": "https://react.dev/reference/react/useEffect",
      "snippet": "useEffect lets you synchronize a component with external systems. It runs after render and can be used to perform side effects like data fetching."
    }
  ]
}`,
        status: "input-available",
      },
    ],
    versions: [
      {
        content: `# React Hooks Best Practices

React hooks are a powerful feature that let you use state and other React features without writing classes. Here are some tips for using them effectively:

## Rules of Hooks

1. **Only call hooks at the top level** of your component or custom hooks
2. **Don't call hooks inside loops, conditions, or nested functions**

## Common Hooks

- **useState**: For local component state
- **useEffect**: For side effects like data fetching
- **useContext**: For consuming context
- **useReducer**: For complex state logic
- **useCallback**: For memoizing functions
- **useMemo**: For memoizing values

## Example of useState and useEffect

\`\`\`jsx
function ProfilePage({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // This runs after render and when userId changes
    fetchUser(userId).then(userData => {
      setUser(userData);
    });
  }, [userId]);

  return user ? <Profile user={user} /> : <Loading />;
}
\`\`\`

Would you like me to explain any specific hook in more detail?`,
        id: nanoid(),
      },
    ],
  },
  {
    from: "user",
    key: nanoid(),
    versions: [
      {
        content:
          "Yes, could you explain useCallback and useMemo in more detail? When should I use one over the other?",
        id: nanoid(),
      },
      {
        content:
          "I'm particularly interested in understanding the performance implications of useCallback and useMemo. Could you break down when each is most appropriate?",
        id: nanoid(),
      },
      {
        content:
          "Thanks for the overview! Could you dive deeper into the specific use cases where useCallback and useMemo make the biggest difference in React applications?",
        id: nanoid(),
      },
    ],
  },
  {
    from: "assistant",
    key: nanoid(),
    reasoning: {
      content: `The user is asking for a detailed explanation of useCallback and useMemo. I should provide a clear and concise explanation of each hook's purpose and how they differ.

The useCallback hook is used to memoize functions to prevent unnecessary re-renders of child components that receive functions as props.

The useMemo hook is used to memoize values to avoid expensive recalculations on every render.

Both hooks help with performance optimization, but they serve different purposes.`,
      duration: 10,
    },
    versions: [
      {
        content: `## useCallback vs useMemo

Both hooks help with performance optimization, but they serve different purposes:

### useCallback

\`useCallback\` memoizes **functions** to prevent unnecessary re-renders of child components that receive functions as props.

\`\`\`jsx
// Without useCallback - a new function is created on every render
const handleClick = () => {
  console.log(count);
};

// With useCallback - the function is only recreated when dependencies change
const handleClick = useCallback(() => {
  console.log(count);
}, [count]);
\`\`\`

### useMemo

\`useMemo\` memoizes **values** to avoid expensive recalculations on every render.

\`\`\`jsx
// Without useMemo - expensive calculation runs on every render
const sortedList = expensiveSort(items);

// With useMemo - calculation only runs when items change
const sortedList = useMemo(() => expensiveSort(items), [items]);
\`\`\`

### When to use which?

- Use **useCallback** when:
  - Passing callbacks to optimized child components that rely on reference equality
  - Working with event handlers that you pass to child components

- Use **useMemo** when:
  - You have computationally expensive calculations
  - You want to avoid recreating objects that are used as dependencies for other hooks

### Performance Note

Don't overuse these hooks! They come with their own overhead. Only use them when you have identified a genuine performance issue.`,
        id: nanoid(),
      },
    ],
  },
];

const models = [
  {
    chef: "OpenAI",
    chefSlug: "openai",
    id: "gpt-4o",
    name: "GPT-4o",
    providers: ["openai", "azure"],
  },
  {
    chef: "OpenAI",
    chefSlug: "openai",
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    providers: ["openai", "azure"],
  },
  {
    chef: "Anthropic",
    chefSlug: "anthropic",
    id: "claude-opus-4-20250514",
    name: "Claude 4 Opus",
    providers: ["anthropic", "azure", "google", "amazon-bedrock"],
  },
  {
    chef: "Anthropic",
    chefSlug: "anthropic",
    id: "claude-sonnet-4-20250514",
    name: "Claude 4 Sonnet",
    providers: ["anthropic", "azure", "google", "amazon-bedrock"],
  },
  {
    chef: "Google",
    chefSlug: "google",
    id: "gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash",
    providers: ["google"],
  },
];

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

const mockResponses = [
  "That's a great question! Let me help you understand this concept better. The key thing to remember is that proper implementation requires careful consideration of the underlying principles and best practices in the field.",
  "I'd be happy to explain this topic in detail. From my understanding, there are several important factors to consider when approaching this problem. Let me break it down step by step for you.",
  "This is an interesting topic that comes up frequently. The solution typically involves understanding the core concepts and applying them in the right context. Here's what I recommend...",
  "Great choice of topic! This is something that many developers encounter. The approach I'd suggest is to start with the fundamentals and then build up to more complex scenarios.",
  "That's definitely worth exploring. From what I can see, the best way to handle this is to consider both the theoretical aspects and practical implementation details.",
];

const delay = (ms: number): Promise<void> =>
  // eslint-disable-next-line promise/avoid-new -- setTimeout requires a new Promise
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const chefs = ["OpenAI", "Anthropic", "Google"];

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
    [attachments]
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
    <ModelSelectorItem onSelect={handleSelect} value={m.id}>
      <ModelSelectorLogo provider={m.chefSlug} />
      <ModelSelectorName>{m.name}</ModelSelectorName>
      <ModelSelectorLogoGroup>
        {m.providers.map((provider) => (
          <ModelSelectorLogo key={provider} provider={provider} />
        ))}
      </ModelSelectorLogoGroup>
      {isSelected ? (
        <DotMatrixIcon name="check" size={16} className="ml-auto" />
      ) : (
        <div className="ml-auto size-4" />
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
    modelSelectorOpen,
    setModelSelectorOpen,
    text,
    setText,
    useWebSearch,
    status,
    setStatus,
    messages,
    setMessages,
    setStreamingMessageId,
    updateMessageContent,
    toggleWebSearch,
    error,
    setError,
  } = useChatContext();

  const selectedModelData = useMemo(
    () => models.find((m) => m.id === model),
    [model]
  );

  const streamResponse = useCallback(
    async (messageId: string, content: string) => {
      setStatus("streaming");
      setStreamingMessageId(messageId);

      const words = content.split(" ");
      let currentContent = "";

      for (const [i, word] of words.entries()) {
        currentContent += (i > 0 ? " " : "") + word;
        updateMessageContent(messageId, currentContent);
        await delay(Math.random() * 100 + 50);
      }

      setStatus("ready");
      setStreamingMessageId(null);
    },
    [updateMessageContent, setStatus, setStreamingMessageId]
  );

  const addUserMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const userTimestamp = Date.now();
      const userMessage: MessageType = {
        from: "user",
        key: `user-${userTimestamp}`,
        versions: [
          {
            content: trimmed,
            id: `user-${userTimestamp}`,
          },
        ],
      };

      setMessages((prev) => [...prev, userMessage]);

      setTimeout(() => {
        const assistantTimestamp = Date.now();
        const assistantMessageId = `assistant-${assistantTimestamp}`;
        const randomResponse =
          mockResponses[Math.floor(Math.random() * mockResponses.length)];

        const assistantMessage: MessageType = {
          from: "assistant",
          key: `assistant-${assistantTimestamp}`,
          versions: [
            {
              content: "",
              id: assistantMessageId,
            },
          ],
        };

        setMessages((prev) => [...prev, assistantMessage]);
        streamResponse(assistantMessageId, randomResponse);
      }, 500);
    },
    [streamResponse, setMessages]
  );

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const hasText = Boolean(message.text?.trim());
      const hasAttachments = Boolean(message.files?.length);

      if (!hasText && !hasAttachments) {
        return;
      }

      setStatus("submitted");

      if (message.files?.length) {
        toast.success("Files attached", {
          description: `${message.files.length} file(s) attached to message`,
        });
      }

      const text = hasText
        ? message.text!.trim()
        : message.files
            ?.map((f) => f.filename || "file")
            .join(", ") || "Attachment";

      addUserMessage(text);
      setText("");
    },
    [addUserMessage, setStatus, setText]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setStatus("submitted");
      addUserMessage(suggestion);
    },
    [addUserMessage, setStatus]
  );

  const handleTranscriptionChange = useCallback(
    (transcript: string) => {
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    },
    [setText]
  );

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value);
    },
    [setText]
  );

  const handleModelSelect = useCallback(
    (modelId: string) => {
      setModel(modelId);
      setModelSelectorOpen(false);
    },
    [setModel, setModelSelectorOpen]
  );

  const isSubmitDisabled = useMemo(
    () => status === "ready" && !text.trim(),
    [text, status]
  );

  const handleStop = useCallback(() => {
    setStatus("ready");
    setStreamingMessageId(null);
  }, [setStatus, setStreamingMessageId]);

  return (
    <div className="relative flex size-full flex-col divide-y overflow-hidden">
      <Conversation className="chat-fade-bottom" aria-live="polite">
        <ConversationContent aria-label="Conversation messages">
          {error && (
            <div className="mb-4 flex items-center gap-3 rounded-[var(--radius)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <span className="text-red-400">⚠</span>
              <span className="flex-1">{error}</span>
              <button
                className="rounded border border-red-500/30 px-2 py-0.5 text-xs text-red-300 transition-colors hover:bg-red-500/20"
                onClick={() => {
                  setError(null);
                  setStatus("ready");
                }}
                type="button"
                aria-label="Dismiss error"
              >
                Dismiss
              </button>
            </div>
          )}
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map(({ versions, ...message }) => (
              <MessageBranch defaultBranch={0} key={message.key}>
                <MessageBranchContent>
                  {versions.map((version) => (
                    <Message
                      from={message.from}
                      key={`${message.key}-${version.id}`}
                    >
                      <div>
                        {message.sources?.length && (
                          <Sources>
                            <SourcesTrigger count={message.sources.length} />
                            <SourcesContent>
                              {message.sources.map((source) => (
                                <Source
                                  href={source.href}
                                  key={source.href}
                                  title={source.title}
                                />
                              ))}
                            </SourcesContent>
                          </Sources>
                        )}
                        {message.reasoning && (
                          <Reasoning duration={message.reasoning.duration}>
                            <ReasoningTrigger />
                            <ReasoningContent>
                              {message.reasoning.content}
                            </ReasoningContent>
                          </Reasoning>
                        )}
                        <MessageContent>
                          <MessageResponse>{version.content}</MessageResponse>
                        </MessageContent>
                      </div>
                    </Message>
                  ))}
                </MessageBranchContent>
                {versions.length > 1 && (
                  <MessageBranchSelector>
                    <MessageBranchPrevious />
                    <MessageBranchPage />
                    <MessageBranchNext />
                  </MessageBranchSelector>
                )}
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
              <PromptInputTextarea onChange={handleTextChange} value={text} />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools className="[&_button]:!size-8 [&_button]:!rounded-[var(--radius)]">
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger className="text-[#9a8cc0] hover:bg-[rgba(200,172,251,0.08)] hover:text-[#e8e4df]" />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <SpeechInput
                  className="shrink-0 text-[#9a8cc0] hover:bg-[rgba(200,172,251,0.08)] hover:text-[#e8e4df]"
                  onTranscriptionChange={handleTranscriptionChange}
                  size="icon-sm"
                  variant="ghost"
                />
                <PromptInputButton
                  onClick={toggleWebSearch}
                  size="icon-sm"
                  variant={useWebSearch ? "default" : "ghost"}
                  aria-label={useWebSearch ? "Disable web search" : "Enable web search"}
                  tooltip={{
                    content: useWebSearch ? "Disable web search" : "Enable web search",
                    side: "top",
                  }}
                  className={cn(
                    "transition-colors",
                    useWebSearch
                      ? "bg-[#e8dff8] text-[#0a0a0c] hover:bg-white"
                      : "text-[#9a8cc0] hover:bg-[rgba(200,172,251,0.08)] hover:text-[#e8e4df]"
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
                      className="shrink-0 text-[#9a8cc0] hover:bg-[rgba(200,172,251,0.08)] hover:text-[#e8e4df]"
                      variant="ghost"
                      aria-label={`Select model, currently ${selectedModelData?.name ?? "none"}`}
                    >
                      <DotMatrixIcon name="cpu" size={16} />
                    </PromptInputButton>
                  </ModelSelectorTrigger>
                  <ModelSelectorContent>
                    <ModelSelectorInput placeholder="Search models..." />
                    <ModelSelectorList>
                      <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
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
              </PromptInputTools>
              <PromptInputSubmit
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
import ShinyText from "@/components/ShinyText";

const ShaderGradientCanvas = dynamic(
  () => import("@shadergradient/react").then((mod) => ({ default: mod.ShaderGradientCanvas })),
  { ssr: false }
);
const ShaderGradient = dynamic(
  () => import("@shadergradient/react").then((mod) => ({ default: mod.ShaderGradient })),
  { ssr: false }
);

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#150c28]">
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
            <div
              className="flex h-full w-full max-w-4xl flex-col bg-[#150c28]/80 backdrop-blur-sm"
            >
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
              <Example />
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
      <ChatProvider initialMessages={initialMessages}>{children}</ChatProvider>
    </TooltipProvider>
  );
}
