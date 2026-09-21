import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notes · Spy",
};

/**
 * Notes master with no note selected (`/notes`). TRI-08 blank detail.
 * Empty forest copy lives in the sidebar tree, not this column.
 */
export default function NotesPage() {
  return (
    <div
      role="region"
      aria-label="Notes"
      className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface-chat"
    />
  );
}
