import { NextResponse } from "next/server";

import { generateEmbedding } from "@/ai/models";
import { getDb, isVectorIndexesReady } from "@/lib/falkor";

/**
 * GET /api/test-db — dev/ops connectivity probe (not a product surface).
 * Hits Falkor open + vector index ensure + one embed + RETURN 1.
 * Keep Node runtime: native Falkor driver cannot run on Edge.
 */
export const runtime = "nodejs";

export async function GET() {
  try {
    const db = await getDb();
    const textToEmbed = "Spy is an alien intelligence.";
    const vector = await generateEmbedding(textToEmbed);
    const pingResult = await db.query("RETURN 1 AS ok");

    // Cheap proof that ensureVectorIndexes ran; listing is best-effort (Cypher may vary by version).
    let indexes: unknown = null;
    try {
      indexes = await db.query("CALL db.indexes()");
    } catch {
      indexes = null;
    }

    return NextResponse.json({
      success: true,
      message: "Connected to the FalkorDb",
      vectorIndexesReady: isVectorIndexesReady(),
      indexes,
      ping: pingResult,
      // Dim only — avoid dumping a 1536-float payload from a health probe.
      embeddingDimension: vector.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to connect to the FalkorDb",
        vectorIndexesReady: isVectorIndexesReady(),
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
