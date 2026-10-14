import { Check, Folder, FolderOpen, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui";
import { getNoteTitle, type NotesForestNode } from "@/lib/notes/hierarchy";
import type {
  NoteLearningOutcome,
  NoteLearningSession,
} from "@/lib/notes/session";
import { MOTION } from "@/lib/motion";

type SummaryTreeProps = {
  branch: NotesForestNode;
  outcomes: ReadonlyMap<string, NoteLearningOutcome>;
  expandedGroupIds: ReadonlySet<string>;
  onExpand: (noteId: string, expanded: boolean) => void;
  onRevisit: (noteId: string) => void;
  root?: boolean;
};

function SummaryBranch({
  branch,
  outcomes,
  expandedGroupIds,
  onExpand,
  onRevisit,
  root = false,
}: SummaryTreeProps) {
  const reduceMotion = useReducedMotion();
  const title = getNoteTitle(branch.note);
  const outcome = outcomes.get(branch.note.id);
  const expanded = expandedGroupIds.has(branch.note.id);
  const hasChildren = branch.children.length > 0;
  const FolderIcon = expanded ? FolderOpen : Folder;
  return (
    <li className={root ? undefined : "note-learning-branch"}>
      <Collapsible
        open={expanded}
        onOpenChange={(value) => onExpand(branch.note.id, value)}
      >
        <div className="note-learning-row">
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="note-control"
                aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}
              >
                <FolderIcon aria-hidden="true" strokeWidth={1.5} />
              </Button>
            </CollapsibleTrigger>
          ) : (
            <span className="note-learning-leaf-space size-8 shrink-0" aria-hidden="true" />
          )}
          <button
            type="button"
            className="note-learning-name"
            onClick={() => onRevisit(branch.note.id)}
          >
            {title}
            {outcome ? (
              <>
                {"\u00a0"}
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-text-secondary">
                  {outcome === "reviewed" ? (
                    <>
                      <Check
                        aria-hidden="true"
                        className="size-[1em]"
                        strokeWidth={1.5}
                      />
                      <span className="sr-only">Reviewed</span>
                    </>
                  ) : (
                    <>
                      <X
                        aria-hidden="true"
                        className="size-[1em]"
                        strokeWidth={1.5}
                      />
                      <span className="text-xs">Skipped</span>
                    </>
                  )}
                </span>
              </>
            ) : null}
          </button>
        </div>
        {hasChildren ? (
          <AnimatePresence initial={false}>
            {expanded ? (
              <CollapsibleContent forceMount asChild>
                <motion.div
                  key="children"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={
                    reduceMotion ? { duration: 0 } : MOTION.familySlide
                  }
                  className="overflow-hidden"
                >
                  <ul className="note-learning-children">
                    {branch.children.map((child) => (
                      <SummaryBranch
                        key={child.note.id}
                        branch={child}
                        outcomes={outcomes}
                        expandedGroupIds={expandedGroupIds}
                        onExpand={onExpand}
                        onRevisit={onRevisit}
                      />
                    ))}
                  </ul>
                </motion.div>
              </CollapsibleContent>
            ) : null}
          </AnimatePresence>
        ) : null}
      </Collapsible>
    </li>
  );
}

export function LearningSummary({
  session,
  reviewed,
  skipped,
  onExpand,
  onRevisit,
}: {
  session: NoteLearningSession;
  reviewed: number;
  skipped: number;
  onExpand: SummaryTreeProps["onExpand"];
  onRevisit: SummaryTreeProps["onRevisit"];
}) {
  return (
    <section aria-labelledby="learning-summary-title">
      <h1
        id="learning-summary-title"
        className="wrap-anywhere font-sans text-[1.75rem] font-semibold tracking-wide text-text-primary uppercase"
      >
        Session complete
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        {reviewed} reviewed · {skipped} skipped
      </p>
      <ul
        className="note-learning-tree mt-6"
        aria-label="Notes covered in this session"
      >
        <SummaryBranch
          root
          branch={session.snapshot.hierarchy}
          outcomes={session.outcomes}
          expandedGroupIds={session.expandedGroupIds}
          onExpand={onExpand}
          onRevisit={onRevisit}
        />
      </ul>
    </section>
  );
}
