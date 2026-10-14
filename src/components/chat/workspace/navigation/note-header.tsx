import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
} from "@/components/ui";
import { getNoteTitle } from "@/lib/notes/hierarchy";
import type { MemoryNode } from "@/types/graph-schema";

export function NoteHeader({
  path,
  actions,
  onNavigate,
}: {
  path: MemoryNode[];
  actions: ReactNode;
  onNavigate: () => void;
}) {
  return (
    <header
      className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 pt-6 pb-4"
      data-note-header
    >
      <Breadcrumb className="min-w-0 flex-1 basis-64">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/notes" onNavigate={onNavigate}>
                Notes
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {path.map((note, index) => (
            <Fragment key={note.id}>
              <BreadcrumbSeparator>/</BreadcrumbSeparator>
              <BreadcrumbItem className="min-w-0 wrap-anywhere">
                {index === path.length - 1 ? (
                  <BreadcrumbPage>{getNoteTitle(note)}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      href={`/notes/${encodeURIComponent(note.id)}`}
                      onNavigate={onNavigate}
                    >
                      {getNoteTitle(note)}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2 text-sm">
        {actions}
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="note-control"
          aria-label="Close note"
        >
          <Link href="/notes">
            <X aria-hidden="true" strokeWidth={1.5} />
          </Link>
        </Button>
      </div>
    </header>
  );
}
