import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { deepseek } from "@ai-sdk/deepseek";
import { models } from "../types/models";

export const modelStore = (model: string) => {
  const found = models.find((m) => m.id === model); // .find(), not .filter()
  if (!found) {
    throw new Error(`Unknown model: ${model}`);
  }
  switch (found.chef) {
    case "OpenAI":
      return openai(model);
    case "Anthropic":
      return anthropic(model);
    case "Google":
      return google(model);
    case "DeepSeek":
      return deepseek(model);
    default:
      throw new Error(`Unknown model: ${model}`);
  }
};
