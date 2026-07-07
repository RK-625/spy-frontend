import { embed, EmbeddingModel } from "ai";
import { embedModel } from "./modelstore";

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const result = await embed({
      model: embedModel(),
      value: text,
      providerOptions: {
        google: { outputDimensionality: 1536 },
      },
    });
    console.log("Embedding result:", result);
    return result.embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}
