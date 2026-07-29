import { getCpuUsage } from "@/lib/development-mode/get-cpu-usage.ts";
import { getMemoryUsage } from "@/lib/development-mode/get-memory-usage.ts";
import { loadEruda } from "@/lib/development-mode/load-eruda.ts";

export default {
  loadEruda,
  getCpuUsage,
  getMemoryUsage,
} as const;
