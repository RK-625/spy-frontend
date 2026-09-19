import { createToolSet } from "./toolset";

type ProductToolSet = ReturnType<typeof createToolSet>;

/** Chat-agent product tools. MCP/Excalidraw is merged later in the agent. */
export function createChatToolSet(): Pick<
  ProductToolSet,
  "searchMemories" | "getMemories" | "askUserQuestion" | "webSearch"
> {
  const tools = createToolSet();
  return {
    searchMemories: tools.searchMemories,
    getMemories: tools.getMemories,
    askUserQuestion: tools.askUserQuestion,
    webSearch: tools.webSearch,
  };
}

/** Graph-agent product tools. */
export function createGraphToolSet(): Pick<
  ProductToolSet,
  "searchMemories" | "getMemories" | "upsertMemory" | "manageLinks"
> {
  const tools = createToolSet();
  return {
    searchMemories: tools.searchMemories,
    getMemories: tools.getMemories,
    upsertMemory: tools.upsertMemory,
    manageLinks: tools.manageLinks,
  };
}
