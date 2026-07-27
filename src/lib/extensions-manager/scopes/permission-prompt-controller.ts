import type {
  PreparedPermissionRequest,
} from "@/lib/capability-broker/types.ts";
import {
  InMemoryPermissionDecisionStore,
  PermissionDecisionRepository,
} from "@/lib/extensions-manager/scopes/permission-decision-repository.ts";
import {
  PermissionPromptQueue,
} from "@/lib/extensions-manager/scopes/permission-prompt-queue.ts";
import {
  PermissionPromptSession,
} from "@/lib/extensions-manager/scopes/permission-prompt-session.ts";
import type {
  PermissionDecisionStore,
  PermissionPrompt,
  PermissionPromptListener,
} from "@/lib/extensions-manager/scopes/permission-prompt-types.ts";
import {
  createPluginPrincipalKey,
  type PluginPrincipal,
} from "@/lib/extensions-manager/scopes/principal.ts";
import type { PermissionRequest } from "@/types/extensions/permission.type.ts";

export class PermissionPromptController {
  readonly #listeners = (new Set<PermissionPromptListener>);
  readonly #queue     : PermissionPromptQueue = (new PermissionPromptQueue);
  readonly #repository: PermissionDecisionRepository;
  #session            : PermissionPromptSession | undefined;
  #running = false;

  constructor(
    store: PermissionDecisionStore = (new InMemoryPermissionDecisionStore),
  ) {
    this.#repository = new PermissionDecisionRepository(store);
  }

  async #processQueue(): Promise<void> {
    if (this.#running) {
      return;
    }

    this.#running = true;

    try {
      while (this.#queue.length > 0) {
        const item = this.#queue.take();

        if (item === undefined) {
          continue;
        }

        const session = new PermissionPromptSession(item, this.#repository, (): void => {
          this.#notify();
        });

        this.#session = session;

        try {
          await session.run();
        } catch (error: unknown) {
          session.cancel();
          item.fail(error);
        }

        this.#session = undefined;
      }
    } finally {
      this.#session = undefined;
      this.#running = false;

      if (this.#queue.length > 0) {
        void this.#processQueue();
      }
    }
  }

  #notify(): void {
    for (const listener of this.#listeners) {
      try {
        listener(this.currentPrompt);
      } catch {
        // A failed view must not strand the broker-owned request queue.
      }
    }
  }

  get currentPrompt(): PermissionPrompt | undefined {
    return this.#session?.currentPrompt;
  }

  subscribe(listener: PermissionPromptListener): () => void {
    this.#listeners.add(listener);
    listener(this.currentPrompt);

    return (): void => {
      this.#listeners.delete(listener);
    };
  }

  setDecisionStore(store: PermissionDecisionStore): void {
    if (
      this.#session !== undefined ||
      this.currentPrompt !== undefined ||
      this.#queue.length > 0
    ) {
      throw new Error("Cannot configure the decision store while prompts are active or queued");
    }

    this.#repository.replaceStore(store);
  }

  requestStatic(
    principal: PluginPrincipal,
    requests: ReadonlyArray<PermissionRequest | PreparedPermissionRequest>,
  ): Promise<boolean> {
    const pending = this.#queue.requestStatic(principal, requests);

    void this.#processQueue();

    return pending;
  }

  requestDynamic(
    principal: PluginPrincipal,
    requests: ReadonlyArray<PermissionRequest | PreparedPermissionRequest>,
  ): Promise<ReadonlyArray<boolean>> {
    const pending = this.#queue.requestDynamic(principal, requests);

    void this.#processQueue();

    return pending;
  }

  resolveStatic(isAllowed: boolean): boolean {
    return this.#session?.resolveStatic(isAllowed) ?? false;
  }

  resolveDynamic(decisions: ReadonlyArray<boolean>, shouldRemember = false): boolean {
    return this.#session?.resolveDynamic(decisions, shouldRemember) ?? false;
  }

  cancelAll(principal?: PluginPrincipal): void {
    const principalKey = principal === undefined
      ? undefined
      : createPluginPrincipalKey(principal);

    this.#queue.cancel(principalKey);

    if (
      this.#session !== undefined &&
      (principalKey === undefined || this.#session.item.principalKey === principalKey)
    ) {
      this.#session.cancel();
    }
  }
}
