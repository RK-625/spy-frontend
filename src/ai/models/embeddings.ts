import { embed } from "ai";
import { embedModel } from "./modelstore";

/** Must match Falkor vector index dim / Google outputDimensionality. */
const EMBEDDING_DIMENSION = 1536;

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const result = await embed({
      model: embedModel(),
      value: text,
      providerOptions: {
        google: { outputDimensionality: EMBEDDING_DIMENSION },
      },
    });
    return result.embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}
