import { MilkdownView } from "@/components/graph/editor/milkdown-view";
import type { MemoryNode } from "@/types/graph-schema";

function formatConfidence(value: number | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return `${pct}%`;
}

/** Ready document: title, read-only Milkdown, impression. */
export function NoteDocument({ node }: { node: MemoryNode }) {
  const title = node.name?.trim() || node.id || "Note";
  const confidenceLabel = formatConfidence(node.confidence);
  const documentText =
    node.content?.trim() || `No content woven for “${title}” yet.`;
  const impression = node.impression?.trim();

  return (
    <>
      <header className="flex shrink-0 items-start gap-3">
        <h1 className="min-w-0 flex-1 wrap-break-word font-sans text-[1.75rem] font-semibold tracking-wide text-text-primary uppercase">
          {title}
        </h1>
        {confidenceLabel ? (
          <span className="shrink-0 font-mono text-sm text-text-secondary">
            {confidenceLabel}
          </span>
        ) : null}
      </header>

      <div className="mt-4 shrink-0">
        <MilkdownView
          key={node.id}
          documentText={documentText}
          readOnly={true}
          scrollMode="document"
        />
      </div>

      {impression ? (
        <section className="mt-4 shrink-0">
          <div className="text-[0.7rem] font-medium tracking-wider text-text-secondary uppercase">
            IMPRESSION
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
            {impression}
          </p>
        </section>
      ) : null}
    </>
  );
}
