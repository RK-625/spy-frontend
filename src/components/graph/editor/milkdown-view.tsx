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
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui";
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
  scrollMode?: "pane" | "document";
  onDocumentTextChange?: (next: string) => void;
};

let documentHighlighter: Highlighter | null | undefined;

function MilkdownEditor({
  highlighter,
  documentText,
  readOnly,
  onDocumentTextChange,
}: MilkdownViewProps & { highlighter: Highlighter | null }) {
  const readOnlyRef = useRef(readOnly);
  const onDocumentTextChangeRef = useRef(onDocumentTextChange);

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  useEffect(() => {
    onDocumentTextChangeRef.current = onDocumentTextChange;
  }, [onDocumentTextChange]);

  useEditor(
    (container) => {
      return Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, container);
          ctx.set(defaultValueCtx, documentText);
          ctx.update(editorViewOptionsCtx, (prev) => ({
            ...prev,
            editable: () => !readOnlyRef.current,
          }));

          ctx
            .get(listenerCtx)
            .markdownUpdated((_ctx, markdown, prevMarkdown) => {
              if (readOnlyRef.current) return;
              if (markdown === prevMarkdown) return;
              onDocumentTextChangeRef.current?.(markdown);
            });

          ctx.set(highlightPluginConfig.key, {
            parser: highlighter ? createLazyShikiParser(highlighter) : () => [],
          });
        })
        .use(commonmark)
        .use(gfm)
        .use(listener)
        .use(highlight);
    },
    [documentText, highlighter],
  );

  return <Milkdown />;
}

/**
 * CommonMark + GFM WYSIWYG over `node.content`. Markdown string stays source of truth.
 */
export function MilkdownView(props: MilkdownViewProps) {
  const [highlighter, setHighlighter] = useState(() => documentHighlighter);
  useEffect(() => {
    if (highlighter !== undefined) return;
    let cancelled = false;
    // Resolve Shiki before editor.create(): its async config timers should not
    // depend on language loading while a learning card can be unmounted.
    getSingletonHighlighter({
      themes: ["github-dark"],
      langs: [...PRELOADED_LANGS],
    }).then(
      (readyHighlighter) => {
        documentHighlighter = readyHighlighter;
        if (!cancelled) setHighlighter(readyHighlighter);
      },
      () => {
        // Markdown still works if optional syntax highlighting cannot load.
        documentHighlighter = null;
        if (!cancelled) setHighlighter(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [highlighter]);
  return (
    <div
      className={
        props.scrollMode === "document"
          ? "milkdown-pane"
          : "milkdown-pane min-h-0 flex-1 overflow-y-auto"
      }
      data-readonly={props.readOnly ? "true" : "false"}
    >
      {highlighter === undefined ? (
        <div
          role="status"
          aria-label="Loading document"
          className="flex items-center py-4"
        >
          <Spinner />
        </div>
      ) : (
        <MilkdownProvider>
          <MilkdownEditor {...props} highlighter={highlighter} />
        </MilkdownProvider>
      )}
    </div>
  );
}
