import { Suspense, type ReactNode } from "react";
import { getMemory } from "@/lib/graph/falkor";
import { NoteReadyBody, NoteWorkspace } from "@/components/chat";
import { DotmHex9 } from "@/components/dotmatrix";
import type { MemoryNode } from "@/types/graph-schema";

type NoteLoad = { ok: true; note: MemoryNode | null } | { ok: false };

export const runtime = "nodejs";

function NoteByIdStatus({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className="flex min-h-0 flex-1 flex-col items-center justify-center"
    >
      {children}
    </div>
  );
}

async function NoteByIdBody({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;

  let noteId: string;
  try {
    noteId = decodeURIComponent(rawId).trim();
  } catch {
    return (
      <NoteByIdStatus ariaLabel="Note not found">
        <p className="text-sm text-text-secondary">Note not found.</p>
      </NoteByIdStatus>
    );
  }
  if (!noteId) {
    return (
      <NoteByIdStatus ariaLabel="Note not found">
        <p className="text-sm text-text-secondary">Note not found.</p>
      </NoteByIdStatus>
    );
  }

  let load: NoteLoad;
  try {
    load = { ok: true, note: await getMemory(noteId) };
  } catch (error) {
    console.error("note getMemory:", error);
    load = { ok: false };
  }

  if (!load.ok) {
    return (
      <NoteByIdStatus ariaLabel="Couldn't load notes">
        <p className="text-sm text-text-secondary">Couldn&apos;t load notes</p>
      </NoteByIdStatus>
    );
  }
  if (!load.note) {
    return (
      <NoteByIdStatus ariaLabel="Note not found">
        <p className="text-sm text-text-secondary">Note not found.</p>
      </NoteByIdStatus>
    );
  }
  return <NoteReadyBody node={load.note} />;
}

/**
 * Read-only note at `/notes/[id]`. Chrome is immediate; body awaits
 * `getMemory`. Unknown id stays on this route — never redirects to `/chat`.
 */
export default function NoteByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <NoteWorkspace>
      <Suspense
        fallback={
          <NoteByIdStatus ariaLabel="Loading note">
            <DotmHex9 animated={true} />
          </NoteByIdStatus>
        }
      >
        <NoteByIdBody params={params} />
      </Suspense>
    </NoteWorkspace>
  );
}
