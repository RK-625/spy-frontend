import { serializerCtx } from "@milkdown/kit/core";
import { Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

export function isEditingBlock(view: EditorView): boolean {
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.spec.code || ["list_item", "table", "table_row", "table_cell", "table_header"].includes(node.type.name)) return true;
  }
  return false;
}

export function createComposerPlugin({ onMarkdownChange, onFiles, onEmptyBackspace }: {
  onMarkdownChange: (markdown: string) => void;
  onFiles: (files: File[]) => void;
  onEmptyBackspace: () => boolean;
}) {
  return $prose((ctx) => new Plugin({
    view: () => ({
      update: (view, previousState) => {
        if (previousState.doc.eq(view.state.doc)) return;
        const markdown = view.state.doc.content.size === 2 && !view.state.doc.textContent
          ? ""
          : ctx.get(serializerCtx)(view.state.doc);
        onMarkdownChange(markdown);
      },
    }),
    props: {
      handleKeyDown: (view, event) => {
        if (event.key === "Backspace" && view.state.doc.content.size === 2 && !view.state.doc.textContent && onEmptyBackspace()) {
          event.preventDefault();
          return true;
        }
        if (event.key !== "Enter" || event.shiftKey || event.isComposing || view.composing || event.keyCode === 229 || isEditingBlock(view)) return false;
        // Match the existing textarea: Enter submits only when the form allows it.
        event.preventDefault();
        const form = view.dom.closest("form");
        const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (submit && !submit.disabled) form?.requestSubmit();
        return true;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.items ?? [])
          .filter((item) => item.kind === "file")
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null);
        if (files.length === 0) return false;
        event.preventDefault();
        onFiles(files);
        return true;
      },
      handleDrop: (_view, event) => {
        // The prompt form's existing drop handler validates and attaches files.
        return Boolean(event.dataTransfer?.files.length);
      },
    },
  }));
}
