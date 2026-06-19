import { openai } from "@ai-sdk/openai"
import { generateText, streamText } from "ai"

export async function runAgent(messages:any[]) {
    const currmdeol = openai("gpt-4o");
    const result = streamText({model : currmdeol , system : "You are a helpful AI assistant, Be breif and playful ",messages});
    return result;
}