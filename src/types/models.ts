import type React from "react";

export type Chef = string;
export type ModelId = string;

export interface AIModel {
  chef: Chef;
  chefSlug: string;
  id: ModelId;
  name: string;
  icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  mode: string[];
  defaultMode: string;
}

