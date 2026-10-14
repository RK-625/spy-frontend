"use client";

import { useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import { useGraphTopology } from "@/contexts/GraphTopologyContext";
import {
  buildNotesForest,
  indexNotesFamilies,
  getNotePath,
  getNoteTitle,
} from "@/lib/notes/hierarchy";
import {
  createNoteLearningSnapshot,
  noteLearningReducer,
  getNoteLearningCounts,
} from "@/lib/notes/session";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { NOTE_NAVIGATION_EVENT } from "@/lib/notes/navigation";
import { FAMILY_SLIDE, MOTION } from "@/lib/motion";
import {
  NoteLearningActions,
  LearningSummaryFooter,
} from "./learning/learning-actions";
import { LearningSummary } from "./learning/learning-summary";
import {
  LearningNavigation,
  LearningProgress,
} from "./learning/learning-navigation";
import { NoteDocument } from "./document/note-document";
import { NoteHeader } from "./navigation/note-header";
import type { MemoryNode } from "@/types/graph-schema";

/** Shared ready/loading/error chrome; unmounting the route discards local learning. */
export function NoteWorkspace({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  const router = useRouter();
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.defaultPrevented && event.key === "Escape")
        router.push("/notes");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);
  return (
    <div
      role="region"
      aria-label="Note"
      className="@container relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface-chat"
    >
      {header ?? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="note-control absolute top-6 right-6 z-10"
          onClick={() => router.push("/notes")}
          aria-label="Close note"
        >
          <X aria-hidden="true" strokeWidth={1.5} />
        </Button>
      )}
      {children}
      {footer}
    </div>
  );
}

export function NoteReadyBody({ node }: { node: MemoryNode }) {
  const { topology, loading, error, retry } = useGraphTopology();
  const families = useMemo(
    () =>
      indexNotesFamilies(
        buildNotesForest(topology?.memories ?? [], topology?.links ?? []),
      ),
    [topology],
  );
  const availableCount = useMemo(() => {
    const selectedFamily = families.get(node.id);
    return selectedFamily
      ? indexNotesFamilies([selectedFamily.node]).size
      : null;
  }, [families, node.id]);
  const [session, dispatch] = useReducer(noteLearningReducer, null);
  useEffect(() => {
    const resetSession = () => dispatch({ type: "exit" });
    window.addEventListener(NOTE_NAVIGATION_EVENT, resetSession);
    return () =>
      window.removeEventListener(NOTE_NAVIGATION_EVENT, resetSession);
  }, []);
  const reduceMotion = useReducedMotion();
  const scrollContainer = useRef<HTMLDivElement>(null);
  const counts = session ? getNoteLearningCounts(session) : null;
  const currentId = session
    ? session.mode === "revisit"
      ? session.revisitedNoteId!
      : session.snapshot.cardIds[session.currentIndex]
    : node.id;
  const currentNote = session ? session.snapshot.notes.get(currentId)! : node;
  const summary = session?.mode === "completed";
  const displayedId = summary ? session.snapshot.rootId : currentId;
  const livePath = getNotePath(families, node.id);
  const path = session
    ? session.snapshot.paths.get(displayedId)!
    : livePath.length
      ? livePath
      : [node];
  const viewKey = `${session?.mode ?? "document"}:${displayedId}`;
  const startSession = () => {
    const snapshot = createNoteLearningSnapshot(families, node.id);
    if (snapshot) dispatch({ type: "start", snapshot });
  };
  useEffect(() => {
    scrollContainer.current?.scrollTo({ top: 0, behavior: "instant" });
    if (summary || session?.mode === "revisit")
      scrollContainer.current?.focus({ preventScroll: true });
  }, [viewKey, summary, session?.mode]);

  const headerActions = (
    <NoteLearningActions
      session={session}
      availableCount={availableCount}
      loading={loading}
      onStart={startSession}
      dispatch={dispatch}
    />
  );
  const footer =
    session?.mode === "active" ? (
      <LearningNavigation
        firstCard={session.currentIndex === 0}
        processed={counts!.processed}
        total={counts!.total}
        onPrevious={() => dispatch({ type: "previous" })}
        onDecide={(outcome) => dispatch({ type: "decide", outcome })}
      />
    ) : summary ? (
      <LearningSummaryFooter
        processed={counts!.processed}
        total={counts!.total}
        canRestart={Boolean(availableCount)}
        onRestart={startSession}
      />
    ) : undefined;
  return (
    <NoteWorkspace
      header={
        <NoteHeader
          path={path}
          actions={headerActions}
          onNavigate={() => dispatch({ type: "exit" })}
        />
      }
      footer={footer}
    >
      {session ? (
        <LearningProgress processed={counts!.processed} total={counts!.total} />
      ) : null}
      {error && !topology && !session ? (
        <div
          role="status"
          className="flex items-center gap-2 px-6 text-sm text-text-secondary"
        >
          Couldn&apos;t load learning notes.
          <Button variant="ghost" className="note-control" onClick={retry}>
            Retry
          </Button>
        </div>
      ) : null}
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {summary
          ? `Session complete. ${counts!.reviewed} reviewed, ${counts!.skipped} skipped.`
          : session
            ? `${session.mode === "active" ? `Note ${session.currentIndex + 1} of ${counts!.total}.` : "Revisiting."} ${getNoteTitle(currentNote)}`
            : ""}
      </p>
      <div
        role="region"
        ref={scrollContainer}
        tabIndex={-1}
        aria-label={summary ? "Session summary" : "Note document"}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-4 outline-none"
      >
        <AnimatePresence
          initial={false}
          mode="wait"
          custom={session?.direction ?? 1}
          onExitComplete={() =>
            scrollContainer.current?.scrollTo({ top: 0, behavior: "instant" })
          }
        >
          <motion.div
            key={viewKey}
            custom={session?.direction ?? 1}
            variants={reduceMotion ? undefined : FAMILY_SLIDE}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={reduceMotion ? { duration: 0 } : MOTION.familySlide}
          >
            {summary ? (
              <LearningSummary
                session={session}
                reviewed={counts!.reviewed}
                skipped={counts!.skipped}
                onExpand={(noteId, expanded) =>
                  dispatch({ type: "expand", noteId, expanded })
                }
                onRevisit={(noteId) => dispatch({ type: "revisit", noteId })}
              />
            ) : (
              <NoteDocument node={currentNote} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </NoteWorkspace>
  );
}
