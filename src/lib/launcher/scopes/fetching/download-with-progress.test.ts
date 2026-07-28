import { beforeEach, expect, test, vi } from "vitest";

import type {
  DownloadProgress,
} from "@/lib/capability-broker/types.ts";
import Fetching from "@/lib/launcher/scopes/fetching";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

const { toFile } = vi.hoisted(() => ({ "toFile": vi.fn() }));

vi.mock("@/lib/capability-broker", () => ({
  "Host": {
    "downloads": { toFile },
  },
}));

beforeEach(() => {
  toFile.mockReset();
});

test("keeps the published trusted-plugin downloadWithProgress entry point", async () => {
  const current = new Map<string, [number, number]>;
  const statuses = {
    "downloads": { current },
  } as unknown as LauncherStatusesType;

  toFile.mockImplementation(async (
    input: Readonly<{ "url": string; "destinationPath": string }>,
    onProgress: (progress: DownloadProgress) => void,
  ): Promise<void> => {
    expect(input).toEqual({
      "url"            : "https://example.test/client.jar",
      "destinationPath": "libraries/client.jar",
    });
    onProgress({ "transferred": 5, "total": 10, "bytesPerSecond": 1024 });
    expect(current.get(input.url)).toEqual([50, 1024]);
    onProgress({ "transferred": 10, "total": 10, "bytesPerSecond": 2048 });
  });

  await Fetching.downloadWithProgress({
    "url" : "https://example.test/client.jar",
    "path": "libraries/client.jar",
    statuses,
  });

  expect(toFile).toHaveBeenCalledOnce();
  expect(current.size).toBe(0);
});
