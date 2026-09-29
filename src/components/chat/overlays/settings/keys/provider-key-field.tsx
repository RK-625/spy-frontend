"use client";

/**
 * Paste → verify → saved. Saved keys show only a masked hint with the
 * verified double tick; hovering or focusing the tick flips it to a remove
 * control that asks for inline confirmation. The pasted key is dropped from
 * state once saved.
 */

import { CheckCheck, X } from "lucide-react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { type FormEvent, useCallback, useState } from "react";
import { DotmSquare18 } from "@/components/dotmatrix";
import { Button, Input } from "@/components/ui";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { CHROME_FADE, ERROR_SHAKE, GLYPH_SWAP, MOTION } from "@/lib/motion";
import type { ProviderDefinition } from "@/types/models";
import type { RemoveProviderKeyResult, SaveProviderKeyResult } from "./use-provider-keys";

const MASK_DOTS = "••••••••";

export interface ProviderKeyFieldProps {
  provider: ProviderDefinition;
  /** undefined = still loading; null = no key saved. */
  keyHint: string | null | undefined;
  onSaveKey: (apiKey: string) => Promise<SaveProviderKeyResult>;
  onRemoveKey: () => Promise<RemoveProviderKeyResult>;
}

type SavedKeyMode = "masked" | "confirming";

function SavedKey({
  provider,
  keyHint,
  onRemoveKey,
}: {
  provider: ProviderDefinition;
  keyHint: string;
  onRemoveKey: () => Promise<RemoveProviderKeyResult>;
}) {
  const [mode, setMode] = useState<SavedKeyMode>("masked");
  const [isRemoveMarkShown, setIsRemoveMarkShown] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const showRemoveMark = useCallback(() => setIsRemoveMarkShown(true), []);
  const showVerifiedMark = useCallback(() => setIsRemoveMarkShown(false), []);
  const startConfirming = useCallback(() => {
    setIsRemoveMarkShown(false);
    setMode("confirming");
  }, []);
  const cancelConfirming = useCallback(() => {
    setRemoveError(null);
    setMode("masked");
  }, []);
  const confirmRemoval = useCallback(async () => {
    setIsRemoving(true);
    setRemoveError(null);
    const result = await onRemoveKey();
    // On success the saved hint clears and this row is replaced by the paste field.
    if (!result.ok) {
      setIsRemoving(false);
      setRemoveError(result.error);
    }
  }, [onRemoveKey]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-9 items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3">
        <AnimatePresence initial={false} mode="wait">
          {mode === "masked" ? (
            <motion.div
              key="masked"
              {...CHROME_FADE}
              className="flex min-w-0 flex-1 items-center justify-between gap-3"
              transition={MOTION.chrome}
            >
              <span className="truncate font-[family-name:var(--font-code)] text-xs text-text-secondary">
                {provider.keyPrefix}
                {MASK_DOTS}
                {keyHint}
              </span>
              <button
                aria-label={`Remove ${provider.name} key`}
                className="flex h-6 min-w-[4.75rem] flex-none items-center justify-end rounded-[var(--radius)] text-xs"
                onBlur={showVerifiedMark}
                onClick={startConfirming}
                onFocus={showRemoveMark}
                onMouseEnter={showRemoveMark}
                onMouseLeave={showVerifiedMark}
                type="button"
              >
                <AnimatePresence initial={false} mode="wait">
                  {isRemoveMarkShown ? (
                    <motion.span
                      key="remove"
                      {...GLYPH_SWAP}
                      className="flex items-center gap-1.5 text-destructive"
                      transition={MOTION.chrome}
                    >
                      <X size={ICON_GLYPH.inline} strokeWidth={1.75} aria-hidden />
                      Remove
                    </motion.span>
                  ) : (
                    <motion.span
                      key="verified"
                      {...GLYPH_SWAP}
                      className="flex items-center gap-1.5 text-status-success"
                      transition={MOTION.chrome}
                    >
                      <CheckCheck size={ICON_GLYPH.inline} strokeWidth={1.75} aria-hidden />
                      Verified
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="confirming"
              {...CHROME_FADE}
              className="flex min-w-0 flex-1 items-center justify-between gap-3"
              transition={MOTION.chrome}
            >
              <span className="truncate text-xs text-text-primary">Remove this key?</span>
              <div className="flex flex-none items-center gap-1.5">
                <Button
                  disabled={isRemoving}
                  onClick={cancelConfirming}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  className="w-[4.5rem]"
                  disabled={isRemoving}
                  onClick={confirmRemoval}
                  size="xs"
                  type="button"
                  variant="destructive"
                >
                  <AnimatePresence initial={false} mode="wait">
                    {isRemoving ? (
                      <motion.span
                        key="removing"
                        {...GLYPH_SWAP}
                        className="flex items-center"
                        transition={MOTION.chrome}
                      >
                        <DotmSquare18
                          animated
                          color="currentColor"
                          dotSize={1.5}
                          size={ICON_GLYPH.badge}
                        />
                      </motion.span>
                    ) : (
                      <motion.span key="confirm" {...GLYPH_SWAP} transition={MOTION.chrome}>
                        Confirm
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {removeError && (
          <motion.p
            {...CHROME_FADE}
            className="text-xs text-destructive"
            role="alert"
            transition={MOTION.chrome}
          >
            {removeError}
          </motion.p>
        )}
      </AnimatePresence>
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

export function ProviderKeyField({
  provider,
  keyHint,
  onSaveKey,
  onRemoveKey,
}: ProviderKeyFieldProps) {
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
        {keyHint && (
          <SavedKey keyHint={keyHint} onRemoveKey={onRemoveKey} provider={provider} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
