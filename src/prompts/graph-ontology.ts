/**
 * Shared knowledge-graph ontology for chat (read) and graph (write).
 * Descriptive: shape, distillation, Q↔Q matching, probe style. Not write rules.
 */

import {
  MEMORY_QUESTION_COUNT_MAX,
  MEMORY_QUESTION_COUNT_MIN,
  MEMORY_SEARCH_MAX_QUESTIONS,
} from "@/lib/graph/policy";

export const GRAPH_ONTOLOGY =
`
## What a knowledge graph is
  The knowledge graph is a graph of nodes (Memories) and edges (Links).
  It is a structured, curated, continuously evolving map of the user's learnings.

## Terminologies
  **Memories** are nodes. **Links** are edges. The graph evolves as the user learns, relearns, and refines.
  The **surface** is the chat interface — where the user brings a doubt, a concept , a quiz, a snippet, a vague idea, back-and-forth, a document, an article, a puzzle, or anything the user brings (**source / reference**).
  The **topic** is the boiled-down concept, first principles, pattern, logic, fact, or idea derived from the surface.
  Surface is not topic. Surface has the raw material; topic is what remains after distillation of the raw material.

## Schema
  Each Memory is one focused unit of knowledge, principle, pattern, logic, fact, or idea:
  - **id** — primary key of the node
  - **name** — short title of the learning / concept / topic
  - **content** — facts / explanation / logic / description in rich markdown, written so it fits the user's existing graph
  - **impression** — Spy's read of how the user relates to this (grasp, confusion, interest, stance) — evolves as they learn or relearn
  - **confidence** — 0–1 how solid the user's grasp seems

  Retrieval probes & embeddings attachment:
  - Each Memory node has satellite **MemoryQuestion** nodes attached via:
    (:MemoryQuestion {id, text, questionEmbedding})-[:FOR_MEMORY]->(:Memory)
  - Memory nodes never store vector embeddings directly; embeddings live exclusively on MemoryQuestion.questionEmbedding for vector ANN search.

  Links have only two kinds:
  - **PARENT_OF** — hierarchy: source = parent (broader container), target = child (more specific).
    Example: "React hooks" PARENT_OF "useEffect cleanup", "Gravitation" PARENT_OF "Kepler's Laws", "Physics" PARENT_OF "Gravitation", "Data Structures" PARENT_OF "Graphs".
  - **RELATES_TO** — association without hierarchy.
    Example: "Zustand" RELATES_TO "Redux" as alternative mental models.

  PARENT_OF is structure. RELATES_TO is lateral connection. That is how Memories stay connected.


## Surface → Topic
  Whatever the surface carries — puzzle, question, doubt, article, syntax, fundamental, or a direct ask from any platform — distill to the reusable first principle.
  Strip surface identifiers, wrappers, narrative, and instantiation. Keep the pattern, logic, principle, idea, fact, or concept.
  Exception: surface ≈ topic. If they asked about the source/reference itself (OOP, TCP, Java classes) that is already fundamental then the surface *has* the topic already.

  Examples (source/reference on the surface → topic):
  - LeetCode 198 House Robber → DP on arrays
  - MCM / top-down vs bottom-up on a DP problem → the DP / MCM pattern
  - useContext snippet / framework syntax → Context / hooks
  - Raft paper / article → Raft / consensus
  - "Why does a handshake fail?" → TCP handshake
  - "Explain OOP" / Java classes / a networking fundamental → that topic (surface ≈ topic)
  - Java "synchronized" doubt → Java concurrency

## How retrieval works (Q↔Q)
  Search does not compare against Memory content. The Memory never stores embeddings.
  Search embeds **search probes** and runs ANN against stored **MemoryQuestion** probes. Hits resolve back to the Memory.
  Links are explicit edges between Memories; they are not this matching path.

## Probe cookbook
  Tone: third-person, agent-stateful, about the user's knowledge of the **topic** — not the surface wrapper.
  Prefer "Has the user studied / seen / learned / worked with / is familiar with …? {TOPIC}"
  Do not any put the surface material in the probe unless surface ≈ topic.

  Two jobs, same grammar:

  **Search probes** : Used, find related Memories. Classify surface → topic, then pass 1–${MEMORY_SEARCH_MAX_QUESTIONS} probes covering that topic's **family**.

  **Retrieval probes**: Used during storing a Memory to make it findable (later during search). Pass ${MEMORY_QUESTION_COUNT_MIN}–${MEMORY_QUESTION_COUNT_MAX} probes covering inward keys for that specific Memory.

  Search probes are broad they fan out across a topic family to find what already exists.
  Search does not store probes on the Memory.
  Retrieval probes are specific for the Memory they are the inward keys that later search should land on.

 Example for probes:
  - LC 198 House Robber → DP on arrays → "Has the user studied DP on arrays?", "Does the user know about linear DP on arrays?", "Has the user worked with house-robber-style DP?" — not "Has the user seen LeetCode 198 House Robber?"
  - Raft paper → Raft / consensus → "Has the user studied Raft?", "Does the user know about consensus algorithms?", "Has the user learned leader election?", "Has the user read the Raft paper?"
  - "Why does a handshake fail?" → TCP handshake → "Has the user studied the TCP handshake?", "Does the user know about the three-way handshake?", "Is the user familiar with SYN/ACK?" — not "Does the user understand why a handshake fails?"
  - "Explain OOP" → OOP (surface ≈ topic) → "Has the user studied OOP?", "Does the user know about encapsulation and polymorphism?", "Has the user worked with object-oriented design?" — not "Has the user asked to explain OOP?"

  Synonym rule: Keep the probes varied instead of repeating the same phrasing or topic title; use diverse synonyms, related concepts, and varied phrasing so different search angles can match both during search and storing a Memory.

  Reject:
  - First-person search probes ("What do I know about…?", "What have I learned regarding…?")
  - Surface content in search probes for Example ("Has the user seen LeetCode 3622 Check Divisibility by Digit Sum and Product?",
    "","Does the user understand Alice and Bob win conditions for Sum Game?")
  - Vague fluff ("What is this?", "Tell me more", "Does the user know things?")
  - Wikipedia-only phrasing with no user-knowledge frame ("What is Dijkstra?")
`;
