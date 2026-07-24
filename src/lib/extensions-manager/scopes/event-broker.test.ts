import { describe, expect, it, vi } from "vitest";

import { ExtensionEvents } from "@/constants/event-listeners.ts";
import {
  createEventSnapshot,
  EventBroker,
  EventDispatchError,
  type ExtensionEventSnapshot,
} from "@/lib/extensions-manager/scopes/event-broker.ts";
import {
  createEventSubscribeCapability,
  revokeEventListeners,
} from "@/lib/extensions-manager/scopes/grant-event-listeners.ts";
import { handleEvent } from "@/lib/extensions-manager/scopes/handle-event.ts";
import {
  createPluginPrincipal,
  createPluginPrincipalKey,
} from "@/lib/extensions-manager/scopes/principal.ts";

describe("EventBroker", () => {
  it("publishes a deep immutable snapshot rather than shared mutable records", () => {
    const broker = new EventBroker;
    const first: Array<ExtensionEventSnapshot> = [];
    const second: Array<ExtensionEventSnapshot> = [];
    const source = {
      "instance": { "id": "alpha" },
      "routes"  : ["home", "settings"],
    };

    broker.subscribe("principal:first", event => first.push(event));
    broker.subscribe("principal:second", event => second.push(event));
    broker.publish("instance", source);

    source.instance.id = "mutated";
    source.routes.push("unsafe");

    expect(first[0]).toEqual({
      "type" : "instance",
      "value": {
        "instance": { "id": "alpha" },
        "routes"  : ["home", "settings"],
      },
    });
    expect(second[0]).toBe(first[0]);
    expect(Object.isFrozen(first[0])).toBe(true);
    expect(Object.isFrozen((first[0]?.value as Record<string, unknown>).instance)).toBe(true);
    expect(() => {
      const snapshot = first[0]?.value as { "instance": { "id": string } };

      snapshot.instance.id = "guest mutation";
    }).toThrow(TypeError);
  });

  it.each([
    ["functions", { "handler": (): void => {} }],
    ["symbols", { "token": Symbol("token") }],
    ["non-plain objects", { "created": new Date }],
    ["accessors", Object.defineProperty({}, "value", { "get": () => "unsafe" })],
  ])("rejects %s in event payloads", (_label, value) => {
    expect(() => createEventSnapshot("event", value)).toThrow(
      "Event payload is not immutable snapshot data",
    );
  });

  it("rejects cyclic payloads", () => {
    const cyclic: { "self"?: unknown } = {};

    cyclic.self = cyclic;

    expect(() => createEventSnapshot("event", cyclic)).toThrow("cyclic object graph");
  });

  it("unsubscribes and disposes idempotently", () => {
    const broker = new EventBroker;
    const listener = vi.fn();
    const unsubscribe = broker.subscribe("principal", listener);

    broker.publish("routing", "home");
    unsubscribe();
    unsubscribe();
    broker.publish("routing", "settings");
    broker.dispose();
    broker.dispose();

    expect(listener).toHaveBeenCalledOnce();
    expect(() => broker.publish("routing", "home")).toThrow("disposed");
    expect(() => broker.subscribe("new", listener)).toThrow("disposed");
  });

  it("removes every subscription owned by one principal", () => {
    const broker = new EventBroker;
    const first = vi.fn();
    const second = vi.fn();
    const remaining = vi.fn();

    broker.subscribe("principal:disposed", first);
    broker.subscribe("principal:disposed", second);
    broker.subscribe("principal:remaining", remaining);
    broker.unsubscribePrincipal("principal:disposed");
    broker.publish("routing", "home");

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(remaining).toHaveBeenCalledOnce();
  });

  it("keys the broker capability and forced cleanup by the exact principal", () => {
    const principal = createPluginPrincipal({
      "repositoryOrigin": "https://example.test/plugins",
      "pluginId"        : "event-plugin",
      "version"         : "1.0.0",
      "artifactSha256"  : "a".repeat(64),
    });
    const capability = createEventSubscribeCapability(principal);
    const listener = vi.fn();

    capability.subscribe(listener);
    ExtensionEvents.publish("routing", "home");
    revokeEventListeners(createPluginPrincipalKey(principal));
    ExtensionEvents.publish("routing", "settings");

    expect(listener).toHaveBeenCalledOnce();
    expect(Object.isFrozen(capability)).toBe(true);
    expect(() => capability.subscribe(listener)).toThrow("revoked");

    const replacement = createEventSubscribeCapability(principal);

    replacement.subscribe(listener);
    ExtensionEvents.publish("routing", "replacement");
    revokeEventListeners(createPluginPrincipalKey(principal));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("notifies remaining subscribers when one listener throws", () => {
    const broker = new EventBroker;
    const successfulListener = vi.fn();

    broker.subscribe("throwing", () => {
      throw new Error("listener failed");
    });
    broker.subscribe("successful", successfulListener);

    expect(() => broker.publish("routing", "home")).toThrow(EventDispatchError);
    expect(successfulListener).toHaveBeenCalledOnce();
  });

  it("contains listener faults at the host event boundary", () => {
    const throwingPrincipal = createPluginPrincipal({
      "repositoryOrigin": "https://example.test/plugins",
      "pluginId"        : "throwing-event-plugin",
      "version"         : "1.0.0",
      "artifactSha256"  : "b".repeat(64),
    });
    const successfulPrincipal = createPluginPrincipal({
      "repositoryOrigin": "https://example.test/plugins",
      "pluginId"        : "successful-event-plugin",
      "version"         : "1.0.0",
      "artifactSha256"  : "c".repeat(64),
    });
    const successfulListener = vi.fn();

    createEventSubscribeCapability(throwingPrincipal).subscribe(() => {
      throw new Error("listener failed");
    });
    createEventSubscribeCapability(successfulPrincipal).subscribe(successfulListener);

    expect(() => handleEvent("routing", "home")).not.toThrow();
    expect(successfulListener).toHaveBeenCalledOnce();

    revokeEventListeners(createPluginPrincipalKey(throwingPrincipal));
    revokeEventListeners(createPluginPrincipalKey(successfulPrincipal));
  });
});
