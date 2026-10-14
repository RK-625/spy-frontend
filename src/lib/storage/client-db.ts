import Dexie, { type Table } from "dexie";
import type { StoredPromptQuote } from "@/types/chat";

export interface StoredDraftAttachment {
  id: string;
  filename: string;
  mediaType: string;
  blob: Blob;
}

export interface PromptDraftRecord {
  chatId: string;
  text: string;
  model: string;
  mode: string;
  useWebSearch: boolean;
  useExcalidraw: boolean;
  /** Optional: drafts saved before build mode lack it. */
  useBuildMode?: boolean;
  attachments: StoredDraftAttachment[];
  quotes?: StoredPromptQuote[];
  updatedAt: number;
}

export class SpyClientDatabase extends Dexie {
  drafts!: Table<PromptDraftRecord, string>;

  constructor() {
    super("SpyClientDatabase");
    this.version(1).stores({
      drafts: "chatId, updatedAt",
    });
  }
}

let clientDbInstance: SpyClientDatabase | null = null;

export function getClientDb(): SpyClientDatabase | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!clientDbInstance) {
    clientDbInstance = new SpyClientDatabase();
  }
  return clientDbInstance;
}
