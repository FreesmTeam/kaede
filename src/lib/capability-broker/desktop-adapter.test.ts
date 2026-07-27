import { describe, expect, test } from "vitest";

import {
  createIpcMock,
  type InvokeArguments,
  noEventCapability,
  principal,
} from "@/lib/capability-broker/desktop-adapter.test-helpers.ts";
import {
  createDesktopCapabilityBroker,
} from "@/lib/capability-broker/desktop-adapter.ts";

describe("desktop capability broker", () => {
  test("routes diagnostics and file metadata through the host session", async () => {
    const { calls, ipc } = createIpcMock();
    const runtime = await createDesktopCapabilityBroker(noEventCapability, ipc);

    await expect(runtime.host.diagnostics.getSystemMemory()).resolves.toEqual({
      "usedBytes" : 4_294_967_296,
      "totalBytes": 8_589_934_592,
    });
    await expect(runtime.host.diagnostics.getGlobalCpuUsage()).resolves.toBe(12.5);
    await expect(runtime.host.files.getMetadata("/app/data/cache.json")).resolves.toEqual({
      "modifiedTimeMilliseconds": 1_753_488_000_000,
    });

    const routed = calls.filter(({ args }) => {
      const kind = (args as Partial<InvokeArguments>)?.request?.kind;

      return ["host_system_memory", "host_global_cpu_usage", "host_fs_metadata"]
        .includes(kind ?? "");
    });

    expect(routed.map(({ args }) => args)).toEqual([
      {
        "session": "host-secret",
        "request": { "kind": "host_system_memory" },
        "events" : undefined,
      },
      {
        "session": "host-secret",
        "request": { "kind": "host_global_cpu_usage" },
        "events" : undefined,
      },
      {
        "session": "host-secret",
        "request": {
          "kind"         : "host_fs_metadata",
          "path"         : "/app/data/cache.json",
          "baseDirectory": null,
        },
        "events": undefined,
      },
    ]);
  });

  test("loads the complete initial state through the host broker session", async () => {
    const { calls, ipc } = createIpcMock();
    const runtime = await createDesktopCapabilityBroker(noEventCapability, ipc);

    await expect(runtime.host.runtime.getInitialState()).resolves.toEqual({
      "basic": {
        "launcherVersion": "1.2.3",
        "baseDirectory"  : "/app/data",
        "launchCount"    : 3,
        "separator"      : "/",
        "portable"       : false,
      },
      "parsed": {
        "config"      : { "status": "loaded", "data": { "layout": "test" } },
        "accounts"    : { "status": "missing" },
        "instances"   : { "status": "missing" },
        "translations": {
          "status": "corrupt",
          "raw"   : "{",
          "error" : "unexpected end of input",
        },
      },
    });
    const initialStateCall = calls.find(({ args }) => {
      return (args as Partial<InvokeArguments>)?.request?.kind === "host_initial_state";
    });

    expect(initialStateCall?.args).toEqual({
      "session": "host-secret",
      "request": { "kind": "host_initial_state" },
      "events" : undefined,
    });
  });

  test("finalizes launcher initialization through the host broker session", async () => {
    const { calls, ipc } = createIpcMock();
    const runtime = await createDesktopCapabilityBroker(noEventCapability, ipc);
    const input = {
      "baseDirectory": "/app/data",
      "folders"      : ["assets", "libraries"],
      "javaBinary"   : "/opt/java/bin/java",
    } as const;

    await expect(runtime.host.runtime.finalizeInitialization(input)).resolves.toEqual({
      "createdDirectories": ["/app/data/assets", "/app/data/libraries"],
      "javaMajor"         : 21,
      "javaMajorSource"   : "release-file",
    });
    const finalizationCall = calls.find(({ args }) => {
      return (args as Partial<InvokeArguments>)?.request?.kind ===
        "host_finalize_initialization";
    });

    expect(finalizationCall?.args).toEqual({
      "session": "host-secret",
      "request": { "kind": "host_finalize_initialization", ...input },
      "events" : undefined,
    });
  });

  test("reads installed archives through a pathless host-only broker request", async () => {
    const { calls, ipc } = createIpcMock();
    const runtime = await createDesktopCapabilityBroker(noEventCapability, ipc);

    await expect(runtime.host.extensions.readInstalledArchives()).resolves.toEqual({
      "extensions": [{
        "fileName"      : "sample.kaede",
        "metadata"      : { "id": "sample" },
        "code"          : "void 0",
        "artifactSha256": "a".repeat(64),
      }],
      "failures": [{ "fileName": "broken.zip", "error": "invalid zip" }],
    });
    const extensionCall = calls.find(({ args }) => {
      return (args as Partial<InvokeArguments>)?.request?.kind === "host_read_extensions";
    });

    expect(extensionCall?.args).toEqual({
      "session": "host-secret",
      "request": { "kind": "host_read_extensions" },
      "events" : undefined,
    });
  });

  const preparedIdentityTestName =
    "carries backend-confirmed target identity from preparation into the exact grant";

  test(preparedIdentityTestName, async () => {
    const { calls, ipc } = createIpcMock();
    const runtime = await createDesktopCapabilityBroker(noEventCapability, ipc);
    const prepared = await runtime.preparePermissionRequests([{
      "id"   : "storage/external/read",
      "scope": { "roots": ["/lexical/storage-link"] },
    }]);
    const request = prepared[0];

    if (request === undefined) {
      throw new TypeError("Expected one prepared desktop permission request");
    }

    const session = await runtime.openPluginSession(principal("plugin.identity"));

    await session.grant(request);

    expect(request).toEqual({
      "descriptor": {
        "id"   : "storage/external/read",
        "scope": { "roots": ["/canonical/storage"] },
      },
      "targetIdentities": [{
        "kind"            : "external_storage_root",
        "path"            : "/canonical/storage",
        "identityProvider": "desktop-filesystem-v1",
        "device"          : "8",
        "inode"           : "80",
      }],
    });
    const prepareCall = calls.find(({ args }) => {
      return (args as Partial<InvokeArguments>)?.request?.kind ===
        "prepare_permission_requests";
    });
    const grantCall = calls.find(({ args }) => {
      return (args as Partial<InvokeArguments>)?.request?.kind === "grant_plugin";
    });

    expect(prepareCall?.args).toMatchObject({
      "session": "host-secret",
      "request": { "kind": "prepare_permission_requests" },
    });
    expect(grantCall?.args).toMatchObject({
      "session": "host-secret",
      "request": {
        "kind"         : "grant_plugin",
        "pluginSession": "plugin-secret-1",
        "prepared"     : request,
      },
    });
    expect(JSON.stringify(session)).not.toContain("plugin-secret");
    expect(session).not.toHaveProperty("invoke");
  });

  test("maps host HTTP DTOs into a standard binary Response", async () => {
    const { calls, ipc } = createIpcMock();
    const runtime = await createDesktopCapabilityBroker(noEventCapability, ipc);
    const response = await runtime.host.http.fetch("https://example.test/data", {
      "method" : "POST",
      "headers": { "x-test": "mapped" },
      "body"   : Uint8Array.from([1, 2, 3]),
    });
    const fetchCall = calls.find(({ args }) => {
      return (args as Partial<InvokeArguments>)?.request?.kind === "host_http_fetch";
    });

    expect(fetchCall).toBeDefined();
    if (fetchCall === undefined) {
      throw new Error("Expected a host_http_fetch broker call");
    }

    const request = (fetchCall.args as InvokeArguments).request;

    expect(request).toMatchObject({
      "kind"   : "host_http_fetch",
      "request": {
        "url"    : "https://example.test/data",
        "method" : "POST",
        "headers": [{ "name": "x-test", "value": "mapped" }],
        "body"   : [1, 2, 3],
      },
    });
    expect(response.status).toBe(201);
    expect(response.url).toBe("https://example.test/final");
    expect(response.redirected).toBe(true);
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([0, 127, 255]);
  });

  test(
    "keeps tokens out of the public session and binds process controls to their owner",
    async () => {
      const { calls, ipc } = createIpcMock();
      const runtime = await createDesktopCapabilityBroker(noEventCapability, ipc);
      const sessionA = await runtime.openPluginSession(principal("plugin.a"));
      const sessionB = await runtime.openPluginSession(principal("plugin.b"));
      const processA = await sessionA.capabilityFactories["system/process/spawn"]().spawn({
        "path"     : "/bin/example-a",
        "arguments": [],
      });
      const processB = await sessionB.capabilityFactories["system/process/spawn"]().spawn({
        "path"     : "/bin/example-b",
        "arguments": [],
      });

      expect(JSON.stringify(sessionA)).not.toContain("host-secret");
      expect(JSON.stringify(sessionA)).not.toContain("plugin-secret");
      expect(Object.isFrozen(processA)).toBe(true);
      expect(Reflect.set(processA, "handleId", processB.handleId)).toBe(false);

      await processA.kill();
      await processB.kill();

      const killCalls = calls.filter(({ args }) => {
        return (args as Partial<InvokeArguments>)?.request?.kind === "process_kill";
      }).map(({ args }) => args as InvokeArguments);

      expect(killCalls.map(({ session }) => session)).toEqual([
        "plugin-secret-1",
        "plugin-secret-2",
      ]);
      await expect(processA.wait()).resolves.toEqual({
        "code"  : 0,
        "signal": null,
        "stdout": [65, 66],
        "stderr": [67],
      });
    },
  );
});
