"use client";

import React from "react";
import {
  InteractiveQuestionVariantA,
  InteractiveQuestionVariantB,
  InteractiveQuestionVariantC,
} from "@/deprecated/ui-prototypes/components/interactive-question-variants";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputProvider,
} from "@/components/chat/ai-elements/prompt-input";
import { DotMatrixIcon } from "@/components/dotmatrix/icons";
import { SpeechInput } from "@/components/chat/ai-elements/speech-input";

export default function UIPrototypesPage() {
  const sampleQuestion = "Which graph database topology should we weave?";
  const sampleOptions = ["FalkorDB Native", "Neo4j Export", "In-Memory Map"];

  const handleSelect = (variant: string, value: string) => {
    console.log(`[${variant}] Selected: ${value}`);
  };

  return (
    <div className="min-h-screen bg-[#060610] text-[#e8e4df] p-10 font-sans flex flex-col items-center">
      <div className="w-full max-w-3xl flex flex-col gap-16">
        <div>
          <h1 className="font-unbounded text-2xl text-[#ded4f0] mb-2">Interactive Question Widget Prototypes</h1>
          <p className="text-[#7a7685] mb-8">
            Static design variants below. The morphing prompt-input widget was removed from the live chat shell;
            snapshot lives under <code className="text-[#c8acfb]">src/deprecated/ask-user-question-widget/</code>.
          </p>
        </div>

        {/* Chat prompt shell (no askUserQuestion morph — that logic is deprecated) */}
        <section className="flex flex-col gap-6">
          <div className="border-b border-[rgba(200,172,251,0.1)] pb-2">
            <h2 className="font-unbounded text-xl text-[#ded4f0]">Chat Prompt Input (live shell)</h2>
            <p className="text-sm text-[#9a8cc0] mt-1">
              Plain chat composition only. For the old morphing widget source, open the deprecated snapshot.
            </p>
          </div>
          
          <div className="p-8 bg-[#150c28] rounded-xl border border-[rgba(200,172,251,0.08)] shadow-lg relative flex justify-center">
            <div className="w-full max-w-2xl">
              <PromptInputProvider>
                <div className="chat-input-wrap relative w-full">
                  <div className="chat-input-glow" />
                  <PromptInput onSubmit={(msg, e) => { e.preventDefault(); console.log(msg); }}>
                    <PromptInputHeader />
                    <PromptInputBody>
                      <PromptInputTextarea />
                    </PromptInputBody>
                    <PromptInputFooter>
                      <PromptInputTools className="[&_button]:!size-8 [&_button]:!rounded-[var(--radius)]">
                        <PromptInputButton variant="ghost" className="text-[#e8dff8] hover:bg-[rgba(200,172,251,0.08)]">
                          <DotMatrixIcon name="plus" size={16} />
                        </PromptInputButton>
                        <SpeechInput variant="ghost" className="text-[#e8dff8] hover:bg-[rgba(200,172,251,0.08)]" />
                        <PromptInputButton variant="ghost" className="text-[#e8dff8] hover:bg-[rgba(200,172,251,0.08)]">
                          <DotMatrixIcon name="globe" size={16} />
                        </PromptInputButton>
                      </PromptInputTools>
                      <PromptInputSubmit className="!size-8 !rounded-[var(--radius)] bg-[#e8dff8] text-[#0a0a0c] hover:bg-white" />
                    </PromptInputFooter>
                  </PromptInput>
                </div>
              </PromptInputProvider>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="border-b border-[rgba(200,172,251,0.1)] pb-2">
            <h2 className="font-unbounded text-xl text-[#ded4f0]">Variant A: Stacked Minimal</h2>
            <p className="text-sm text-[#9a8cc0] mt-1">Vertically stacked ghost buttons, VT323 numbers, minimal borders.</p>
          </div>
          <div className="p-8 bg-[#150c28] rounded-xl border border-[rgba(200,172,251,0.08)] flex justify-center shadow-lg">
            <InteractiveQuestionVariantA
              question={sampleQuestion}
              options={sampleOptions}
              allowCustomInput={true}
              onSelect={(val) => handleSelect("Variant A", val)}
            />
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="border-b border-[rgba(200,172,251,0.1)] pb-2">
            <h2 className="font-unbounded text-xl text-[#ded4f0]">Variant B: Alien Terminal</h2>
            <p className="text-sm text-[#9a8cc0] mt-1">High-contrast borders, aggressive VT323 styling, command prompt input.</p>
          </div>
          <div className="p-8 bg-[#0a0516] rounded-xl border border-[rgba(200,172,251,0.08)] flex justify-center shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(74,18,128,0.15)_0%,transparent_70%)] pointer-events-none" />
            <div className="relative z-10 w-full flex justify-center">
              <InteractiveQuestionVariantB
                question={sampleQuestion}
                options={sampleOptions}
                allowCustomInput={true}
                onSelect={(val) => handleSelect("Variant B", val)}
              />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="border-b border-[rgba(200,172,251,0.1)] pb-2">
            <h2 className="font-unbounded text-xl text-[#ded4f0]">Variant C: Horizontal / Compact</h2>
            <p className="text-sm text-[#9a8cc0] mt-1">Wrap layout for shorter options, suggestion chips feel.</p>
          </div>
          <div className="p-8 bg-[#150c28] rounded-xl border border-[rgba(200,172,251,0.08)] flex justify-center shadow-lg">
            <InteractiveQuestionVariantC
              question={sampleQuestion}
              options={sampleOptions}
              allowCustomInput={true}
              onSelect={(val) => handleSelect("Variant C", val)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
