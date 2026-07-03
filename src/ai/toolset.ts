import { tool, Tool } from "ai";
import { z } from "zod";
import Exa from "exa-js";
const exa = new Exa(process.env.EXA_API_KEY);
const webSearch: Tool = tool({
  description:
    "Search the web for up-to-date information, news, details, and facts.",
  inputSchema: z.object({
    query: z.string().describe("The search query to look up on the web."),
  }),
  execute: async ({ query }) => {
    try {
      const response = await exa.search(query, {
        numResults: 5,
        contents: { text: { maxCharacters: 2000 } },
      });
      return {
        results: response.results.map((r) => ({
          title: r.title || "Undefined",
          url: r.url,
          text: r.text || "",
        })),
      };
    } catch (error) {
      console.error("Exa search error:", error);
      return { error: "Failed to retrieve search results." };
    }
  },
});
export const toolSet: Record<string, Tool> = {
  webSearch: webSearch,
};
