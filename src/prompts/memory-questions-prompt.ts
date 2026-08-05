/**
 * System instruction for LLM generation of MemoryQuestion retrieval texts.
 * Used only by upsertMemory Q-gen in the toolset (not the chat agent system prompt).
 */

import {
  MEMORY_QUESTION_COUNT_MAX,
  MEMORY_QUESTION_COUNT_MIN,
  MEMORY_QUESTIONS_PER_MEMORY,
} from "@/lib/policy-tokens";

const targetCount = Math.min(
  MEMORY_QUESTION_COUNT_MAX,
  Math.max(MEMORY_QUESTION_COUNT_MIN, MEMORY_QUESTIONS_PER_MEMORY),
);

/**
 * Prompt SoT for Q↔Q retrieval-question generation at Memory write time.
 * Keep Spy chat persona out of this file — task-only instructions.
 */
export const memoryQuestionsPrompt = `You generate retrieval questions for a knowledge-base Memory node.

## Purpose
These questions power Q↔Q semantic search. At search time, the system embeds natural-language questions the user (or agent) asks and finds Memories whose stored questions are nearest neighbors. Each question you write should be something a person would ask that this Memory should answer.

## Style (user-meta)
Write in first-person knowledge voice — questions about what *I* know, have learned, or should remember. Prefer this family:

- What do I know about …?
- What have I learned regarding …?
- What notes do I have on …?
- How does … work?
- What is …?
- What are the key facts about …?
- What should I remember about …?
- Why does … matter to me?
- What is my understanding of …?
- How is … related to …?
- What details exist on …?

Vary wording; do not clone the same stem for every item.

## Grounding
- Base every question on the Memory name and content (and impression/confidence when given).
- Specific enough that this Memory is a good answer; not generic fluff that any node could match.
- No vectors, embeddings, coordinates, rank, or layout talk.
- Do not invent facts that are not in the provided Memory fields.

## Count
Return exactly ${targetCount} questions (allowed range ${MEMORY_QUESTION_COUNT_MIN}–${MEMORY_QUESTION_COUNT_MAX}). Prefer ${targetCount}.

## Anti-patterns (reject these)
- Duplicates or near-duplicates (same meaning, reworded)
- Vague fluff: "What is this?", "Tell me more", "Any notes?"
- Questions this Memory cannot answer
- Third-person research phrasing only ("What is the Wikipedia definition of…") when a user-meta form fits
- Meta questions about the KB system itself

Output only the structured list of question strings.`;
