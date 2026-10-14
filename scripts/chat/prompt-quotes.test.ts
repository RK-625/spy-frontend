import assert from "node:assert/strict";
import { test } from "node:test";
import { appendPromptQuote, formatQuotedMessage, formatQuotePreview, restorePromptQuotes } from "../../src/components/chat/prompt/quotes/quote-state";
import type { PromptQuote, StoredPromptQuote } from "../../src/types/chat";

const quote: PromptQuote = { id: "q1", sourceMessageId: "m1", sourceRole: "assistant", text: "First line\r\n\r\nSecond line", plainText: "First line\n\nSecond line" };

test("quotes keep multiline excerpts inside their blockquote and precede the authored answer", () => {
  assert.equal(formatQuotedMessage("  Explain this  ", [quote]), "> **Spy:**\n>\n> First line\n> \n> Second line\n\nExplain this");
  assert.equal(formatQuotedMessage("answer", [{ ...quote, sourceRole: "user", text: "Earlier question" }]), "> **You:**\n>\n> Earlier question\n\nanswer");
  assert.equal(formatQuotedMessage(" plain message "), "plain message");
});

test("repeat selections from one message do not duplicate chips, other messages retain their order", () => {
  const original = [quote];
  assert.equal(appendPromptQuote(original, { ...quote, id: "q2" }), original);
  const next = { ...quote, id: "q3", sourceMessageId: "m2" };
  assert.deepEqual(appendPromptQuote(original, next), [quote, next]);
  assert.deepEqual(original, [quote]);
});

test("legacy and missing drafts restore without quotes; current drafts retain snapshots", () => {
  assert.deepEqual(restorePromptQuotes(undefined), []);
  assert.deepEqual(restorePromptQuotes(null), []);
  assert.deepEqual(restorePromptQuotes({}), []);
  assert.deepEqual(restorePromptQuotes({ quotes: [quote] }), [quote]);
  const legacy: StoredPromptQuote = { id: quote.id, sourceMessageId: quote.sourceMessageId, sourceRole: quote.sourceRole, text: quote.text };
  assert.deepEqual(restorePromptQuotes({ quotes: [legacy] }), [{ ...legacy, plainText: legacy.text }]);
});

test("chip previews collapse the rendered excerpt to one line", () => {
  assert.equal(formatQuotePreview({ ...quote, plainText: "  Source\t→\tTarget\nKafka  " }), "Source → Target Kafka");
});
