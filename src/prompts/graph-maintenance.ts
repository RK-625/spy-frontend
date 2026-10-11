/**
 * Graph-agent write rules. Imperative. Used by the graph agent and by build-mode chat;
 * normal chat does not import this module.
 */

import {
  MEMORY_QUESTION_COUNT_MAX,
  MEMORY_QUESTION_COUNT_MIN,
} from "@/lib/graph/policy";

export const GRAPH_MAINTENANCE =
`## Content authoring
  Write **content** so it is cohesive with the user's existing knowledge — personalized, familiar, easy to grasp.
  Do not store surface material in content unless the surface ≈ topic.

## Retrieval generation
  Whenever a Memory is created or its name/content is patched, author retrieval probes in the GRAPH_ONTOLOGY style.
  The tool embeds them onto MemoryQuestion nodes. Pass ${MEMORY_QUESTION_COUNT_MIN}–${MEMORY_QUESTION_COUNT_MAX} probes per Memory; choose the exact count.

## Upsert pipeline
  Create writes the Memory (name, content, impression, confidence), then embeds the retrieval probes.
  Questions are not stored on the Memory row. Do not invent question ids or embeddings.

## What belongs in the graph
  Store only Memories that fall under substantive knowledge: principles, patterns, concepts, skills, logic, facts, or models that meaningfully expand the user's intellectual capabilities, problem-solving ability, or domain expertise, regardless of domain.
  From the surface, derive the topic from the source/reference. Store it if it is substantive; otherwise skip.

  Store:
  - Concepts, facts, technicalities, descriptions, patterns, logic, tools, and mental models the user has learned or relearned that are substantive
  - Corrections and refinements of earlier knowledge (patch the same Memory by id)
  - Relationships that should stay visible (PARENT_OF or RELATES_TO)

  Skip:
  - Anything that is not substantive knowledge
  - Pure chitchat and social filler
  - One-off logistics with no lasting value
  - Secrets or sensitive data they did not mean to keep as knowledge
  - Anything too vague to be a useful Memory

  If the parent is unclear, skip the edge.

## Construct a Memory
  Surface → source/reference → topic → Memory.
  Apply Surface → Topic distillation per GRAPH_ONTOLOGY before creating a Memory.
  Prefer one concept or pattern per node — not one mega-note, and not one node per example.

## Topology
  Do not form PARENT_OF cycles.
  Do not create PARENT_OF and RELATES_TO on the same pair of Memories.
  Do not write exact duplicate links.
  You may reparent or repair topology as needed.`;
