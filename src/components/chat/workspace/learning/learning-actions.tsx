import type { Dispatch } from "react";
import { Play, RotateCcw } from "lucide-react";
import { Button, Separator } from "@/components/ui";
import type {
  NoteLearningAction,
  NoteLearningSession,
} from "@/lib/notes/session";

export function NoteLearningActions({
  session,
  availableCount,
  loading,
  onStart,
  dispatch,
}: {
  session: NoteLearningSession | null;
  availableCount: number | null;
  loading: boolean;
  onStart: () => void;
  dispatch: Dispatch<NoteLearningAction>;
}) {
  if (session)
    return (
      <>
        <span className="font-mono text-xs text-text-secondary">
          {session.mode === "active"
            ? `Learning · ${session.currentIndex + 1} / ${session.snapshot.cardIds.length}`
            : "Session complete"}
        </span>
        {session.mode === "revisit" ? (
          <Button
            variant="ghost"
            className="note-control"
            onClick={() => dispatch({ type: "summary" })}
          >
            Back to summary
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="note-control"
          onClick={() => dispatch({ type: "exit" })}
        >
          Exit learning
        </Button>
      </>
    );
  return (
    <>
      <Button
        variant="ghost"
        className="note-control"
        disabled={!availableCount || loading}
        onClick={onStart}
      >
        <Play aria-hidden="true" data-icon="inline-start" strokeWidth={1.5} />
        Learn
      </Button>
      <span className="font-mono text-xs text-text-secondary">
        {availableCount
          ? `${availableCount} ${availableCount === 1 ? "note" : "notes"}`
          : loading
            ? "Loading…"
            : "Unavailable"}
      </span>
    </>
  );
}

export function LearningSummaryFooter({
  processed,
  total,
  canRestart,
  onRestart,
}: {
  processed: number;
  total: number;
  canRestart: boolean;
  onRestart: () => void;
}) {
  return (
    <footer className="shrink-0 px-6 pb-4">
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
        <span className="font-mono text-xs text-text-secondary">
          {processed} / {total} {total === 1 ? "note" : "notes"}
        </span>
        <Button
          variant="ghost"
          className="note-control"
          disabled={!canRestart}
          onClick={onRestart}
        >
          <RotateCcw
            aria-hidden="true"
            data-icon="inline-start"
            strokeWidth={1.5}
          />
          Learn again
        </Button>
      </div>
    </footer>
  );
}
