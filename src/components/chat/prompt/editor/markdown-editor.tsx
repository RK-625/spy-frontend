"use client";

import { defaultValueCtx, Editor, editorViewCtx, editorViewOptionsCtx, rootCtx } from "@milkdown/kit/core";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { history } from "@milkdown/kit/plugin/history";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { replaceAll } from "@milkdown/kit/utils";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { usePromptInputContext } from "../shell/context";
import { createComposerPlugin } from "./editor-plugins";

function ComposerEditor() {
  const { textInput, attachments, __registerComposerFocus } = usePromptInputContext();
  const bridge = useRef({ setValue: textInput.setValue, attachments });
  const lastMarkdown = useRef(textInput.value);
  const initialMarkdown = useRef(textInput.value);

  useLayoutEffect(() => {
    bridge.current = { setValue: textInput.setValue, attachments };
  }, [textInput.setValue, attachments]);

  const { loading, get } = useEditor((container) => Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, container);
      ctx.set(defaultValueCtx, initialMarkdown.current);
      ctx.update(editorViewOptionsCtx, (previous) => ({
        ...previous,
        attributes: {
          ...previous.attributes,
          role: "textbox",
          "aria-label": "Message input",
          "aria-multiline": "true",
          "data-slot": "input-group-control",
          "data-placeholder": "What would you like to know?",
        },
      }));
    })
    // Handle Enter and file paste before the general Markdown keymaps/clipboard.
    .use(createComposerPlugin({
      onMarkdownChange: (markdown) => {
        lastMarkdown.current = markdown;
        bridge.current.setValue(markdown);
      },
      onFiles: (files) => bridge.current.attachments.add(files),
      onEmptyBackspace: () => {
        const attachment = bridge.current.attachments.files.at(-1);
        if (!attachment) return false;
        bridge.current.attachments.remove(attachment.id);
        return true;
      },
    }))
    .use(commonmark)
    .use(gfm)
    .use(clipboard)
    .use(history), []);

  useEffect(() => {
    const editor = get();
    if (loading || !editor || textInput.value === lastMarkdown.current) return;
    lastMarkdown.current = textInput.value;
    // Flush after send so Undo cannot bring back a message that was already sent.
    editor.action(replaceAll(textInput.value, textInput.value === ""));
  }, [textInput.value, loading, get]);

  useEffect(() => {
    if (loading) return;
    const editor = get();
    if (!editor) return;
    __registerComposerFocus(() => editor.action((ctx) => ctx.get(editorViewCtx).focus()));
    return () => __registerComposerFocus(null);
  }, [loading, get, __registerComposerFocus]);

  // Keep the serialized value available to form tooling without a second editable input.
  return <><input type="hidden" name="message" value={textInput.value} readOnly /><Milkdown /></>;
}

export default function MarkdownComposer() {
  const { chatId } = usePromptInputContext();
  return (
    <div className="prompt-markdown-editor w-full min-w-0">
      <MilkdownProvider key={chatId}><ComposerEditor /></MilkdownProvider>
    </div>
  );
}
