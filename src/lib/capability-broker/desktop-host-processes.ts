import type { BrokerCall } from "@/lib/capability-broker/desktop-codecs.ts";
import {
  asProcessHandle,
  expectResponse,
  toProcessEvent,
} from "@/lib/capability-broker/desktop-codecs.ts";
import { spawnServer } from "@/lib/capability-broker/desktop-processes.ts";
import type {
  BrokerProcess,
  BrokerServerProcess,
  HostFacade,
  ProcessHandle,
} from "@/lib/capability-broker/types.ts";

export type DesktopHostProcesses = Readonly<{
  "processes": HostFacade["processes"];
  "servers"  : HostFacade["servers"];
}>;

type LaunchInput = Parameters<HostFacade["processes"]["launchMinecraft"]>[0];
type ProcessEventHandler = Parameters<HostFacade["processes"]["launchMinecraft"]>[1];
type ServeCodeInput = Parameters<HostFacade["servers"]["serveCode"]>[0];
type ServeFileInput = Parameters<HostFacade["servers"]["serveFile"]>[0];

export function createDesktopHostProcesses(call: BrokerCall): DesktopHostProcesses {
  return Object.freeze({
    "processes": Object.freeze({
      "probeJavaMajor": async (): Promise<number> => {
        const response = expectResponse(
          await call({ "kind": "host_probe_java_major" }),
          "java_major",
        );

        return response.major;
      },
      "launchMinecraft": async (
        input: LaunchInput,
        onEvent: ProcessEventHandler,
      ): Promise<BrokerProcess> => {
        const response = expectResponse(await call({
          "kind"      : "host_launch_minecraft",
          "executable": input.executable,
          "arguments" : input.arguments,
          "cwd"       : input.cwd,
          "instanceId": input.instanceId,
        }, event => {
          const processEvent = toProcessEvent(event);

          if (processEvent !== undefined) {
            onEvent(processEvent);
          }
        }), "process_spawned");

        return Object.freeze({
          "handle": asProcessHandle(response.handle),
          "pid"   : response.pid,
        });
      },
      "kill": async (handle: ProcessHandle): Promise<void> => {
        expectResponse(await call({ "kind": "process_kill", handle }), "unit");
      },
    }),
    "servers": Object.freeze({
      "serveCode": (
        input: ServeCodeInput,
        onEvent: ProcessEventHandler,
      ): Promise<BrokerServerProcess> => {
        return spawnServer(call, { "kind": "host_serve_code", ...input }, onEvent);
      },
      "serveFile": (
        input: ServeFileInput,
        onEvent: ProcessEventHandler,
      ): Promise<BrokerServerProcess> => {
        return spawnServer(call, { "kind": "host_serve_file", ...input }, onEvent);
      },
    }),
  });
}
