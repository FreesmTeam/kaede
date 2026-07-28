import { expect, test, vi } from "vitest";

import type { HostFacade } from "@/lib/capability-broker";
import { getMemoryUsage } from "@/lib/development-mode-helpers/get-memory-usage.ts";

const getSystemMemory = vi.hoisted(() => {
  return vi.fn<HostFacade["diagnostics"]["getSystemMemory"]>(async () => ({
    "usedBytes" : 4_294_967_296,
    "totalBytes": 8_589_934_592,
  }));
});

vi.mock("@/lib/capability-broker", () => ({
  "Host": { "diagnostics": { getSystemMemory } },
}));

test("formats typed system-memory diagnostics like the legacy helper", async () => {
  await expect(getMemoryUsage()).resolves.toEqual({ "used": "4.00", "total": "8.00" });
  expect(getSystemMemory).toHaveBeenCalledOnce();
});
