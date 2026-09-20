import Dexie, { type Table } from "dexie";
import type { PromptDraftRecord } from "./prompt-draft-store";

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

export const clientDb = typeof window !== "undefined" ? getClientDb() : null;
