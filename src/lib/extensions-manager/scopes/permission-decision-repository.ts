import type {
  PermissionDecisionStoreKey,
} from "@/lib/capability-broker/types.ts";
import {
  getPermissionDecisionMemoryKey,
} from "@/lib/extensions-manager/scopes/permission-prompt-fingerprints.ts";
import type {
  PermissionDecisionStore,
} from "@/lib/extensions-manager/scopes/permission-prompt-types.ts";

export class InMemoryPermissionDecisionStore implements PermissionDecisionStore {
  readonly #decisions = (new Map<string, boolean>);

  load(key: PermissionDecisionStoreKey): boolean | undefined {
    return this.#decisions.get(getPermissionDecisionMemoryKey(key));
  }

  save(key: PermissionDecisionStoreKey, isAllowed: boolean): void {
    this.#decisions.set(getPermissionDecisionMemoryKey(key), isAllowed);
  }
}

export class PermissionDecisionRepository {
  readonly #sessionDecisions = (new Map<string, boolean>);
  #store: PermissionDecisionStore;
  #storeGeneration = 0;

  constructor(store: PermissionDecisionStore) {
    this.#store = store;
  }

  async #rememberEntries(
    entries: ReadonlyArray<Readonly<{
      "key"     : PermissionDecisionStoreKey;
      "decision": boolean;
    }>>,
    isCurrent: () => boolean,
  ): Promise<void> {
    const store = this.#store;
    const storeGeneration = this.#storeGeneration;

    for (const { key, decision } of entries) {
      if (storeGeneration !== this.#storeGeneration || !isCurrent()) {
        return;
      }

      await store.save(key, decision);
    }

    if (storeGeneration !== this.#storeGeneration || !isCurrent()) {
      return;
    }

    for (const { key, decision } of entries) {
      this.#sessionDecisions.set(getPermissionDecisionMemoryKey(key), decision);
    }
  }

  replaceStore(store: PermissionDecisionStore): void {
    this.#sessionDecisions.clear();
    this.#storeGeneration++;
    this.#store = store;
  }

  async load(key: PermissionDecisionStoreKey): Promise<boolean | undefined> {
    const keyFingerprint = getPermissionDecisionMemoryKey(key);

    if (this.#sessionDecisions.has(keyFingerprint)) {
      return this.#sessionDecisions.get(keyFingerprint);
    }

    try {
      const store = this.#store;
      const storeGeneration = this.#storeGeneration;
      const decision = await store.load(key);

      if (
        typeof decision === "boolean" &&
        storeGeneration === this.#storeGeneration
      ) {
        this.#sessionDecisions.set(keyFingerprint, decision);

        return decision;
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  async loadUnique(
    keys: ReadonlyArray<PermissionDecisionStoreKey>,
  ): Promise<ReadonlyArray<boolean | undefined>> {
    const decisionLoads = (new Map<string, Promise<boolean | undefined>>);

    return await Promise.all(keys.map(key => {
      const keyFingerprint = getPermissionDecisionMemoryKey(key);
      const existing = decisionLoads.get(keyFingerprint);

      if (existing !== undefined) {
        return existing;
      }

      const load = this.load(key);

      decisionLoads.set(keyFingerprint, load);

      return load;
    }));
  }

  async remember(
    key: PermissionDecisionStoreKey,
    isAllowed: boolean,
    isCurrent: () => boolean,
  ): Promise<void> {
    await this.#rememberEntries([{ key, "decision": isAllowed }], isCurrent);
  }

  async rememberMissing(
    keys: ReadonlyArray<PermissionDecisionStoreKey>,
    existingDecisions: ReadonlyArray<boolean | undefined>,
    decisions: ReadonlyArray<boolean>,
    isCurrent: () => boolean,
  ): Promise<void> {
    if (
      keys.length !== existingDecisions.length ||
      keys.length !== decisions.length
    ) {
      throw new RangeError("Remembered decisions must positionally match their store keys");
    }

    const rememberedKeys = (new Set<string>);
    const entries: Array<Readonly<{
      "key"     : PermissionDecisionStoreKey;
      "decision": boolean;
    }>> = [];

    for (const [index, key] of keys.entries()) {
      const keyFingerprint = getPermissionDecisionMemoryKey(key);

      if (
        existingDecisions[index] === undefined &&
        !rememberedKeys.has(keyFingerprint)
      ) {
        entries.push({ key, "decision": decisions[index] ?? false });
        rememberedKeys.add(keyFingerprint);
      }
    }

    await this.#rememberEntries(entries, isCurrent);
  }
}
