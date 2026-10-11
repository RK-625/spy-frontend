/** Browser-only fixtures: all chat writes and AI requests stay in memory. */
export function installComposerFixture() {
  const text = "Select this excerpt to ask a follow-up.\n\n| Action | Result |\n| --- | --- |\n| Edit | Update content |\n| Rewire | Add **PARENT_OF** edges |\n\n" + "Long excerpt preview remains readable. ".repeat(40);
  const baseMessages = [
    { id: "qa-user", role: "user", parts: [{ type: "text", text: "Explain the actions." }] },
    { id: "qa-assistant", role: "assistant", parts: [{ type: "text", text }] },
  ];
  const makeRow = (id, allowCustomInput) => ({
    id, title: id, created_at: Date.now(), updated_at: Date.now(), graph_messages: [],
    messages: allowCustomInput === undefined ? [...baseMessages] : [...baseMessages, {
      id: "qa-question", role: "assistant", parts: [{
        type: "tool-askUserQuestion", toolCallId: "qa-question-tool", state: "input-available",
        input: { question: "Which action?", options: ["Edit content", "Rewire edges"], allowCustomInput },
      }],
    }],
  });
  const rows = {
    "composer-qa": makeRow("composer-qa"),
    "composer-qa-other": makeRow("composer-qa-other"),
    "composer-qa-forced": makeRow("composer-qa-forced", false),
    "composer-qa-custom": makeRow("composer-qa-custom", true),
  };
  window.__composerQA = { rows, sent: [], clipboard: [], clipboardFails: false };
  const json = (body) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    const method = init?.method || "GET";
    if (url.pathname === "/api/chats") {
      if (method === "GET") return json(url.searchParams.has("id") ? { chat: rows[url.searchParams.get("id")] } : { chats: Object.values(rows), nextCursor: null });
      if (method === "POST") {
        const data = JSON.parse(init.body);
        if (rows[data.chatId]) rows[data.chatId].messages = data.messages;
        return json({ created: false });
      }
      return json({ ok: true });
    }
    if (url.pathname === "/api/providers") return json({ ok: true, providers: [{ id: "deepseek", keyHint: "qa-fixture" }, { id: "exa", keyHint: null }] });
    if (url.pathname === "/api/chat") {
      window.__composerQA.sent.push(JSON.parse(init.body));
      const chunks = [{ type: "start", messageId: crypto.randomUUID() }, { type: "text-start", id: "t1" }, { type: "text-delta", id: "t1", delta: "QA response" }, { type: "text-end", id: "t1" }, { type: "finish" }];
      return new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "Content-Type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" } });
    }
    if (url.pathname === "/api/graph") return json({ ok: true, memories: [], links: [] });
    if (url.pathname.startsWith("/api/")) return json({ ok: true });
    return originalFetch(input, init);
  };
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
    writeText: async (value) => {
      if (window.__composerQA.clipboardFails) throw new Error("Clipboard denied");
      window.__composerQA.clipboard.push(value);
    },
  } });
  class MockSpeechRecognition extends EventTarget {
    constructor() { super(); window.__composerQA.speech = this; }
    start() { this.onstart?.(new Event("start")); }
    stop() { this.onend?.(new Event("end")); }
  }
  window.SpeechRecognition = MockSpeechRecognition;
  window.webkitSpeechRecognition = MockSpeechRecognition;
}

export const composerFixtureSource = `(${installComposerFixture.toString()})();`;
