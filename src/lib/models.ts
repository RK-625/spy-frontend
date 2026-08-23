import { Deepseek, Meta } from "@/components/logos";
import type { AIModel } from "@/types/models";

export const models: AIModel[] = [
  {
    chef: "DeepSeek",
    chefSlug: "deepseek",
    id: "deepseek-v4-flash-vision-exp",
    name: "DeepSeek V4 Flash Vision",
    icon: Deepseek,
    mode: ["high", "max"],
    defaultMode: "high",
  },
  {
    chef: "DeepSeek",
    chefSlug: "deepseek",
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    icon: Deepseek,
    mode: ["high", "max"],
    defaultMode: "high",
  },
  {
    chef: "DeepSeek",
    chefSlug: "deepseek",
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    icon: Deepseek,
    mode: ["high", "max"],
    defaultMode: "high",
  },
  {
    chef: "Meta",
    chefSlug: "meta",
    id: "muse-spark-1.2",
    name: "Muse Spark 1.2",
    icon: Meta,
    mode: ["minimal", "low", "medium", "high", "xhigh"],
    defaultMode: "high",
  },
];

export const chefs = ["DeepSeek", "Meta"];
