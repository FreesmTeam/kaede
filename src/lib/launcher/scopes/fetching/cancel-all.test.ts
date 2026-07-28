import { beforeEach, expect, test, vi } from "vitest";

import type { HostFacade } from "@/lib/capability-broker";
import { cancelAll } from "@/lib/launcher/scopes/fetching/cancel-all.ts";

const brokerMocks = vi.hoisted(() => ({
  "cancel": vi.fn<HostFacade["downloads"]["cancel"]>(),
}));

vi.mock("@/lib/capability-broker", () => ({
  "Host": { "downloads": { "cancel": brokerMocks.cancel } },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("cancels only the broker group identified by the exact launch cancel id", async () => {
  brokerMocks.cancel.mockResolvedValue(true);

  await expect(cancelAll("instance-42-download")).resolves.toBe(true);
  expect(brokerMocks.cancel).toHaveBeenCalledExactlyOnceWith("instance-42-download");
});

test("preserves the broker result when no active group matches", async () => {
  brokerMocks.cancel.mockResolvedValue(false);

  await expect(cancelAll("completed-download")).resolves.toBe(false);
});
