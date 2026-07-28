import { beforeEach, expect, test, vi } from "vitest";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import type {
  BrokerServerProcess,
  HostFacade,
  ProcessHandle,
} from "@/lib/capability-broker";
import { serveCode } from "@/lib/txiki/serve-code.ts";
import { serveFile } from "@/lib/txiki/serve-file.ts";
import { serverProcesses } from "@/states/servers.ts";

const brokerMocks = vi.hoisted(() => ({
  "serveCode": vi.fn<HostFacade["servers"]["serveCode"]>(),
  "serveFile": vi.fn<HostFacade["servers"]["serveFile"]>(),
}));

vi.mock("@/lib/capability-broker", () => ({
  "Host": {
    "servers": {
      "serveCode": brokerMocks.serveCode,
      "serveFile": brokerMocks.serveFile,
    },
  },
}));

const serverProcess = Object.freeze({
  "handle": "broker-server-handle" as ProcessHandle,
  "pid"   : 81,
  "port"  : 45_123,
}) satisfies BrokerServerProcess;

beforeEach(() => {
  brokerMocks.serveCode.mockReset();
  brokerMocks.serveFile.mockReset();
  brokerMocks.serveCode.mockResolvedValue(serverProcess);
  brokerMocks.serveFile.mockResolvedValue(serverProcess);
  GlobalInternals.serverProcesses = [];
  serverProcesses.value = [];
});

test("serveCode passes executable contents only through Host.servers", async () => {
  await expect(serveCode("generated", "export default {}"))
    .resolves.toBe(serverProcess);
  expect(brokerMocks.serveCode).toHaveBeenCalledWith(
    { "name": "generated", "code": "export default {}" },
    expect.any(Function),
  );
  expect(GlobalInternals.serverProcesses[0]?.value).toBe(serverProcess);
  expect(serverProcesses.value[0]?.value).toBe(serverProcess);
});

test("serveFile passes the path only through Host.servers", async () => {
  await expect(serveFile("existing", "/trusted/server.tjs"))
    .resolves.toBe(serverProcess);
  expect(brokerMocks.serveFile).toHaveBeenCalledWith(
    { "name": "existing", "filePath": "/trusted/server.tjs" },
    expect.any(Function),
  );
  expect(GlobalInternals.serverProcesses[0]?.value).toBe(serverProcess);
  expect(serverProcesses.value[0]?.value).toBe(serverProcess);
});
