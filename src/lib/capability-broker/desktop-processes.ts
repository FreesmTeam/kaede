import type { BrokerRequest } from "@/lib/capability-broker/contract.ts";
import type { BrokerCall } from "@/lib/capability-broker/desktop-codecs.ts";
import {
  asProcessHandle,
  createProcessResult,
  expectResponse,
  toProcessEvent,
} from "@/lib/capability-broker/desktop-codecs.ts";
import type {
  BrokerServerProcess,
  ProcessEvent,
} from "@/lib/capability-broker/types.ts";
import type {
  ProcessHandleCapability,
  ProcessResult,
} from "@/types/extensions/permission.type.ts";

type Deferred<Value> = Readonly<{
  "promise": Promise<Value>;
  "resolve": (value: Value) => void;
  "reject" : (error: Error) => void;
}>;

function createDeferred<Value>(): Deferred<Value> {
  let resolvePromise!: (value: Value) => void;
  let rejectPromise!: (error: Error) => void;
  const promise = new Promise<Value>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return Object.freeze({
    promise,
    "resolve": resolvePromise,
    "reject" : rejectPromise,
  });
}

export async function spawnServer(
  call: BrokerCall,
  request: Extract<BrokerRequest, { "kind": "host_serve_code" | "host_serve_file" }>,
  onEvent: (event: ProcessEvent) => void,
): Promise<BrokerServerProcess> {
  const response = expectResponse(await call(request, event => {
    const processEvent = toProcessEvent(event);

    if (processEvent !== undefined) {
      onEvent(processEvent);
    }
  }), "server_spawned");

  return Object.freeze({
    "handle": asProcessHandle(response.handle),
    "pid"   : response.pid,
    "port"  : response.port,
  });
}

export async function createPluginProcess(
  call: BrokerCall,
  executable: string,
  argumentsList: ReadonlyArray<string>,
): Promise<ProcessHandleCapability> {
  const stdout: Array<number> = [];
  const stderr: Array<number> = [];
  const wait = createDeferred<ProcessResult>();
  const response = expectResponse(await call({
    "kind"   : "plugin_process_spawn",
    "process": {
      executable,
      "arguments"  : argumentsList,
      "cwd"        : null,
      "environment": {},
    },
  }, event => {
    switch (event.kind) {
      case "stdout": {
        stdout.push(...event.bytes);
        break;
      }
      case "stderr": {
        stderr.push(...event.bytes);
        break;
      }
      case "terminated": {
        wait.resolve(createProcessResult(event.code, event.signal, stdout, stderr));
        break;
      }
      case "error": {
        break;
      }
      case "failed": {
        wait.reject(new Error(event.message));
        break;
      }
      case "download_progress": {
        break;
      }
    }
  }), "process_spawned");
  const handle = response.handle;

  return Object.freeze({
    "handleId": handle,
    "pid"     : response.pid,
    "kill"    : async (): Promise<void> => {
      expectResponse(await call({ "kind": "process_kill", handle }), "unit");
    },
    "wait": (): Promise<ProcessResult> => wait.promise,
  });
}
