import { getCpuUsage } from "@/lib/development-mode-helpers/get-cpu-usage.ts";
import { getMemoryUsage } from "@/lib/development-mode-helpers/get-memory-usage.ts";
import { loadEruda } from "@/lib/development-mode-helpers/load-eruda.ts";
import { enableDebugMode } from "@/lib/development-mode-helpers/scopes/enable-debug-mode.ts";

export default {
  loadEruda,
  getCpuUsage,
  getMemoryUsage,
  // Old
  enableDebugMode,
} as const;
