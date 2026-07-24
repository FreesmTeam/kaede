import { GlobalInternals } from "@/extendable/global-internals.ts";
import type {
  BrokerServerProcess,
  ProcessEvent,
  ProcessHandle,
} from "@/lib/capability-broker";
import { log } from "@/lib/logging/scopes/log.ts";
import { serverProcesses } from "@/states/servers.ts";

function removeServer(handle: ProcessHandle): void {
  GlobalInternals.serverProcesses = GlobalInternals.serverProcesses.filter(item => {
    return item.value.handle !== handle;
  });
  serverProcesses.value = [...GlobalInternals.serverProcesses];
}

function logOutput(kind: "stdout" | "stderr", output: string): void {
  if (output === "") {
    return;
  }

  const message = kind === "stdout"
    ? "Received data for a txiki server:\n"
    : "Received an error for a txiki server:\n";

  if (kind === "stdout") {
    log.debug(__PRE_BUNDLED_FILENAME__, message, output);
  } else {
    log.error(__PRE_BUNDLED_FILENAME__, message, output);
  }
}

export async function handleServerProcess(
  name: string,
  start: (onEvent: (event: ProcessEvent) => void) => Promise<BrokerServerProcess>,
): Promise<BrokerServerProcess | undefined> {
  const decoders = {
    "stdout": new TextDecoder,
    "stderr": new TextDecoder,
  } as const;
  const decoderFlushOrder: Array<"stdout" | "stderr"> = ["stdout", "stderr"];
  let registered = false;
  let terminalBeforeRegistration = false;
  let terminalEventReceived = false;
  let process: BrokerServerProcess | undefined;
  const decodeOutput = (kind: "stdout" | "stderr", bytes: Uint8Array): string => {
    decoderFlushOrder.splice(decoderFlushOrder.indexOf(kind), 1);
    decoderFlushOrder.push(kind);

    return decoders[kind].decode(bytes, { "stream": true });
  };
  const flushOutput = (): void => {
    for (const kind of decoderFlushOrder) {
      const remaining = decoders[kind].decode();

      if (remaining !== "") {
        logOutput(kind, remaining);
      }
    }
  };
  const handleTerminalEvent = (): void => {
    terminalEventReceived = true;
    flushOutput();
    if (registered && process !== undefined) {
      removeServer(process.handle);
    } else {
      terminalBeforeRegistration = true;
    }
  };
  const onEvent = (event: ProcessEvent): void => {
    if (terminalEventReceived) {
      return;
    }

    switch (event.kind) {
      case "stdout": {
        logOutput(event.kind, decodeOutput(event.kind, event.bytes));
        break;
      }
      case "stderr": {
        logOutput(event.kind, decodeOutput(event.kind, event.bytes));
        break;
      }
      case "error": {
        log.error(__PRE_BUNDLED_FILENAME__, "Txiki server process diagnostic:", event.message);
        break;
      }
      case "failed": {
        handleTerminalEvent();
        log.error(__PRE_BUNDLED_FILENAME__, "Txiki server process failed:", event.message);
        break;
      }
      case "terminated": {
        handleTerminalEvent();
        break;
      }
    }
  };

  try {
    process = await start(onEvent);
  } catch (error: unknown) {
    if (!terminalEventReceived) {
      terminalEventReceived = true;
      flushOutput();
    }

    throw error;
  }

  if (terminalBeforeRegistration) {
    return;
  }

  GlobalInternals.serverProcesses.push({ name, "port": process.port, "value": process });
  registered = true;
  serverProcesses.value = [...GlobalInternals.serverProcesses];

  return process;
}
