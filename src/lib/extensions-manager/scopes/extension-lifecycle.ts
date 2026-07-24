import type {
  ExtensionCatalog,
  ExtensionLifecycleDependencies,
  ExtensionLifecycleInitializeOptions,
} from "@/lib/extensions-manager/scopes/extension-lifecycle-contract.ts";
import {
  type ExtensionLifecycleState,
  ExtensionSandboxLifecycle,
} from "@/lib/extensions-manager/scopes/extension-sandbox-lifecycle.ts";
import type { ExtensionInfoType } from "@/types/extensions/extension-info.type.ts";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";

export {
  createTrustedExtensionContext,
  type ExtensionCatalog,
  type ExtensionLifecycleDependencies,
  type ExtensionLifecycleInitializeOptions,
  type LifecycleCapabilityFactories,
  type LifecyclePluginSession,
} from "@/lib/extensions-manager/scopes/extension-lifecycle-contract.ts";

class ExtensionLifecycleInterruptedError extends Error {
  constructor() {
    super("Extension lifecycle was disposed during initialization");
    this.name = "ExtensionLifecycleInterruptedError";
  }
}

function catalogFrom(
  extensions: ReadonlyArray<ExtensionInfoType>,
  metadata: ReadonlyArray<ExtensionMetadataType>,
): ExtensionCatalog {
  const metadataIds = new Set(metadata.map(entry => entry.id));

  return Object.freeze({
    metadata,
    "unknownExtensions": Object.freeze(
      extensions.filter(extension => !metadataIds.has(extension.id)),
    ),
  });
}

export class ExtensionLifecycleController {
  readonly #dependencies    : ExtensionLifecycleDependencies;
  readonly #sandboxLifecycle: ExtensionSandboxLifecycle;
  #state                    : ExtensionLifecycleState | undefined;
  #cleanupUntilComplete     : Promise<void> | undefined;
  #generation = 0;

  constructor(dependencies: ExtensionLifecycleDependencies) {
    this.#dependencies = dependencies;
    this.#sandboxLifecycle = new ExtensionSandboxLifecycle(
      dependencies,
      (state): void => this.#assertCurrent(state),
    );
  }

  async initialize({
    trustedContainer,
    maxBounds,
    onCatalog,
  }: ExtensionLifecycleInitializeOptions): Promise<ExtensionCatalog> {
    const cleanupUntilComplete = this.#cleanupUntilComplete;

    if (cleanupUntilComplete !== undefined) {
      await cleanupUntilComplete;
    }

    const previousState = this.#state;
    const state: ExtensionLifecycleState = {
      "principals": new Map,
      "sandboxes" : new Map,
      "generation": ++this.#generation,
    };

    this.#state = state;

    try {
      await this.#sandboxLifecycle.cleanupState(previousState);
      this.#assertCurrent(state);
    } catch (error: unknown) {
      try {
        this.#dependencies.revokeExtensionGlobals();
      } catch (revocationError: unknown) {
        this.#dependencies.reportError(
          "Failed to revoke extension globals during initialization rollback",
          revocationError,
        );
      }

      if (this.#state === state) {
        this.#state = undefined;
      }

      throw error;
    }

    let globalsRevoked = false;

    try {
      const [extensions, metadata] = await Promise.all([
        this.#dependencies.readAllExtensions(),
        this.#dependencies.readAllMetadata(),
      ]);

      this.#assertCurrent(state);

      const joinedMetadata = [
        ...metadata,
        ...extensions.flatMap(extension => {
          return extension.embeddedMetadata === undefined
            ? []
            : [extension.embeddedMetadata];
        }),
      ];
      const plan = this.#dependencies.planPlugins({ extensions, "metadata": joinedMetadata });
      const catalog = catalogFrom(extensions, joinedMetadata);

      onCatalog(catalog);

      for (const plugin of plan.sandboxed) {
        state.principals.set(plugin.principalKey, plugin.principal);
      }

      this.#dependencies.configurePermissionDecisions();
      this.#dependencies.configureEventCapabilities();

      for (const plugin of plan.cooperativeTcb) {
        this.#assertCurrent(state);
        await this.#dependencies.runInUnrestricted({
          "id"     : plugin.metadata.id,
          "code"   : plugin.code,
          "context": this.#dependencies.trustedContext,
        });
      }

      this.#assertCurrent(state);
      this.#dependencies.revokeExtensionGlobals();
      globalsRevoked = true;
      this.#dependencies.lockdownEnvironment();

      for (const plugin of plan.sandboxed) {
        this.#assertCurrent(state);
        await this.#sandboxLifecycle.initialize(
          state,
          plugin,
          trustedContainer,
          maxBounds,
        );
      }

      return catalog;
    } catch (error: unknown) {
      if (!globalsRevoked) {
        try {
          this.#dependencies.revokeExtensionGlobals();
        } catch (revocationError: unknown) {
          this.#dependencies.reportError(
            "Failed to revoke extension globals during initialization rollback",
            revocationError,
          );
        }
      }

      if (this.#state === state) {
        this.#state = undefined;
      }

      await this.#sandboxLifecycle.cleanupState(state);

      throw error;
    }
  }

  async dispose(): Promise<void> {
    const state = this.#state;

    this.#state = undefined;
    this.#generation++;

    await this.#sandboxLifecycle.cleanupState(state);
  }

  disposeUntilClean(retryDelayMilliseconds = 1000): Promise<void> {
    const existingCleanup = this.#cleanupUntilComplete;

    if (existingCleanup !== undefined) {
      return existingCleanup;
    }

    const cleanup = this.#retryCleanupUntilComplete(retryDelayMilliseconds);

    this.#cleanupUntilComplete = cleanup;
    void cleanup.then(
      (): void => this.#clearCleanupTask(cleanup),
      (): void => this.#clearCleanupTask(cleanup),
    );

    return cleanup;
  }

  async #retryCleanupUntilComplete(retryDelayMilliseconds: number): Promise<void> {
    if (!Number.isSafeInteger(retryDelayMilliseconds) || retryDelayMilliseconds < 0) {
      throw new TypeError("Cleanup retry delay must be a non-negative safe integer");
    }

    for (;;) {
      try {
        await this.dispose();

        return;
      } catch (error: unknown) {
        this.#dependencies.reportError(
          "Sandbox cleanup is incomplete and will be retried",
          error,
        );
        await new Promise<void>(resolve => {
          setTimeout(resolve, retryDelayMilliseconds);
        });
      }
    }
  }

  #clearCleanupTask(cleanup: Promise<void>): void {
    if (this.#cleanupUntilComplete === cleanup) {
      this.#cleanupUntilComplete = undefined;
    }
  }

  #assertCurrent(state: ExtensionLifecycleState): void {
    if (
      this.#state !== state ||
      state.generation !== this.#generation
    ) {
      throw new ExtensionLifecycleInterruptedError;
    }
  }
}
