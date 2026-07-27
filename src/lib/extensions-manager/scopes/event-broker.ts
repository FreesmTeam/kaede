import type { PluginPrincipalKey } from "@/lib/extensions-manager/scopes/principal.ts";

export type EventSnapshotPrimitive =
  | null
  | undefined
  | boolean
  | number
  | bigint
  | string;

declare const EVENT_SNAPSHOT_ARRAY: unique symbol;

export interface EventSnapshotArray extends ReadonlyArray<EventSnapshotValue> {
  readonly [EVENT_SNAPSHOT_ARRAY]?: never;
}

export interface EventSnapshotRecord {
  readonly [key: string]: EventSnapshotValue;
}

export type EventSnapshotValue =
  | EventSnapshotPrimitive
  | EventSnapshotArray
  | EventSnapshotRecord;

export type ExtensionEventSnapshot<Type extends string = string> = Readonly<{
  "type" : Type;
  "value": EventSnapshotValue;
}>;

export type ExtensionEventListener = (event: ExtensionEventSnapshot) => void;

export class EventDispatchError extends Error {
  readonly errors: ReadonlyArray<unknown>;

  constructor(type: string, errors: ReadonlyArray<unknown>) {
    super(`Extension event listeners failed for ${JSON.stringify(type)}`);
    this.name = "EventDispatchError";
    this.errors = Object.freeze([...errors]);
  }
}

function invalidSnapshot(reason: string): TypeError {
  return new TypeError(`Event payload is not immutable snapshot data: ${reason}`);
}

function cloneSnapshot(
  value: unknown,
  ancestors: WeakSet<object>,
): EventSnapshotValue {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (typeof value === "function" || typeof value === "symbol") {
    throw invalidSnapshot(typeof value);
  }

  if (typeof value !== "object") {
    throw invalidSnapshot(typeof value);
  }

  if (ancestors.has(value)) {
    throw invalidSnapshot("cyclic object graph");
  }

  const prototype = Object.getPrototypeOf(value);

  if (prototype !== null && !Array.isArray(value) && prototype !== Object.prototype) {
    throw invalidSnapshot("non-plain object");
  }

  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      return Object.freeze(value.map(item => cloneSnapshot(item, ancestors)));
    }

    const snapshot: Record<string, EventSnapshotValue> = Object.create(null);

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        throw invalidSnapshot("symbol property key");
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);

      if (descriptor === undefined || !("value" in descriptor)) {
        throw invalidSnapshot(`accessor property ${JSON.stringify(key)}`);
      }

      Object.defineProperty(snapshot, key, {
        "configurable": false,
        "enumerable"  : descriptor.enumerable,
        "value"       : cloneSnapshot(descriptor.value, ancestors),
        "writable"    : false,
      });
    }

    return Object.freeze(snapshot);
  } finally {
    ancestors.delete(value);
  }
}

export function createEventSnapshot<Type extends string>(
  type: Type,
  value: unknown,
): ExtensionEventSnapshot<Type> {
  if (type.length === 0) {
    throw new TypeError("Event type cannot be empty");
  }

  return Object.freeze({
    type,
    "value": cloneSnapshot(value, new WeakSet),
  });
}

export class EventBroker {
  readonly #listeners = (new Map<PluginPrincipalKey, Set<ExtensionEventListener>>);
  #disposed = false;

  subscribe(
    principalKey: PluginPrincipalKey,
    listener: ExtensionEventListener,
  ): () => void {
    if (this.#disposed) {
      throw new TypeError("Event broker has been disposed");
    }

    if (principalKey.length === 0) {
      throw new TypeError("Event subscriber principal key cannot be empty");
    }

    const listeners = this.#listeners.get(principalKey) ?? (new Set<ExtensionEventListener>);

    listeners.add(listener);
    this.#listeners.set(principalKey, listeners);
    let isSubscribed = true;

    return (): void => {
      if (!isSubscribed) {
        return;
      }

      isSubscribed = false;

      const currentListeners = this.#listeners.get(principalKey);

      currentListeners?.delete(listener);

      if (currentListeners?.size === 0) {
        this.#listeners.delete(principalKey);
      }
    };
  }

  unsubscribePrincipal(principalKey: PluginPrincipalKey): void {
    this.#listeners.delete(principalKey);
  }

  publish(type: string, value: unknown): void {
    if (this.#disposed) {
      throw new TypeError("Event broker has been disposed");
    }

    const event = createEventSnapshot(type, value);
    const errors: Array<unknown> = [];

    for (const listeners of this.#listeners.values()) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error: unknown) {
          errors.push(error);
        }
      }
    }

    if (errors.length > 0) {
      throw new EventDispatchError(type, errors);
    }
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#listeners.clear();
  }
}
