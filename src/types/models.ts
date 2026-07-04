import { AnthropicWhite } from "@/components/ui/svgs/anthropicWhite";
import { Deepseek } from "@/components/ui/svgs/deepseek";
import { Google } from "@/components/ui/svgs/google";
import { Openai } from "@/components/ui/svgs/openai";
import { OpenaiDark } from "@/components/ui/svgs/openaiDark";

export interface AIModel {
  chef: string;
  chefSlug: string;
  id: string;
  name: string;
  icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
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
  },
  {
    chef: "DeepSeek",
    chefSlug: "deepseek",
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    icon: Deepseek,
  },
];

// export const chefs = ["OpenAI", "Anthropic", "Google", "DeepSeek"];
export const chefs = ["DeepSeek"];
