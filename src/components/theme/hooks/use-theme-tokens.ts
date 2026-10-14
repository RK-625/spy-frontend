"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const TOKEN_VALUE_SEPARATOR = "\n";

/** The theme lives in <html>'s class list; any change there can change every token. */
function subscribeToThemeClass(onThemeClassChange: () => void): () => void {
  const observer = new MutationObserver(onThemeClassChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/**
 * Current values of palette tokens (src/styles/tokens) for code that cannot use CSS
 * variables directly — WebGL canvases and library props. Re-reads whenever the theme
 * class changes. Null until hydrated. `tokenNames` must be a stable (module-level) array.
 */
export function useThemeTokens<TokenName extends string>(
  tokenNames: readonly TokenName[],
): Record<TokenName, string> | null {
  // A joined string is a stable snapshot: equal values compare equal between reads.
  const readTokenValues = useCallback(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    return tokenNames
      .map((tokenName) => rootStyle.getPropertyValue(tokenName).trim())
      .join(TOKEN_VALUE_SEPARATOR);
  }, [tokenNames]);

  const joinedTokenValues = useSyncExternalStore(subscribeToThemeClass, readTokenValues, () => null);

  return useMemo(() => {
    if (joinedTokenValues === null) return null;
    const tokenValues = joinedTokenValues.split(TOKEN_VALUE_SEPARATOR);
    return Object.fromEntries(
      tokenNames.map((tokenName, index) => [tokenName, tokenValues[index] ?? ""]),
    ) as Record<TokenName, string>;
  }, [joinedTokenValues, tokenNames]);
}
