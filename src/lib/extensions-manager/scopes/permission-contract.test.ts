import { describe, expect, test } from "vitest";

import type {
  PreparedPermissionRequest,
} from "@/lib/capability-broker";
import type {
  ExtensionEventListener,
} from "@/lib/extensions-manager/scopes/event-broker.ts";
import {
  normalizePermissionRequests,
} from "@/lib/extensions-manager/scopes/permission-contract.ts";
import {
  getPermissionRequestFingerprint,
} from "@/lib/extensions-manager/scopes/permission-prompt-fingerprints.ts";
import type {
  PermissionRequest,
  PluginCapabilities,
} from "@/types/extensions/permission.type.ts";

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function preparedProcessIdentity(contentSha256: string): PreparedPermissionRequest {
  return {
    "descriptor": {
      "id"   : "system/process/spawn",
      "scope": {
        "executables": [{ "path": "/tmp/tool", "arguments": ["--version"] }],
      },
    },
    "targetIdentities": [{
      "kind"            : "process_executable",
      "path"            : "/tmp/tool",
      "identityProvider": "desktop-executable-sha256-v1",
      "device"          : "1",
      "inode"           : "10",
      contentSha256,
    }],
  };
}

describe("permission request normalization", () => {
  test.each([
    {
      "permissionId": "storage/external/read",
      "targetKind"  : "external_storage_root",
    },
    {
      "permissionId": "system/process/spawn",
      "targetKind"  : "process_executable",
    },
  ] as const)(
    "binds $targetKind fingerprints to the backend-confirmed target identity",
    ({ permissionId, targetKind }) => {
      const prepare = (
        path: string,
        inode: string,
        contentSha256 = SHA_A,
      ): PreparedPermissionRequest => ({
        "descriptor": permissionId === "storage/external/read"
          ? {
            "id"   : permissionId,
            "scope": { "roots": [path] },
          }
          : {
            "id"   : permissionId,
            "scope": {
              "executables": [{ path, "arguments": ["--version"] }],
            },
          },
        "targetIdentities": [targetKind === "external_storage_root"
          ? {
            "kind"            : targetKind,
            path,
            "identityProvider": "desktop-filesystem-v1",
            "device"          : "1",
            inode,
          }
          : {
            "kind"            : targetKind,
            path,
            "identityProvider": "desktop-executable-sha256-v1",
            "device"          : "1",
            inode,
            contentSha256,
          }],
      });
      const preparedForA = prepare(
        targetKind === "external_storage_root" ? "/tmp/target-a" : "/tmp/tool-a",
        "10",
      );
      const preparedForB = prepare(
        targetKind === "external_storage_root" ? "/tmp/target-b" : "/tmp/tool-b",
        "20",
      );

      expect(getPermissionRequestFingerprint(preparedForA)).not.toBe(
        getPermissionRequestFingerprint(preparedForB),
      );
    },
  );

  test(
    "binds process fingerprints to exact contents even when path and inode are unchanged",
    () => {
      expect(getPermissionRequestFingerprint(preparedProcessIdentity(SHA_A))).not.toBe(
        getPermissionRequestFingerprint(preparedProcessIdentity(SHA_B)),
      );
    },
  );

  test("refuses to fingerprint target-bearing grants before host preparation", () => {
    expect(() => getPermissionRequestFingerprint({
      "id"   : "storage/external/read",
      "scope": { "roots": ["/tmp/plugin-link"] },
    })).toThrow("bind every target");
    expect(() => getPermissionRequestFingerprint({
      "id"   : "system/process/spawn",
      "scope": {
        "executables": [{ "path": "/tmp/tool-link", "arguments": [] }],
      },
    })).toThrow("bind every target");
  });

  test("reuses event snapshots that preserve undefined and bigint primitives", () => {
    const received: Array<unknown> = [];
    const events: PluginCapabilities["events/subscribe"] = Object.freeze({
      "subscribe": (listener: ExtensionEventListener) => {
        listener({ "type": "undefined", "value": undefined });
        listener({ "type": "bigint", "value": 1n });

        return (): void => {};
      },
    });

    events.subscribe(event => received.push(event.value));

    expect(received).toEqual([undefined, 1n]);
  });

  test("sorts and deduplicates simple and scoped requests", () => {
    const requests: ReadonlyArray<PermissionRequest> = [
      "logging/write",
      {
        "id"   : "network/http",
        "scope": {
          "origins": ["https://EXAMPLE.com:443/", "https://api.example.com"],
          "methods": ["POST", "GET", "GET"],
        },
      },
      "logging/write",
      {
        "id"   : "storage/external/read",
        "scope": { "roots": ["/srv/plugins", "/srv/plugins"] },
      },
      {
        "id"   : "system/process/spawn",
        "scope": {
          "executables": [
            { "path": "/usr/bin/git", "arguments": ["status", "--short"] },
            { "path": "/usr/bin/git", "arguments": ["status", "--short"] },
          ],
        },
      },
    ];

    expect(normalizePermissionRequests(requests)).toEqual([
      "logging/write",
      {
        "id"   : "network/http",
        "scope": {
          "origins": ["https://api.example.com", "https://example.com"],
          "methods": ["GET", "POST"],
        },
      },
      {
        "id"   : "storage/external/read",
        "scope": { "roots": ["/srv/plugins"] },
      },
      {
        "id"   : "system/process/spawn",
        "scope": {
          "executables": [
            { "path": "/usr/bin/git", "arguments": ["status", "--short"] },
          ],
        },
      },
    ]);
  });

  test("rejects multiple network descriptors instead of widening them to a cross-product", () => {
    expect(() => normalizePermissionRequests([
      {
        "id"   : "network/http",
        "scope": {
          "origins": ["https://a.example"],
          "methods": ["GET"],
        },
      },
      {
        "id"   : "network/http",
        "scope": {
          "origins": ["https://b.example"],
          "methods": ["POST"],
        },
      },
    ])).toThrow("Only one network/http descriptor");
  });

  test.each([
    {
      "id"   : "storage/internal/write",
      "scope": { "directory": "principal" },
    },
    {
      "id"   : "storage/external/write",
      "scope": { "roots": ["/tmp/plugin-data"] },
    },
  ] satisfies ReadonlyArray<PermissionRequest & object>)(
    "rejects process spawn combined with $id",
    storageWriteRequest => {
      const processRequest = {
        "id"   : "system/process/spawn",
        "scope": {
          "executables": [{ "path": "/usr/bin/git", "arguments": ["status"] }],
        },
      } as const;

      for (const requests of [
        [processRequest, storageWriteRequest],
        [storageWriteRequest, processRequest],
      ] satisfies ReadonlyArray<ReadonlyArray<PermissionRequest>>) {
        expect(() => normalizePermissionRequests(requests)).toThrow(
          "system/process/spawn cannot be combined with storage write permissions",
        );
      }
    },
  );

  test.each([
    "/srv/../etc",
    "relative/path",
    String.raw`c:\lowercase-drive`,
  ])("rejects a non-canonical external root: %s", root => {
    expect(() => normalizePermissionRequests([{
      "id"   : "storage/external/read",
      "scope": { "roots": [root] },
    }])).toThrow(TypeError);
  });

  test.each(["unknown/scoped", "__proto__"])(
    "rejects structured permission ID at the runtime boundary: %s",
    id => {
      expect(() => Reflect.apply(normalizePermissionRequests, undefined, [[{
        id,
        "scope": {},
      }]])).toThrow("Invalid structured permission request");
    },
  );
});
