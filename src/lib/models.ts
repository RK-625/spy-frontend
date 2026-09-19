import { Deepseek, Meta } from "@/components/logos";
import type { AIModel } from "@/types/models";

export const models: AIModel[] = [
  {
    chef: "DeepSeek",
    chefSlug: "deepseek",
    id: "deepseek-flash",
    name: "DeepSeek Flash",
    icon: Deepseek,
    mode: ["high", "max"],
    defaultMode: "high",
  },
  {
    chef: "Meta",
    chefSlug: "meta",
    id: "muse-spark-1.3-contributor",
    name: "Muse Spark 1.3 Contributor",
    icon: Meta,
    mode: ["minimal", "low", "medium", "high", "xhigh", "max"],
    defaultMode: "high",
  },
];

export const chefs = ["DeepSeek", "Meta"];
