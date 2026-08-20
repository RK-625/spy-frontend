"use client";

import { markdown } from "@codemirror/lang-markdown";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import {
  Compartment,
  EditorState,
  type Extension,
} from "@codemirror/state";
import { drawSelection, EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef } from "react";

import {
  Button,
  Dialog as EditorDialog,
  DialogClose as EditorClose,
  DialogContent as EditorContent,
  DialogHeader as EditorHeader,
  DialogTitle as EditorTitle,
} from "@/components/ui";
import { DotMatrixIcon } from "@/components/dotmatrix";
import type { MemoryNode } from "@/types/graph-schema";

import { editorTheme } from "./theme";

export type EditorProps = {
  node: MemoryNode;
  onClose: () => void;
  readOnly?: boolean;
  onDocumentTextChange?: (next: string) => void;
};

function formatConfidence(value: number | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return `${pct}%`;
}

function readOnlyExtensions(readOnly: boolean): Extension {
  return [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)];
}

function createEditorExtensions({
  documentTextRef,
  onDocumentTextChangeRef,
  readOnly,
  readOnlyCompartment,
}: {
  documentTextRef: { current: string };
  onDocumentTextChangeRef: {
    current: EditorProps["onDocumentTextChange"];
  };
  readOnly: boolean;
  readOnlyCompartment: Compartment;
}): Extension[] {
  return [
    markdown(),
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    search(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    editorTheme,
    readOnlyCompartment.of(readOnlyExtensions(readOnly)),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const next = update.state.doc.toString();
      if (next === documentTextRef.current) return;
      onDocumentTextChangeRef.current?.(next);
    }),
  ];
}

function SourceView({
  documentText,
  readOnly,
  onDocumentTextChange,
}: {
  documentText: string;
  readOnly: boolean;
  onDocumentTextChange?: (next: string) => void;
}) {
  const hostElementRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const readOnlyCompartmentRef = useRef(new Compartment());
  const documentTextRef = useRef(documentText);
  const onDocumentTextChangeRef = useRef(onDocumentTextChange);

  useEffect(() => {
    documentTextRef.current = documentText;
  }, [documentText]);

  useEffect(() => {
    onDocumentTextChangeRef.current = onDocumentTextChange;
  }, [onDocumentTextChange]);

  useEffect(() => {
    const host = hostElementRef.current;
    if (!host) return;

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: documentTextRef.current,
        extensions: createEditorExtensions({
          documentTextRef,
          onDocumentTextChangeRef,
          readOnly,
          readOnlyCompartment: readOnlyCompartmentRef.current,
        }),
      }),
    });
    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
    // Host + destroy only. Doc swaps dispatch below; node switches remount via key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    if (view.state.doc.toString() === documentText) return;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: documentText,
      },
    });
  }, [documentText]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(
        readOnlyExtensions(readOnly),
      ),
    });
  }, [readOnly]);

  return (
    <div
      className="min-h-0 flex-1 [&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-editor:focus]:outline-none [&_.cm-editor:focus-visible]:outline-none [&_.cm-scroller]:h-full"
      ref={hostElementRef}
    />
  );
}

/**
 * Memory inspect overlay — dark utility register, lavender accents.
 * Mount only when a node is selected; close clears that selection.
 */
export function Editor({
  node,
  onClose,
  readOnly = true,
  onDocumentTextChange,
}: EditorProps) {
  const title = node.name?.trim() || node.id || "Node";
  const content =
    node.content?.trim() || `No content woven for “${title}” yet.`;
  const confidenceLabel = formatConfidence(node.confidence);

  return (
    <EditorDialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
    >
      <EditorContent
        className="flex h-[min(88dvh,56rem)] w-[min(92vw,88rem)] max-w-none flex-col gap-3 overflow-hidden rounded-[var(--radius)] border-[var(--border-medium)] bg-[var(--surface-elevated)]/95 sm:max-w-none backdrop-blur-md"
        showCloseButton={false}
      >
        <EditorHeader className="shrink-0 flex-row items-center gap-3">
          <EditorTitle className="min-w-0 flex-1 truncate font-[family-name:var(--font-terminal)] text-lg tracking-widest text-primary uppercase">
            {title}
          </EditorTitle>
          {confidenceLabel ? (
            <span className="shrink-0 font-mono text-sm text-primary">
              {confidenceLabel}
            </span>
          ) : null}
          <EditorClose asChild>
            <Button
              variant="ghost"
              className="bg-secondary"
              size="icon-sm"
            >
              <DotMatrixIcon name="x" size={16} />
              <span className="sr-only">Close</span>
            </Button>
          </EditorClose>
        </EditorHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 text-sm">
          <div className="flex min-h-0 flex-1 flex-col rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 p-3">
            <SourceView
              documentText={content}
              key={node.id}
              onDocumentTextChange={onDocumentTextChange}
              readOnly={readOnly}
            />
          </div>

          {node.impression?.trim() ? (
            <div className="shrink-0 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50 p-3">
              <div className="mb-1.5 text-[0.7rem] tracking-wider text-text-secondary uppercase">
                Impression
              </div>
              <p className="max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed text-text-primary">
                {node.impression.trim()}
              </p>
            </div>
          ) : null}
        </div>
      </EditorContent>
    </EditorDialog>
  );
}
