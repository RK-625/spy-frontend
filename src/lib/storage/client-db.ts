import Dexie, { type Table } from "dexie";

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
  attachments: StoredDraftAttachment[];
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
