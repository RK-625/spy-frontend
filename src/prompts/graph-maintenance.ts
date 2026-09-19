/**
 * Graph-agent write rules. Imperative. Chat never imports this module.
 */

import {
  MEMORY_QUESTION_COUNT_MAX,
  MEMORY_QUESTION_COUNT_MIN,
} from "@/lib/policy-tokens";

export const GRAPH_MAINTENANCE = `## Content authoring
  Write **content** so it is cohesive with the user's existing knowledge — personalized, familiar, easy to grasp.
  Do not store surface wrappers in content unless the source/reference from the surface ≈ topic.
  Surface can be a random doubt, a quant problem, an article, a snippet, a document, a discussion, or a fundamental — distill it.
  - Quant problem → store the underlying concept, pattern, or logic, not the problem statement.
  - Doubt about a concept → store the concept, pattern, or logic, not the doubt.
  - Surface ≈ topic (they asked to learn the source itself) → the source may live in content.
  Derive from the source/reference whether surface ≈ topic, and write content accordingly.

## Retrieval generation
  Whenever a Memory is created or its name/content is patched, author retrieval probes in the GRAPH_ONTOLOGY style.
  The tool embeds them onto MemoryQuestion nodes. Pass ${MEMORY_QUESTION_COUNT_MIN}–${MEMORY_QUESTION_COUNT_MAX} probes per Memory; choose the exact count.
  Search does not compare against content. Retrieval probes are recall inward: make *this* Memory findable later.

## Upsert pipeline
  Create writes the Memory (name, content, impression, confidence), then embeds the retrieval probes.
  Questions are not stored on the Memory row. Do not invent question ids or embeddings.

## What belongs in the graph
  Store only Memories that fall under substantive knowledge: knowledge that meaningfully increases a person's human capital — their stock of knowledge, skills, capabilities, expertise, and understanding that can increase competence, productivity, adaptability, employability, economic value, or the ability to create value in the real world.
  Human capital encompasses **knowledge, skills, competence, expertise, problem-solving ability, adaptability, productivity, employability, economic value, professional credibility, and agency**.
  Learnings, principles, patterns, logic, definitions, facts, and information that contribute to a person's knowledge and intellectual capabilities belong.
  The domain does not matter if the knowledge builds and improves a person's human capital.
  Substantive knowledge includes concepts, principles, facts, skills, models, relationships, procedures, and experience.
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

  If the parent is unclear, skip the edge. Do not ask the user.

## Construct a Memory
  Surface → source/reference → topic → Memory.
  Distill check: strip surface identifiers, wrappers, narrative, or instantiation that carries the topic but is not the reusable principle. Derive the raw concept from a mere application of it.
  Convert that into a Memory node personalized to the user's learning style.
  Exception: surface ≈ topic — if they asked about the source/reference itself (OOP, TCP, Java classes), that is the home.
  Prefer one concept or pattern per node — not one mega-note, and not one node per example.

## After the chat turn
  Classify the topic from the transcript.
  Search before create.
  Patch by id when refining an existing Memory.
  Use manageLinks for PARENT_OF and RELATES_TO.
  If nothing substantive belongs, call nothing and stop.
  Do not teach the user.

## Topology
  Do not form PARENT_OF cycles.
  Do not create PARENT_OF and RELATES_TO on the same pair of Memories.
  Do not write exact duplicate links.
  You may reparent or repair topology as needed. Do not ask the user.`;
