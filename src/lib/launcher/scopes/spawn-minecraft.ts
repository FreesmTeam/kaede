/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { LaunchStatus } from "@/constants/launcher.ts";
import { type BrokerProcess, Host, type ProcessEvent } from "@/lib/capability-broker";
import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LaunchResponseType } from "@/types/launcher/launch/launch-response.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export async function spawnMinecraft({
  command,
  instanceId,
  necessaries,
  onClose,
  onInput,
}: {
  "command": {
    "java"     : string;
    "arguments": Array<string>;
  };
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "onClose"    : (instanceId: string) => void;
  "onInput"    : (line: string) => void;
}): Promise<LaunchResponseType> {
  const beforeHooksResult: "continue" | LaunchResponseType | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<LaunchResponseType>({
      "scope" : "onMinecraftLaunch",
      "toPass": { command, instanceId, necessaries },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { directories, statuses, logPrefix } = necessaries;

  log.debug(
    logPrefix,
    `Spawning a Minecraft process with the '${directories.instance}' working directory`,
  );

  const decoders = {
    "stdout": new TextDecoder,
    "stderr": new TextDecoder,
  } as const;
  const decoderFlushOrder: Array<"stdout" | "stderr"> = ["stdout", "stderr"];
  const processState: { "current"?: BrokerProcess } = {};
  const queuedEvents: Array<ProcessEvent> = [];
  let terminalEvent: Extract<ProcessEvent, { "kind": "terminated" | "failed" }> | undefined;
  let didLaunchSucceed = false;
  const decodeOutput = (kind: "stdout" | "stderr", bytes: Uint8Array): string => {
    decoderFlushOrder.splice(decoderFlushOrder.indexOf(kind), 1);
    decoderFlushOrder.push(kind);

    return decoders[kind].decode(bytes, { "stream": true });
  };
  const flushOutput = (): void => {
    for (const kind of decoderFlushOrder) {
      const remaining = decoders[kind].decode();

      if (remaining !== "") {
        onInput(remaining);
      }
    }
  };
  const handleEvent = (event: ProcessEvent): void => {
    const process = processState.current;

    if (process === undefined) {
      queuedEvents.push(event);

      return;
    }

    if (terminalEvent !== undefined) {
      return;
    }

    switch (event.kind) {
      case "stdout":
      case "stderr": {
        const output = decodeOutput(event.kind, event.bytes);

        if (output !== "") {
          onInput(output);
        }
        break;
      }
      case "terminated": {
        terminalEvent = event;
        flushOutput();
        if (!didLaunchSucceed) {
          statuses.current = LaunchStatus.General.Aborted;
        }
        onClose(instanceId);
        log.warn(logPrefix, log.templates.json.contents("Successfully closed. Payload", event));
        void ExtensionsManager.catchAsyncVoidHooks({
          "scope" : "onMinecraftKill",
          "toPass": process.pid,
          "timing": "after",
        });
        break;
      }
      case "error": {
        log.error(logPrefix, log.templates.json.contents("Process diagnostic. Payload", event));
        break;
      }
      case "failed": {
        terminalEvent = event;
        flushOutput();
        onClose(instanceId);
        statuses.current = LaunchStatus.Errors.UnhandledError;
        log.error(logPrefix, log.templates.json.contents("Something went wrong. Payload", event));
        void ExtensionsManager.catchAsyncVoidHooks({
          "scope" : "onMinecraftKill",
          "toPass": process.pid,
          "timing": "after",
        });
        break;
      }
    }
  };

  let process: BrokerProcess;

  try {
    process = await Host.processes.launchMinecraft({
      "executable": command.java,
      "arguments" : command.arguments,
      "cwd"       : directories.instance,
      instanceId,
    }, handleEvent);
  } catch (error: unknown) {
    statuses.current = LaunchStatus.Errors.UnhandledError;
    log.error(logPrefix, log.templates.json.contents(
      "Failed to spawn. Payload",
      error,
    ));

    return { "success": false, "process": undefined };
  }

  processState.current = process;

  for (const event of queuedEvents) {
    handleEvent(event);
  }

  if (terminalEvent !== undefined) {
    return { "success": false, "process": undefined };
  }

  await ExtensionsManager.catchAsyncVoidHooks({
    "scope" : "onMinecraftLaunch",
    "toPass": { process, command, instanceId, necessaries },
    "timing": "after",
  });

  if (terminalEvent !== undefined) {
    return { "success": false, "process": undefined };
  }

  log.info(logPrefix, `Successfully launched with the ${process.pid} PID`);
  statuses.current = LaunchStatus.General.Success;
  didLaunchSucceed = true;

  return { "success": true, process };
}
