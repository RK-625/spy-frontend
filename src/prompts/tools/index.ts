/**
 * Barrel for product-tool prompt modules (graph + web + ask + excalidraw).
 */

export {
  UPSERT_MEMORY_AGENT_BULLET,
  upsertMemoryToolDescription,
  upsertMemoryNameFieldDescription,
  upsertMemoryContentFieldDescription,
  upsertMemoryImpressionFieldDescription,
  upsertMemoryConfidenceFieldDescription,
  upsertMemoryIdFieldDescription,
  upsertMemoryQuestionsFieldDescription,
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

export { EXCALIDRAW_AGENT_BULLET } from "./excalidraw";

export {
  ASK_USER_QUESTION_AGENT_BULLET,
  askUserQuestionToolDescription,
  askUserQuestionQuestionFieldDescription,
  askUserQuestionOptionsFieldDescription,
  askUserQuestionAllowCustomInputFieldDescription,
} from "./ask-user-question";
