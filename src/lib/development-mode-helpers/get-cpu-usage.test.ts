import { expect, test, vi } from "vitest";

import type { HostFacade } from "@/lib/capability-broker";
import { getCpuUsage } from "@/lib/development-mode-helpers/get-cpu-usage.ts";

const getGlobalCpuUsage = vi.hoisted(() => {
  return vi.fn<HostFacade["diagnostics"]["getGlobalCpuUsage"]>(async () => 12.345);
});

vi.mock("@/lib/capability-broker", () => ({
  "Host": { "diagnostics": { getGlobalCpuUsage } },
}));

test("formats typed global CPU diagnostics like the legacy helper", async () => {
  await expect(getCpuUsage()).resolves.toBe("12.35");
  expect(getGlobalCpuUsage).toHaveBeenCalledOnce();
});
