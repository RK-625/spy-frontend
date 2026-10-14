import { fromDom } from "hast-util-from-dom";
import { toMdast } from "hast-util-to-mdast";
import { gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";

function containsTableHead(node: Node): boolean {
  if (node.nodeName === "THEAD") return true;
  return (node instanceof Element || node instanceof DocumentFragment) && node.querySelector("thead") !== null;
}

/**
 * Re-wrap the cloned selection in shallow copies of its ancestors up to `root`, so a
 * selection inside a table, list, code block, or emphasis keeps that structure.
 * Tables regain their header row, since GFM needs one.
 */
function wrapInAncestors(range: Range, fragment: DocumentFragment, root: HTMLElement): Node {
  const common = range.commonAncestorContainer;
  let wrapped: Node = fragment;
  for (
    let ancestor = common instanceof Element ? common : common.parentElement;
    ancestor && ancestor !== root && root.contains(ancestor);
    ancestor = ancestor.parentElement
  ) {
    const shell = ancestor.cloneNode(false);
    if (ancestor instanceof HTMLTableElement && ancestor.tHead && !containsTableHead(wrapped)) {
      shell.appendChild(ancestor.tHead.cloneNode(true));
    }
    shell.appendChild(wrapped);
    wrapped = shell;
  }
  return wrapped;
}

function replaceTag(element: Element, tagName: string): Element {
  const replacement = document.createElement(tagName);
  replacement.append(...element.childNodes);
  element.replaceWith(replacement);
  return replacement;
}

/**
 * Streamdown renders some Markdown with non-semantic tags: bold as a span, links as
 * link-safety buttons (no href in the DOM), code lines as newline-less spans with the
 * language on a wrapper. Map them back so `toMdast` sees standard HTML.
 */
function normalizeStreamdown(container: HTMLElement): void {
  for (const header of container.querySelectorAll('[data-streamdown="code-block-header"]')) header.remove();
  for (const strong of container.querySelectorAll('[data-streamdown="strong"]')) replaceTag(strong, "strong");
  for (const link of container.querySelectorAll('[data-streamdown="link"]')) replaceTag(link, "span");
  for (const code of container.querySelectorAll('[data-streamdown="code-block-body"] pre > code')) {
    const lines = [...code.children].map((line) => line.textContent ?? "");
    code.textContent = lines.length > 0 ? lines.join("\n") : code.textContent;
    const language = code.closest<HTMLElement>("[data-language]")?.dataset.language;
    if (language) code.className = `language-${language}`;
  }
}

/**
 * Selected rendered Markdown → Markdown source (GFM: tables, strikethrough, task lists).
 * Reverses the Streamdown render with the same unified toolchain; UI chrome matching
 * `chromeSelector` (copy buttons, etc.) is dropped from the copy, never from the page.
 */
export function rangeToMarkdown(range: Range, root: HTMLElement, chromeSelector: string): string {
  const fragment = range.cloneContents();
  const content = wrapInAncestors(range, fragment, root);
  const container = document.createElement("div");
  container.appendChild(content);
  for (const chrome of container.querySelectorAll(chromeSelector)) chrome.remove();
  normalizeStreamdown(container);
  return toMarkdown(toMdast(fromDom(container)), { extensions: [gfmToMarkdown()] }).trim();
}
