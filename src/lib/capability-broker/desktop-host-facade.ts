import type { BrokerCall } from "@/lib/capability-broker/desktop-codecs.ts";
import {
  expectResponse,
  toInitializationFinalizationReport,
  toInitialState,
} from "@/lib/capability-broker/desktop-codecs.ts";
import {
  toGlobalCpuUsage,
  toHashDigest,
  toSystemMemory,
} from "@/lib/capability-broker/desktop-host-codecs.ts";
import { createDesktopHostIo } from "@/lib/capability-broker/desktop-host-io.ts";
import {
  createDesktopHostProcesses,
} from "@/lib/capability-broker/desktop-host-processes.ts";
import {
  createDesktopHostStorage,
} from "@/lib/capability-broker/desktop-host-storage.ts";
import type {
  HostFacade,
  RuntimeSnapshot,
} from "@/lib/capability-broker/types.ts";

export function createDesktopHostFacade(call: BrokerCall): HostFacade {
  let runtimeSnapshot: RuntimeSnapshot | undefined;
  let runtimeSnapshotTask: Promise<RuntimeSnapshot> | undefined;
  const storage = createDesktopHostStorage(call);
  const io = createDesktopHostIo(call);
  const processes = createDesktopHostProcesses(call);
  const loadRuntimeSnapshot = async (): Promise<RuntimeSnapshot> => {
    const response = await call({ "kind": "host_runtime_snapshot" });
    const snapshot = expectResponse(response, "runtime_snapshot");

    runtimeSnapshot = Object.freeze({
      "kind"               : snapshot.runtimeKind,
      "launchCount"        : snapshot.launchCount,
      "portable"           : snapshot.portable,
      "baseDirectory"      : snapshot.baseDirectory,
      "executableDirectory": snapshot.executableDirectory,
      "appDataDirectory"   : snapshot.appDataDirectory,
      "os"                 : Object.freeze({ ...snapshot.os }),
    });

    return runtimeSnapshot;
  };
  const getRuntimeSnapshot = (): Promise<RuntimeSnapshot> => {
    runtimeSnapshotTask ??= loadRuntimeSnapshot();

    return runtimeSnapshotTask;
  };

  return Object.freeze({
    "diagnostics": Object.freeze({
      "getSystemMemory": async () => {
        const response = expectResponse(
          await call({ "kind": "host_system_memory" }),
          "system_memory",
        );

        return toSystemMemory(response.usedBytes, response.totalBytes);
      },
      "getGlobalCpuUsage": async () => {
        const response = expectResponse(
          await call({ "kind": "host_global_cpu_usage" }),
          "global_cpu_usage",
        );

        return toGlobalCpuUsage(response.usage);
      },
    }),
    "hashes": Object.freeze({
      "md5": async bytes => {
        const response = expectResponse(
          await call({ "kind": "host_hash_md5", "bytes": [...bytes] }),
          "text",
        );

        return toHashDigest(response.text, "md5");
      },
      "sha256": async bytes => {
        const response = expectResponse(
          await call({ "kind": "host_hash_sha256", "bytes": [...bytes] }),
          "text",
        );

        return toHashDigest(response.text, "sha256");
      },
    }),
    "runtime": Object.freeze({
      "getSnapshot"      : getRuntimeSnapshot,
      "getCachedSnapshot": (): RuntimeSnapshot => {
        if (runtimeSnapshot === undefined) {
          throw new Error("The runtime snapshot has not been loaded");
        }

        return runtimeSnapshot;
      },
      "getInitialState": async () => {
        const response = expectResponse(
          await call({ "kind": "host_initial_state" }),
          "initial_state",
        );

        return toInitialState(response.state);
      },
      "finalizeInitialization": async input => {
        const response = expectResponse(
          await call({ "kind": "host_finalize_initialization", ...input }),
          "initialization_finalized",
        );

        return toInitializationFinalizationReport(response.report);
      },
    }),
    ...storage,
    ...io,
    ...processes,
  } satisfies HostFacade);
}
