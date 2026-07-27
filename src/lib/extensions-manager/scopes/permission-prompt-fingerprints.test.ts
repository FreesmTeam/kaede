import { expect, test } from "vitest";

import type {
  PreparedPermissionRequest,
} from "@/lib/capability-broker/types.ts";
import {
  getPermissionRequestFingerprint,
} from "@/lib/extensions-manager/scopes/permission-prompt-fingerprints.ts";

function preparedExecutable(contentSha256: string): PreparedPermissionRequest {
  const executable = Object.freeze({
    "path"     : "/usr/bin/tool",
    "arguments": Object.freeze(["--version"]),
  });
  const descriptor = Object.freeze({
    "id"   : "system/process/spawn" as const,
    "scope": Object.freeze({ "executables": Object.freeze([executable]) }),
  });
  const targetIdentity = Object.freeze({
    "kind"            : "process_executable" as const,
    "path"            : "/usr/bin/tool",
    "identityProvider": "desktop-executable-sha256-v1" as const,
    "device"          : "8",
    "inode"           : "80",
    contentSha256,
  });

  return Object.freeze({
    descriptor,
    "targetIdentities": Object.freeze([targetIdentity]),
  });
}

test("prepared executable fingerprints bind the complete content identity", () => {
  const first = getPermissionRequestFingerprint(preparedExecutable("a".repeat(64)));
  const replacedContent = getPermissionRequestFingerprint(
    preparedExecutable("b".repeat(64)),
  );

  expect(first).toMatch(/^permission-request-v2:sha256:[a-f0-9]{64}$/u);
  expect(replacedContent).toMatch(/^permission-request-v2:sha256:[a-f0-9]{64}$/u);
  expect(first).not.toBe(replacedContent);
});
