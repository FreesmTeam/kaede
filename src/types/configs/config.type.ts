import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export type ConfigType = Pick<
  GlobalStatesType,
  "development" | "extensions" | "layout" | "logs" | "minecraft" | "misc"
>;
