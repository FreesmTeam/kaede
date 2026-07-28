import { expect, test } from "vitest";

import {
  getDownloadCancelId,
} from "@/lib/launcher/scopes/fetching/get-download-cancel-id.ts";
import {
  isDownloadCancellationActive,
} from "@/lib/launcher/scopes/fetching/is-download-cancellation-active.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

function statuses(): LauncherStatusesType {
  return {
    "launching": 1,
    "current"  : undefined,
    "downloads": {
      "current"    : new Map,
      "success"    : 10,
      "failed"     : 0,
      "total"      : 10,
      "cancellable": false,
    },
  };
}

test("derives the same instance-scoped cancel id for extraction and UI", () => {
  expect(getDownloadCancelId("instance-42")).toBe("instance-42-download");
});

test("does not treat cumulative completed downloads as an active cancel group", () => {
  const completed = statuses();

  expect(isDownloadCancellationActive(completed)).toBe(false);

  completed.downloads.cancellable = true;
  expect(isDownloadCancellationActive(completed)).toBe(true);

  completed.launching = 2;
  expect(isDownloadCancellationActive(completed)).toBe(false);
});
