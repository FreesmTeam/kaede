import { beforeEach, expect, test, vi } from "vitest";

import type { HostFacade } from "@/lib/capability-broker";
import { getInitialState } from "@/lib/general/scopes/get-initial-state.ts";
import type { InitialStateType } from "@/types/application/initial-state.type.ts";

const brokerMocks = vi.hoisted(() => ({
  "getInitialState": vi.fn<HostFacade["runtime"]["getInitialState"]>(),
}));

vi.mock("@/lib/capability-broker", () => ({
  "Host": {
    "runtime": { "getInitialState": brokerMocks.getInitialState },
  },
}));

beforeEach(() => brokerMocks.getInitialState.mockReset());

test("gets launcher bootstrap state exclusively through the host broker", async () => {
  const state: InitialStateType = {
    "basic": {
      "launcherVersion": "1.2.3",
      "baseDirectory"  : "/app/data",
      "launchCount"    : 3,
      "separator"      : "/",
      "portable"       : false,
    },
    "parsed": {
      "config"      : { "status": "missing" },
      "accounts"    : { "status": "missing" },
      "instances"   : { "status": "missing" },
      "translations": { "status": "missing" },
    },
  };

  brokerMocks.getInitialState.mockResolvedValue(state);

  await expect(getInitialState()).resolves.toBe(state);
  expect(brokerMocks.getInitialState).toHaveBeenCalledOnce();
});
