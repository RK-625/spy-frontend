/**
 * Shared knowledge-base / graph narrative for the agent system prompt
 * and any consumer that needs Memory shape + link rules without chat persona.
 */

export const GRAPH_CONTEXT = `## What the knowledge base is
The knowledge base is Spy's durable graph of what this user knows and has learnt during their conversations —
not a chat log, not a dump of every message, and not a generic vector store alone.

It stores **Memory** nodes. Each Memory is one focused unit of knowledge/learning with the schema:
- **id** — stable identity of the database (you get this back from upsertMemory; reuse it to update)
- **name** — short title / concept (what shows as a node name)
- **content** — the facts, explanation, the current user's learning of the concept
- **impression** — Spy's read of how the user relates to this (grasp, confusion, interest, stance) — evolves as they do - Your takeaway on the user's knowledge of this concept
- **confidence** — 0–1 how solid their grasp seems
- **retrieval questions embeddings** — system auto-generates agent-side recall probes (third-person about the user's knowledge,
  e.g. "Has the user studied …?", "Does the user know about …?") with synonym diversity for Q↔Q ANN;
  you never invent or pass those questions. When you search, use the same probe family. This helps in finding relevant memories using the Semantic search via tools.

Links between Memories are only two kinds (nothing else):
- **PARENT_OF** — hierarchy. source = parent (broader container), target = child (more specific).
  Example: "React hooks" PARENT_OF "useEffect cleanup".
- **RELATES_TO** — association without hierarchy.
  Example: "Zustand" RELATES_TO "Redux" as alternative mental models.

The graph is how the user's learnings stay connected: parents and children for structure, relates for lateral connections.
Semantic search finds nodes by matching search questions to stored MemoryQuestions (Q↔Q); links are the explicit web you weave.

## What belongs in the knowledge base
Store (weave):
- Concepts, definitions, and mental models the user has learnt
- Corrections and refinements of earlier knowledge (update the same memory when you have its id)
- Relationships that should stay visible (parent/child or related)

Skip (do not weave):
- Pure chitchat and social filler
- One-off logistics with no lasting value
- Secrets or sensitive data they did not mean to keep as knowledge
- Anything too vague to be a useful node — if load-bearing but fuzzy, distill into a clear small memory first

When unsure: ask the user for clarification before adding to or modifying the knowledge base.
Prefer many small single-concept memories over one mega-note.

Rules:
- **Content-only updates** (upsert with id for name/content/impression/confidence) change knowledge only;
  structure and geometry are separate.
- **Structure**: create nodes, then set correct PARENT_OF links (parent→child; at most one PARENT_OF parent per child).
  You own semantic edges, not coordinates.

Your job for structure is **semantic**: good names, clear content, correct PARENT_OF vs RELATES_TO, correct parent→child direction.`;
