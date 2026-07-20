import { tool, Tool } from "ai";
import { z } from "zod";
import Exa from "exa-js";
import { askUserQuestionInputSchema } from "@/ai/schemas/ask-user-question";

export type { AskUserQuestionInput } from "@/ai/schemas/ask-user-question";
export { askUserQuestionInputSchema } from "@/ai/schemas/ask-user-question";

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
    "Resolve ambiguity or force a decision with a multiple-choice question (2–5 options). Set allowCustomInput true only when a write-in is reasonable. Do not use for open-ended chat.",
  inputSchema: askUserQuestionInputSchema,
});

export const toolSet: Record<string, Tool> = {
  webSearch: webSearch,
  askUserQuestion: askUserQuestion,
};
