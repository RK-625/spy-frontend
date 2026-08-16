/**
 * Truncate JSON for server tool/generation logs.
 * Full bodies stay on the tool result — not stdout.
 */
export function slimJson(value: unknown): unknown {
  try {
    const text = JSON.stringify(value);
    if (text == null) return value;
    if (text.length <= 1200) return value;
    return `${text.slice(0, 1200)}…`;
  } catch {
    return String(value);
  }
}
