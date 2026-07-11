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
        contents: { text: { maxCharacters: 5000 } },
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
const askUserQuestion: Tool = tool({
  description:
    "Ask the user a multiple-choice question to resolve ambiguity or request a decision. Do not use this for open-ended chat.",
  inputSchema: z.object({
    question: z.string().describe("The question text."),
    options: z
      .array(z.string())
      .min(2)
      .max(5)
      .describe("Options for the user to choose from."),
    allowCustomInput: z
      .boolean()
      .describe("Whether to allow a write-in response."),
  }),
});

export const toolSet: Record<string, Tool> = {
  webSearch: webSearch,
  askUserQuestion: askUserQuestion,
};
