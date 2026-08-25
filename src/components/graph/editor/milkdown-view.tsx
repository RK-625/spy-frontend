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
import { highlight, highlightPluginConfig } from "@milkdown/plugin-highlight";
import { createParser, type Parser } from "@milkdown/plugin-highlight/shiki";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { useEffect, useRef } from "react";
import {
  bundledLanguages,
  bundledLanguagesAlias,
  getSingletonHighlighter,
  isSpecialLang,
  type BundledLanguage,
  type Highlighter,
} from "shiki";

import "./milkdown-view.css";

const PRELOADED_LANGS = [
  "java",
  "javascript",
  "typescript",
  "python",
  "cpp",
  "c",
  "go",
  "rust",
  "sql",
  "json",
  "bash",
  "html",
  "css",
  "markdown",
] as const satisfies readonly BundledLanguage[];

function isLoadableLanguage(lang: string): lang is BundledLanguage {
  return lang in bundledLanguages || lang in bundledLanguagesAlias;
}

function createLazyShikiParser(highlighter: Highlighter): Parser {
  const parse = createParser(highlighter);
  const skippedLangs = new Set<string>();

  const run: Parser = (options) => {
    try {
      return parse(options);
    } catch {
      return [];
    }
  };

  return (options) => {
    const language = options.language;
    if (!language || isSpecialLang(language)) {
      return run({ ...options, language: language ?? "plaintext" });
    }

    if (highlighter.getLoadedLanguages().includes(language)) {
      return run(options);
    }

    if (skippedLangs.has(language) || !isLoadableLanguage(language)) {
      skippedLangs.add(language);
      return run({ ...options, language: "plaintext" });
    }

    return highlighter.loadLanguage(language).then(
      () => undefined,
      () => {
        skippedLangs.add(language);
      },
    );
  };
}

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
      .config(async (ctx) => {
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

        const highlighter = await getSingletonHighlighter({
          themes: ["github-dark"],
          langs: [...PRELOADED_LANGS],
        });
        ctx.set(highlightPluginConfig.key, {
          parser: createLazyShikiParser(highlighter),
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(highlight);
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
