import { Deepseek } from "@/components/logos/deepseek";
import type { AIModel } from "@/types/models";

export const models: AIModel[] = [
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

export const chefs = ["DeepSeek"];
