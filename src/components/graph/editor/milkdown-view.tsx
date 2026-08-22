"use client";

import {
  defaultValueCtx,
  Editor,
  editorViewOptionsCtx,
  rootCtx,
} from "@milkdown/kit/core";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { useEffect, useRef } from "react";

import "./milkdown-view.css";

export type MilkdownViewProps = {
  documentText: string;
  readOnly: boolean;
  onDocumentTextChange?: (next: string) => void;
};

function MilkdownEditor({
  documentText,
  readOnly,
  onDocumentTextChange,
}: MilkdownViewProps) {
  const readOnlyRef = useRef(readOnly);
  const onDocumentTextChangeRef = useRef(onDocumentTextChange);

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  useEffect(() => {
    onDocumentTextChangeRef.current = onDocumentTextChange;
  }, [onDocumentTextChange]);

  useEditor((container) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container);
        ctx.set(defaultValueCtx, documentText);
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          editable: () => !readOnlyRef.current,
        }));

        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (readOnlyRef.current) return;
          if (markdown === prevMarkdown) return;
          onDocumentTextChangeRef.current?.(markdown);
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(listener);
  }, [documentText]);

  return <Milkdown />;
}

/**
 * CommonMark + GFM WYSIWYG over `node.content`. Markdown string stays source of truth.
 */
export function MilkdownView(props: MilkdownViewProps) {
  return (
    <div
      className="milkdown-pane min-h-0 flex-1 overflow-y-auto"
      data-readonly={props.readOnly ? "true" : "false"}
    >
      <MilkdownProvider>
        <MilkdownEditor {...props} />
      </MilkdownProvider>
    </div>
  );
}
