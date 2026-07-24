import { beforeEach, expect, test, vi } from "vitest";

import type {
  BrokerServerProcess,
  ProcessHandle,
} from "@/lib/capability-broker";
import Txiki from "@/lib/txiki";

const txikiMocks = vi.hoisted(() => ({
  "serveCode": vi.fn<(
    name: string,
    code: string,
  ) => Promise<BrokerServerProcess | undefined>>(),
}));

vi.mock("@/lib/txiki/serve-code.ts", () => ({
  "serveCode": txikiMocks.serveCode,
}));

const serverProcess = Object.freeze({
  "handle": "txiki-server-handle" as ProcessHandle,
  "pid"   : 73,
  "port"  : 43_127,
}) satisfies BrokerServerProcess;

beforeEach(() => {
  txikiMocks.serveCode.mockReset();
  txikiMocks.serveCode.mockResolvedValue(serverProcess);
});

test("builds routes and trusted globals before broker serving", async () => {
  const txiki = (new Txiki)
    .defineGlobal("greeting", { "text": "hello" })
    .defineGlobal("helper", (): string => "ok")
    .get("/status", ({ params }) => params)
    .post("/echo", ({ body }) => body);

  await expect(txiki.listen()).resolves.toBe(serverProcess);
  expect(txikiMocks.serveCode).toHaveBeenCalledOnce();

  const call = txikiMocks.serveCode.mock.calls[0];

  expect(call).toBeDefined();
  expect(call?.[0]).toMatch(/^txiki-\d+$/u);
  expect(call?.[1]).toContain("const greeting={\"text\":\"hello\"};");
  expect(call?.[1]).toContain("const helper=");
  expect(call?.[1]).toContain("GET:{\"/status\":");
  expect(call?.[1]).toContain("POST:{\"/echo\":");
  expect(call?.[1]).not.toContain("WebSocket");
  expect(call?.[1]).not.toContain("/__ws");
  expect(call?.[1]).not.toContain("Access-Control-Allow-Origin");
});

test("rejects names that cannot form safe const declarations", () => {
  expect(() => (new Txiki).defineGlobal("not-valid", 1)).toThrow(
    "Invalid Txiki global identifier",
  );
  expect(() => (new Txiki).defineGlobal("await", 1)).toThrow(
    "Invalid Txiki global identifier",
  );
  for (const generatedBinding of ["routes", "readBody", "toResponse"]) {
    expect(() => (new Txiki).defineGlobal(generatedBinding, 1)).toThrow(
      "Invalid Txiki global identifier",
    );
  }
  expect(() => (new Txiki).defineGlobal("данные", 1)).not.toThrow();
});

test("does not treat a renderer-selected port as a host binding", async () => {
  await expect((new Txiki).listen(42_069)).rejects.toThrow(
    "ports are assigned atomically by the host broker",
  );
  expect(txikiMocks.serveCode).not.toHaveBeenCalled();
});

test("assigns a distinct UI name to every broker server", async () => {
  const txiki = new Txiki;

  await Promise.all([txiki.listen(), txiki.listen()]);

  const names = txikiMocks.serveCode.mock.calls.map(([name]) => name);

  expect(names).toHaveLength(2);
  expect(new Set(names)).toHaveProperty("size", 2);
});
