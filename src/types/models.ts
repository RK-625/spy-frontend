import { AnthropicWhite } from "@/components/brand/logos/anthropic-white";
import { Deepseek } from "@/components/brand/logos/deepseek";
import { Google } from "@/components/brand/logos/google";
import { Openai } from "@/components/brand/logos/openai";
import { OpenaiDark } from "@/components/brand/logos/openai-dark";

export interface AIModel {
  chef: string;
  chefSlug: string;
  id: string;
  name: string;
  icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  mode: string[];
}

export const models: AIModel[] = [
  // {
  //   chef: "OpenAI",
  //   chefSlug: "openai",
  //   id: "gpt-4o",
  //   name: "GPT-4o",
  //   icon: OpenaiDark,
  // },
  // {
  //   chef: "OpenAI",
  //   chefSlug: "openai",
  //   id: "gpt-4o-mini",
  //   name: "GPT-4o Mini",
  //   icon: OpenaiDark,
  // },
  // {
  //   chef: "Anthropic",
  //   chefSlug: "anthropic",
  //   id: "claude-opus-4-20250514",
  //   name: "Claude 4 Opus",
  //   icon: AnthropicWhite,
  // },
  // {
  //   chef: "Anthropic",
  //   chefSlug: "anthropic",
  //   id: "claude-sonnet-4-20250514",
  //   name: "Claude 4 Sonnet",
  //   icon: AnthropicWhite,
  // },
  // {
  //   chef: "Google",
  //   chefSlug: "google",
  //   id: "gemini-2.0-flash-exp",
  //   name: "Gemini 2.0 Flash",
  //   icon: Google,
  // },
  {
    chef: "DeepSeek",
    chefSlug: "deepseek",
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    icon: Deepseek,
    mode: ["high", "max"],
  },
  {
    chef: "DeepSeek",
    chefSlug: "deepseek",
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    icon: Deepseek,
    mode: ["high", "max"],
  },
];

// export const chefs = ["OpenAI", "Anthropic", "Google", "DeepSeek"];
export const chefs = ["DeepSeek"];
