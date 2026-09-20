/**
 * Shared knowledge-graph ontology for chat (read) and graph (write).
 * Descriptive: shape, distillation, Q↔Q matching, probe style. Not write rules.
 */

import { MEMORY_SEARCH_MAX_QUESTIONS } from "@/lib/graph/policy";

export const GRAPH_ONTOLOGY = `## What a knowledge graph is
  The knowledge graph is a graph of nodes (Memories) and edges (Links).
  It is not a chat log, not a dump of every message, and not a content-ANN over stored prose.
  It is a structured, curated, continuously evolving map of the user's learnings.
  The graph already exists. Chat retrieves from it. A separate maintainer writes to it.

## Terminologies
  **Memories** are nodes. **Links** are edges. The graph evolves as the user learns, relearns, and refines.
  The **surface** is the chat interface — a doubt, a concept to learn, a quiz, a snippet, a vague idea, back-and-forth, a document, an article, a puzzle, or anything the user brings (**source / reference**).
  The **topic** is the boiled-down concept, principle, pattern, logic, fact, or idea derived from those sources/references.
  Surface is not topic. Source/reference on the surface is the raw material; topic is what remains after distillation.

## Schema
  Each Memory is one focused unit of knowledge, learning, logic, fact, or pattern:
  - **id** — primary key of the node
  - **name** — short title of the learning / concept / topic
  - **content** — facts / explanation / logic / description in rich markdown, written so it fits the user's existing graph
  - **impression** — Spy's read of how the user relates to this (grasp, confusion, interest, stance) — evolves as they learn or relearn
  - **confidence** — 0–1 how solid the user's grasp seems

  Links have only two kinds:
  - **PARENT_OF** — hierarchy: source = parent (broader container), target = child (more specific).
    Example: "React hooks" PARENT_OF "useEffect cleanup", "Gravitation" PARENT_OF "Kepler's Laws", "Physics" PARENT_OF "Gravitation", "Data Structures" PARENT_OF "Graphs".
  - **RELATES_TO** — association without hierarchy.
    Example: "Zustand" RELATES_TO "Redux" as alternative mental models.

  PARENT_OF is structure. RELATES_TO is lateral connection. That is how Memories stay connected.

## Surface → topic
  Whatever the surface carries — puzzle, question, doubt, article, syntax, fundamental, or a direct ask from any platform — distill to the reusable principle.
  Strip surface identifiers, wrappers, narrative, and instantiation. Keep the pattern, logic, principle, idea, fact, or concept.
  Exception: surface ≈ topic. If they asked about the source/reference itself (OOP, TCP, Java classes), the source *is* the topic.

  Examples (source/reference on the surface → topic):
  - LC 198 House Robber → DP on arrays
  - MCM / top-down vs bottom-up on a DP problem → the DP / MCM pattern
  - useContext snippet / framework syntax → Context / hooks
  - Raft paper / article → Raft / consensus
  - "Why does a handshake fail?" → TCP handshake
  - "Explain OOP" / Java classes / a networking fundamental → that topic (surface ≈ topic)
  - Java "synchronized" doubt → Java concurrency

  Distillation is enough for search: match the topic family, not the wrapper.

## How retrieval works (Q↔Q)
  Search does not compare against Memory content. The Memory never stores embeddings.
  Search embeds **search probes** and runs ANN against stored **MemoryQuestion** probes. Hits resolve back to the Memory.
  Links are explicit edges between Memories; they are not this matching path.

## Probe cookbook
  Voice: third-person, agent-stateful, about the user's knowledge of the **topic** — not the surface wrapper.
  Prefer "Has the user studied / seen / learned / worked with / is familiar with …?"
  Do not put the surface source/reference in the probe unless surface ≈ topic.

  Two jobs, same grammar:

  **Search probes** (chat and graph): this turn, find related Memories. Classify surface → topic, then pass 1–${MEMORY_SEARCH_MAX_QUESTIONS} probes covering that topic's **family**. Job = recall outward.

  **Retrieval probes**: style only here. Job = make *this* Memory findable later (recall inward). Chat reads this so it knows what it is matching. Graph is the only author of retrieval probes.

  Worked family: a Memory named "Dijkstra's algorithm" stores probes spanning Dijkstra, shortest paths, and graph pathfinding — not only the title. Later, the search probe "Does the user know about shortest-path algorithms?" can hit it.

  Surface-type rows (surface → topic → good search probes → one bad):
  - LC 198 House Robber → DP on arrays → "Has the user studied DP on arrays?", "Does the user know about linear DP on arrays?", "Has the user worked with house-robber-style DP?" — not "Has the user seen LeetCode 198 House Robber?"
  - Raft paper → Raft / consensus → "Has the user studied Raft?", "Does the user know about consensus algorithms?", "Has the user learned leader election?" — not "Has the user read the Raft paper?"
  - "Why does a handshake fail?" → TCP handshake → "Has the user studied the TCP handshake?", "Does the user know about the three-way handshake?", "Is the user familiar with SYN/ACK?" — not "Does the user understand why a handshake fails?"
  - "Explain OOP" → OOP (surface ≈ topic) → "Has the user studied OOP?", "Does the user know about encapsulation and polymorphism?", "Has the user worked with object-oriented design?" — not "Has the user asked to explain OOP?"

  Synonym rule: do not only restate the Memory title. Vary stems. Cover related concepts the Memory actually supports — not claims it does not.

  Reject:
  - First-person user-meta ("What do I know about…?", "What have I learned regarding…?")
  - Surface / platform ids ("Has the user seen LeetCode 3622 Check Divisibility by Digit Sum and Product?")
  - Puzzle narrative ("Does the user understand Alice and Bob win conditions for Sum Game?")
  - Title-only clones of the Memory name
  - Vague fluff ("What is this?", "Tell me more", "Does the user know things?")
  - Wikipedia-only phrasing with no user-knowledge frame ("What is Dijkstra?")

  Job contrast:
  Search probes are broad and for this turn — they fan out across a topic family to find what already exists.
  Retrieval probes are specific and for this Memory — they are the inward keys that later search should land on.
  Same third-person grammar. Different aim. Search does not store probes on the Memory.`;
