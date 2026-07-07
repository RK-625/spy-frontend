import { NextResponse } from "next/server";
import { getDb } from "@/lib/falkor";
import { generateEmbedding } from "@/ai/embeddings";

export async function GET() {
  try {
    const db = await getDb();
    const textToEmbed = "Spy is an alien intelligence.";
    const vector = await generateEmbedding(textToEmbed);
    const pingResult = await db.query("RETURN 1 AS ok");
    return NextResponse.json({
      success: true,
      message: "Connected to the FalkorDb",
      ping: pingResult,
      vector: vector,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "Failed to connect to the FalkorDb",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
