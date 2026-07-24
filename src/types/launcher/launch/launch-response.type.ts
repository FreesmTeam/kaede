import type { ServerProcessType } from "@/types/application/server-process.type.ts";

export type LaunchResponseType = {
  "success": boolean;
  "process": ServerProcessType | undefined;
};
