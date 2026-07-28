import type {
  ExtensionLifecycleDependencies,
  LifecyclePluginSession,
} from "@/lib/extensions-manager/scopes/extension-lifecycle-contract.ts";
import {
  prepareSandboxPermissionRequests,
  requestDynamicPermissionGrant,
} from "@/lib/extensions-manager/scopes/extension-sandbox-permissions.ts";
import type { PlannedPlugin } from "@/lib/extensions-manager/scopes/plugin-planner.ts";
import type { PluginPrincipal } from "@/lib/extensions-manager/scopes/principal.ts";
import type {
  SandboxMaxBounds,
  SandboxRuntimeHandle,
} from "@/lib/extensions-manager/scopes/sandbox-runtime.ts";

export type ExtensionLifecycleState = {
  readonly "principals": Map<string, PluginPrincipal>;
  readonly "sandboxes" : Map<string, ActiveSandbox>;
  readonly "generation": number;
};

type ActiveSandbox = {
  readonly "plugin" : PlannedPlugin;
  readonly "session": LifecyclePluginSession;
  "cleanupAttempt"? : Promise<boolean>;
  "runtime"?        : SandboxRuntimeHandle;
};

export class ExtensionSandboxLifecycle {
  readonly #dependencies : ExtensionLifecycleDependencies;
  readonly #assertCurrent: (state: ExtensionLifecycleState) => void;
  readonly #pendingRevocations = new Set<ActiveSandbox>;

  constructor(
    dependencies: ExtensionLifecycleDependencies,
    assertCurrent: (state: ExtensionLifecycleState) => void,
  ) {
    this.#dependencies = dependencies;
    this.#assertCurrent = assertCurrent;
  }

  async #cleanupSandbox(active: ActiveSandbox): Promise<boolean> {
    this.#pendingRevocations.add(active);

    const existingAttempt = active.cleanupAttempt;

    if (existingAttempt !== undefined) {
      const complete = await existingAttempt;

      if (complete) {
        this.#pendingRevocations.delete(active);
      }

      return complete;
    }

    const attempt = this.#attemptCleanupSandbox(active);

    active.cleanupAttempt = attempt;

    try {
      const complete = await attempt;

      if (complete) {
        this.#pendingRevocations.delete(active);
      }

      return complete;
    } finally {
      if (active.cleanupAttempt === attempt) {
        delete active.cleanupAttempt;
      }
    }
  }

  async #attemptCleanupSandbox(active: ActiveSandbox): Promise<boolean> {
    if (active.runtime !== undefined) {
      const runtime = active.runtime;

      delete active.runtime;
      this.#disposeRuntime(active.plugin, runtime);
    }

    try {
      this.#dependencies.revokeEventListeners(active.plugin.principalKey);
    } catch (error: unknown) {
      this.#dependencies.reportError(
        `Failed to revoke event listeners for '${active.plugin.metadata.id}'`,
        error,
      );
    }

    try {
      await active.session.revoke();

      return true;
    } catch (error: unknown) {
      this.#dependencies.reportError(
        `Failed to revoke the '${active.plugin.metadata.id}' broker session`,
        error,
      );

      return false;
    }
  }

  #isInterrupted(state: ExtensionLifecycleState): boolean {
    try {
      this.#assertCurrent(state);

      return false;
    } catch {
      return true;
    }
  }

  #assertActive(state: ExtensionLifecycleState, active: ActiveSandbox): void {
    this.#assertCurrent(state);

    if (state.sandboxes.get(active.plugin.principalKey) !== active) {
      throw new TypeError("Sandbox session is no longer active");
    }
  }

  #disposeRuntime(plugin: PlannedPlugin, runtime: SandboxRuntimeHandle): void {
    try {
      runtime.dispose();
    } catch (error: unknown) {
      this.#dependencies.reportError(
        `Failed to dispose the '${plugin.metadata.id}' sandbox runtime`,
        error,
      );
    }
  }

  async initialize(
    state: ExtensionLifecycleState,
    plugin: PlannedPlugin,
    trustedContainer: HTMLElement,
    maxBounds: SandboxMaxBounds,
  ): Promise<void> {
    const preparedStaticPermissions = await prepareSandboxPermissionRequests(
      this.#dependencies,
      plugin.metadata.permissions,
    );

    this.#assertCurrent(state);
    const accepted = await this.#dependencies.requestStaticPermissions(
      plugin.principal,
      preparedStaticPermissions,
    );

    this.#assertCurrent(state);

    if (!accepted) {
      return;
    }

    let active: ActiveSandbox | undefined;

    try {
      const session = await this.#dependencies.openPluginSession(plugin.principal);
      const activeSandbox: ActiveSandbox = { plugin, session };

      active = activeSandbox;
      state.sandboxes.set(plugin.principalKey, activeSandbox);
      this.#assertCurrent(state);
      await session.grantAll(preparedStaticPermissions);
      this.#assertCurrent(state);

      const runtime = await this.#dependencies.createSandboxRuntime({
        trustedContainer,
        maxBounds,
        "staticPermissions": preparedStaticPermissions.map(
          prepared => prepared.descriptor,
        ),
        "nonDOMCapabilityFactories": session.capabilityFactories,
        "disposeEvents"            : () => {
          this.#dependencies.revokeEventListeners(plugin.principalKey);
        },
        "requestPermissions": async requests => {
          try {
            return await requestDynamicPermissionGrant({
              "assertActive": () => this.#assertActive(state, activeSandbox),
              "dependencies": this.#dependencies,
              "principal"   : activeSandbox.plugin.principal,
              requests,
              "session"     : activeSandbox.session,
            });
          } catch (error: unknown) {
            if (state.sandboxes.get(plugin.principalKey) === activeSandbox) {
              state.sandboxes.delete(plugin.principalKey);
              active = undefined;
              await this.#cleanupSandbox(activeSandbox);
            }

            throw error;
          }
        },
      });

      if (state.sandboxes.get(plugin.principalKey) !== activeSandbox) {
        this.#disposeRuntime(plugin, runtime);
        this.#assertCurrent(state);

        throw new TypeError("Sandbox session is no longer active");
      }

      activeSandbox.runtime = runtime;
      this.#assertCurrent(state);
      await this.#dependencies.runInSandbox({
        "code"              : plugin.code,
        "scopedThis"        : runtime.capabilities,
        "requestPermissions": runtime.requestPermissions,
      });
      this.#assertCurrent(state);
    } catch (error: unknown) {
      if (
        active !== undefined &&
        state.sandboxes.get(plugin.principalKey) === active
      ) {
        state.sandboxes.delete(plugin.principalKey);
        await this.#cleanupSandbox(active);
      }

      if (this.#isInterrupted(state)) {
        throw error;
      }

      this.#dependencies.reportError(
        `Failed to initialize the '${plugin.metadata.id}' sandboxed extension`,
        error,
      );
    }
  }

  async cleanupState(state: ExtensionLifecycleState | undefined): Promise<void> {
    if (state !== undefined) {
      for (const principal of state.principals.values()) {
        try {
          this.#dependencies.cancelPermissionPrompts(principal);
        } catch (error: unknown) {
          this.#dependencies.reportError(
            `Failed to cancel permission prompts for '${principal.pluginId}'`,
            error,
          );
        }
      }

      for (const active of state.sandboxes.values()) {
        this.#pendingRevocations.add(active);
      }

      state.sandboxes.clear();
    }

    const pendingRevocations = new Set(this.#pendingRevocations);

    for (const active of pendingRevocations) {
      await this.#cleanupSandbox(active);
    }

    if (this.#pendingRevocations.size > 0) {
      throw new Error(
        `Sandbox cleanup remains incomplete for ${this.#pendingRevocations.size} broker session(s)`,
      );
    }
  }
}
