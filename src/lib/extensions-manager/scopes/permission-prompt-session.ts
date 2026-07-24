import type {
  PermissionDecisionRepository,
} from "@/lib/extensions-manager/scopes/permission-decision-repository.ts";
import {
  processDynamicPermissionPrompt,
  processStaticPermissionPrompt,
  validateDynamicPromptResponse,
} from "@/lib/extensions-manager/scopes/permission-prompt-processing.ts";
import {
  PERMISSION_PROMPT_CANCELLED,
  type PermissionPrompt,
  type PermissionPromptSessionOperations,
  type PromptResponse,
  type QueueItem,
} from "@/lib/extensions-manager/scopes/permission-prompt-types.ts";

function noOperation(): void {}

function cancellationGate(): Readonly<{
  "cancel" : () => void;
  "promise": Promise<typeof PERMISSION_PROMPT_CANCELLED>;
}> {
  let cancel = noOperation;
  const promise = new Promise<typeof PERMISSION_PROMPT_CANCELLED>(resolve => {
    cancel = (): void => resolve(PERMISSION_PROMPT_CANCELLED);
  });

  return { cancel, promise };
}

export class PermissionPromptSession {
  readonly item           : QueueItem;
  readonly #repository    : PermissionDecisionRepository;
  readonly #onPromptChange: () => void;
  #cancelWaiter           : (() => void) | undefined;
  #currentPrompt          : PermissionPrompt | undefined;
  #resume                 : ((response: PromptResponse) => void) | undefined;

  constructor(
    item: QueueItem,
    repository: PermissionDecisionRepository,
    onPromptChange: () => void,
  ) {
    this.item = item;
    this.#repository = repository;
    this.#onPromptChange = onPromptChange;
  }

  get currentPrompt(): PermissionPrompt | undefined {
    return this.#currentPrompt;
  }

  async run(): Promise<void> {
    const operations: PermissionPromptSessionOperations = {
      "waitForOperation": async <Value>(operation: Promise<Value>) => {
        return await this.#waitForOperation(operation);
      },
      "showPrompt": async prompt => await this.#showPrompt(prompt),
    };

    await (this.item.kind === "static"
      ? processStaticPermissionPrompt(this.item, this.#repository, operations)
      : processDynamicPermissionPrompt(this.item, this.#repository, operations));
  }

  resolveStatic(decision: boolean): boolean {
    if (this.item.kind !== "static" || this.#currentPrompt?.kind !== "static") {
      return false;
    }

    this.#resume?.({ "kind": "static", decision });

    return true;
  }

  resolveDynamic(decisions: ReadonlyArray<boolean>, remember = false): boolean {
    if (this.item.kind !== "dynamic" || this.#currentPrompt?.kind !== "dynamic") {
      return false;
    }

    this.#resume?.(validateDynamicPromptResponse(this.item, decisions, remember));

    return true;
  }

  cancel(): void {
    this.item.cancelled = true;
    this.#clearPrompt();
    this.#cancelWaiter?.();
    this.#resume?.({ "kind": "cancel" });
  }

  async #waitForOperation<Value>(
    operation: Promise<Value>,
  ): Promise<Value | typeof PERMISSION_PROMPT_CANCELLED> {
    if (this.item.cancelled) {
      return PERMISSION_PROMPT_CANCELLED;
    }

    const gate = cancellationGate();

    this.#cancelWaiter = gate.cancel;

    try {
      return await Promise.race([operation, gate.promise]);
    } finally {
      if (this.#cancelWaiter === gate.cancel) {
        this.#cancelWaiter = undefined;
      }
    }
  }

  #showPrompt(prompt: PermissionPrompt): Promise<PromptResponse> {
    return new Promise(resolve => {
      this.#resume = (response: PromptResponse): void => {
        this.#resume = undefined;
        this.#clearPrompt();
        resolve(response);
      };
      this.#currentPrompt = prompt;
      this.#onPromptChange();
    });
  }

  #clearPrompt(): void {
    if (this.#currentPrompt !== undefined) {
      this.#currentPrompt = undefined;
      this.#onPromptChange();
    }
  }
}
