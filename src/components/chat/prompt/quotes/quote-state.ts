import type { PromptQuote, StoredPromptQuote } from "@/types/chat";

export function appendPromptQuote(quotes: PromptQuote[], quote: PromptQuote): PromptQuote[] {
  return quotes.some((item) => item.sourceMessageId === quote.sourceMessageId && item.text === quote.text)
    ? quotes
    : [...quotes, quote];
}

export function restorePromptQuotes(draft: { quotes?: StoredPromptQuote[] } | null | undefined): PromptQuote[] {
  return (draft?.quotes ?? []).map((quote) => ({ ...quote, plainText: quote.plainText ?? quote.text }));
}

/** One-line chip label from the rendered excerpt. */
export function formatQuotePreview(quote: PromptQuote): string {
  return quote.plainText.replace(/\s+/g, " ").trim();
}

/** Quote snapshots travel as normal Markdown, including through transcript reloads. */
export function formatQuotedMessage(text: string, quotes: readonly PromptQuote[] = []): string {
  const blocks = quotes.map((quote) => {
    const label = quote.sourceRole === "assistant" ? "Spy" : "You";
    const lines = quote.text.replace(/\r\n?/g, "\n").split("\n");
    return `> **${label}:**\n>\n${lines.map((line) => `> ${line}`).join("\n")}`;
  });
  return [...blocks, text.trim()].filter(Boolean).join("\n\n");
}
