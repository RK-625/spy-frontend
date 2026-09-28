"use client";

/**
 * Paste → verify → saved. Saved keys show only a masked hint with the
 * verified double tick; the pasted key is dropped from state once saved.
 */

import { CheckCheck } from "lucide-react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { type FormEvent, useCallback, useState } from "react";
import { DotmSquare18 } from "@/components/dotmatrix";
import { Button, Input } from "@/components/ui";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { CHROME_FADE, ERROR_SHAKE, GLYPH_SWAP, MOTION } from "@/lib/motion";
import type { ProviderDefinition } from "@/types/models";
import type { SaveProviderKeyResult } from "./use-provider-keys";

const MASK_DOTS = "••••••••";

export interface ProviderKeyFieldProps {
  provider: ProviderDefinition;
  /** undefined = still loading; null = no key saved. */
  keyHint: string | null | undefined;
  onSaveKey: (apiKey: string) => Promise<SaveProviderKeyResult>;
}

function MaskedKey({ provider, keyHint }: { provider: ProviderDefinition; keyHint: string }) {
  return (
    <div className="flex h-9 items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3">
      <span className="truncate font-[family-name:var(--font-code)] text-xs text-text-secondary">
        {provider.keyPrefix}
        {MASK_DOTS}
        {keyHint}
      </span>
      <motion.span
        {...GLYPH_SWAP}
        className="flex items-center gap-1.5 text-xs text-status-success"
        transition={MOTION.chrome}
      >
        <CheckCheck size={ICON_GLYPH.inline} strokeWidth={1.75} aria-hidden />
        Verified
      </motion.span>
    </div>
  );
}

function KeyEntryForm({
  provider,
  onSaveKey,
}: Pick<ProviderKeyFieldProps, "provider" | "onSaveKey">) {
  const [draftKey, setDraftKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const shakeControls = useAnimationControls();

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const apiKey = draftKey.trim();
      if (!apiKey || isSaving) return;
      setIsSaving(true);
      setSaveError(null);
      const result = await onSaveKey(apiKey);
      setIsSaving(false);
      if (result.ok) {
        setDraftKey("");
        return;
      }
      setSaveError(result.error);
      void shakeControls.start(ERROR_SHAKE);
    },
    [draftKey, isSaving, onSaveKey, shakeControls],
  );

  const placeholder = provider.keyPrefix
    ? `${provider.keyPrefix}…`
    : `Paste ${provider.name} key`;

  return (
    <form className="flex flex-col gap-1.5" onSubmit={handleSubmit}>
      <motion.div animate={shakeControls} className="flex items-center gap-2">
        <Input
          aria-invalid={saveError !== null}
          aria-label={`${provider.name} API key`}
          autoComplete="off"
          className="h-9 rounded-[var(--radius)] border-[var(--border-subtle)] bg-[var(--surface-input)] font-[family-name:var(--font-code)] text-xs placeholder:text-text-dim"
          disabled={isSaving}
          onChange={(event) => {
            setDraftKey(event.target.value);
            if (saveError) setSaveError(null);
          }}
          placeholder={placeholder}
          spellCheck={false}
          type="password"
          value={draftKey}
        />
        <Button
          className="h-9 w-28 flex-none"
          disabled={isSaving || draftKey.trim().length === 0}
          size="sm"
          type="submit"
          variant="secondary"
        >
          <AnimatePresence initial={false} mode="wait">
            {isSaving ? (
              <motion.span
                key="saving"
                {...GLYPH_SWAP}
                className="flex items-center gap-1.5"
                transition={MOTION.chrome}
              >
                <DotmSquare18 animated color="currentColor" dotSize={1.5} size={ICON_GLYPH.badge} />
                Verifying
              </motion.span>
            ) : (
              <motion.span key="save" {...GLYPH_SWAP} transition={MOTION.chrome}>
                Save
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>
      <AnimatePresence initial={false}>
        {saveError && (
          <motion.p
            {...CHROME_FADE}
            className="text-xs text-destructive"
            role="alert"
            transition={MOTION.chrome}
          >
            {saveError}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}

export function ProviderKeyField({ provider, keyHint, onSaveKey }: ProviderKeyFieldProps) {
  const fieldState = keyHint === undefined ? "loading" : keyHint === null ? "empty" : "saved";
  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div key={fieldState} {...CHROME_FADE} transition={MOTION.chrome}>
        {fieldState === "loading" && (
          <div
            aria-hidden
            className="h-9 animate-pulse-subtle rounded-[var(--radius)] bg-[var(--surface-hover)]"
          />
        )}
        {fieldState === "empty" && <KeyEntryForm onSaveKey={onSaveKey} provider={provider} />}
        {keyHint && <MaskedKey keyHint={keyHint} provider={provider} />}
      </motion.div>
    </AnimatePresence>
  );
}
