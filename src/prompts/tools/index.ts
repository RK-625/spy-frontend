/**
 * Barrel for product-tool prompt modules (weave + web + ask).
 */

export {
  MEMORY_QUESTION_COUNT_TARGET,
  MEMORY_QUESTIONS_USER_PROMPT_PREFIX,
  UPSERT_MEMORY_AGENT_BULLET,
  memoryQuestionsGenerationSystem,
  upsertMemoryToolDescription,
  upsertMemoryNameFieldDescription,
  upsertMemoryContentFieldDescription,
  upsertMemoryImpressionFieldDescription,
  upsertMemoryConfidenceFieldDescription,
  upsertMemoryIdFieldDescription,
} from "./upsert-memory";

export {
  MEMORY_SEARCH_AGENT_RECALL_STYLE,
  SEARCH_MEMORIES_AGENT_BULLET,
  searchMemoriesQuestionsFieldDescription,
  searchMemoriesToolDescription,
} from "./search-memories";

export {
  GET_MEMORIES_AGENT_BULLET,
  getMemoriesToolDescription,
  getMemoriesIdFieldDescription,
  getMemoriesHopsFieldDescription,
  getMemoriesLinkTypesFieldDescription,
} from "./get-memories";

export {
  MANAGE_LINKS_AGENT_BULLET,
  manageLinksToolDescription,
  manageLinksRemoveFieldDescription,
  manageLinksUpsertFieldDescription,
} from "./manage-links";

export {
  WEB_SEARCH_AGENT_BULLET,
  webSearchToolDescription,
  webSearchQueryFieldDescription,
} from "./web-search";

export {
  ASK_USER_QUESTION_AGENT_BULLET,
  askUserQuestionToolDescription,
  askUserQuestionQuestionFieldDescription,
  askUserQuestionOptionsFieldDescription,
  askUserQuestionAllowCustomInputFieldDescription,
} from "./ask-user-question";
