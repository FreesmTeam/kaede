import { afterEach, expect, test, vi } from "vitest";

import type {
  BrowserStorage,
  BrowserStorageValue,
} from "@/lib/browser/scopes/browser-storage.ts";
import {
  createDeferred,
  createMemoryStorage,
  grant,
  noEventCapability,
  principal,
} from "@/lib/browser/scopes/create-browser-capability-broker.test-helpers.ts";
import {
  createBrowserCapabilityBroker,
} from "@/lib/browser/scopes/create-browser-capability-broker.ts";
import type {
  PluginEventCapabilityFactory,
} from "@/lib/capability-broker/types.ts";

afterEach(() => vi.unstubAllGlobals());

async function captureOutcome<Value>(promise: Promise<Value>): Promise<unknown> {
  try {
    return await promise;
  } catch (error: unknown) {
    return error;
  }
}

async function observeSettlement(
  promise: Promise<unknown>,
  onSettled: () => void,
): Promise<void> {
  try {
    await promise;
  } catch {
    // This observer records settlement only; the test asserts the outcome separately.
  }

  onSettled();
}

test("browser session revocation drains a started storage write and denies new work", async () => {
  const writeStarted = createDeferred();
  const releaseWrite = createDeferred();
  const values = new Map<string, BrowserStorageValue>;
  let activeWrites = 0;
  let writeCalls = 0;
  const storage: BrowserStorage = Object.freeze({
    "keys": async () => [...values.keys()],
    "read": async (path: string) => {
      const value = values.get(path);

      return value === undefined
        ? Object.freeze({ "kind": "missing" as const })
        : Object.freeze({ "kind": "value" as const, value });
    },
    "write": async (path: string, value: BrowserStorageValue): Promise<void> => {
      writeCalls++;
      activeWrites++;
      writeStarted.resolve();

      try {
        await releaseWrite.promise;
        values.set(path, value);
      } finally {
        activeWrites--;
      }
    },
    "remove": async (path: string) => {
      values.delete(path);
    },
  });
  const runtime = await createBrowserCapabilityBroker(noEventCapability, storage);
  const session = await runtime.openPluginSession(principal());

  await grant(runtime, session, {
    "id"   : "storage/internal/write",
    "scope": { "directory": "principal" },
  });
  const internalWrite = session.capabilityFactories["storage/internal/write"]();
  const write = internalWrite.writeText("started.txt", "committed before revoke resolves");
  const writeOutcome = captureOutcome(write);

  await writeStarted.promise;

  const firstRevoke = session.revoke();
  const repeatedRevoke = session.revoke();
  let isFirstRevokeSettled = false;
  let isRepeatedRevokeSettled = false;

  void observeSettlement(firstRevoke, () => {
    isFirstRevokeSettled = true;
  });
  void observeSettlement(repeatedRevoke, () => {
    isRepeatedRevokeSettled = true;
  });
  await Promise.resolve();

  expect(isFirstRevokeSettled).toBe(false);
  expect(isRepeatedRevokeSettled).toBe(false);
  expect(activeWrites).toBe(1);
  await expect(internalWrite.writeText("denied.txt", "must not start"))
    .rejects.toThrow("session has been revoked");
  expect(writeCalls).toBe(1);

  releaseWrite.resolve();

  expect(await writeOutcome).toEqual(expect.objectContaining({
    "message": expect.stringContaining("session has been revoked"),
  }));
  await expect(firstRevoke).resolves.toEqual({ "alreadyRevoked": false });
  await expect(repeatedRevoke).resolves.toEqual({ "alreadyRevoked": true });
  expect(activeWrites).toBe(0);
  expect([...values.values()]).toContain("committed before revoke resolves");
  expect([...values.values()]).not.toContain("must not start");
  await expect(session.revoke()).resolves.toEqual({ "alreadyRevoked": true });
});

test("browser session revocation withholds a response while its body is being read", async () => {
  const bodyReadStarted = createDeferred();
  const releaseBody = createDeferred();
  const response = new Response("ignored", {
    "status"    : 404,
    "statusText": "Not Found",
  });
  let activeBodyReads = 0;
  const arrayBuffer = vi.spyOn(response, "arrayBuffer").mockImplementation(async () => {
    activeBodyReads++;
    bodyReadStarted.resolve();

    try {
      await releaseBody.promise;

      return Uint8Array.from([4, 0, 4]).buffer;
    } finally {
      activeBodyReads--;
    }
  });
  const fetchMock = vi.fn(async (): Promise<Response> => response);

  vi.stubGlobal("fetch", fetchMock);
  const runtime = await createBrowserCapabilityBroker(
    noEventCapability,
    createMemoryStorage(),
  );
  const session = await runtime.openPluginSession(principal());

  await grant(runtime, session, {
    "id"   : "network/http",
    "scope": { "origins": ["https://a.example.test"], "methods": ["GET"] },
  });
  const network = session.capabilityFactories["network/http"]();
  const fetchResult = network.fetch({
    "url"    : "https://a.example.test/missing",
    "method" : "GET",
    "headers": [],
  });
  const fetchOutcome = captureOutcome(fetchResult);

  await bodyReadStarted.promise;

  const revoke = session.revoke();
  let isRevokeSettled = false;

  void observeSettlement(revoke, () => {
    isRevokeSettled = true;
  });
  await Promise.resolve();

  expect(isRevokeSettled).toBe(false);
  expect(activeBodyReads).toBe(1);

  releaseBody.resolve();

  expect(await fetchOutcome).toEqual(expect.objectContaining({
    "message": expect.stringContaining("session has been revoked"),
  }));
  await expect(revoke).resolves.toEqual({ "alreadyRevoked": false });
  expect(activeBodyReads).toBe(0);
  expect(arrayBuffer).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledWith("https://a.example.test/missing", {
    "credentials": "omit",
    "headers"    : [],
    "method"     : "GET",
    "redirect"   : "manual",
  });
});

test("captured synchronous browser capabilities deny calls after revocation", async () => {
  const subscribe = vi.fn(() => vi.fn());
  const eventFactory: PluginEventCapabilityFactory = () => Object.freeze({ subscribe });
  const getEventFactory = (): PluginEventCapabilityFactory => eventFactory;
  const runtime = await createBrowserCapabilityBroker(
    getEventFactory,
    createMemoryStorage(),
  );
  const session = await runtime.openPluginSession(principal());

  await grant(runtime, session, "events/subscribe");
  await grant(runtime, session, "logging/write");
  const events = session.capabilityFactories["events/subscribe"]();
  const logging = session.capabilityFactories["logging/write"]();

  await session.revoke();

  expect(() => events.subscribe(() => {})).toThrow("session has been revoked");
  expect(() => logging.write("info", "must not be logged"))
    .toThrow("session has been revoked");
  expect(subscribe).not.toHaveBeenCalled();
});
