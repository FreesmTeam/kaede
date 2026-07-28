import {
  isPreparedPermissionRequest,
  prepareIdentityFreePermissionRequests,
  snapshotPreparedPermissionRequest,
} from "@/lib/capability-broker/permission-preparation.ts";
import type {
  PreparedPermissionRequest,
} from "@/lib/capability-broker/types.ts";
import type {
  DynamicQueueItem,
  QueueItem,
  StaticQueueItem,
} from "@/lib/extensions-manager/scopes/permission-prompt-types.ts";
import {
  createPluginPrincipal,
  createPluginPrincipalKey,
  type PluginPrincipal,
  type PluginPrincipalKey,
} from "@/lib/extensions-manager/scopes/principal.ts";
import type { PermissionRequest } from "@/types/extensions/permission.type.ts";

type PermissionPromptRequest = PermissionRequest | PreparedPermissionRequest;

function areAllPrepared(
  requests: ReadonlyArray<PermissionPromptRequest>,
): requests is ReadonlyArray<PreparedPermissionRequest> {
  return requests.every(request => isPreparedPermissionRequest(request));
}

function areAllUnprepared(
  requests: ReadonlyArray<PermissionPromptRequest>,
): requests is ReadonlyArray<PermissionRequest> {
  return requests.every(request => !isPreparedPermissionRequest(request));
}

function preparePromptRequests(
  requests: ReadonlyArray<PermissionPromptRequest>,
  shouldNormalizeAsSet: boolean,
): ReadonlyArray<PreparedPermissionRequest> {
  if (!areAllPrepared(requests) && !areAllUnprepared(requests)) {
    throw new TypeError("Permission prompts cannot mix prepared and unprepared requests");
  }

  if (areAllPrepared(requests)) {
    return Object.freeze(
      requests.map(request => snapshotPreparedPermissionRequest(request)),
    );
  }

  return prepareIdentityFreePermissionRequests(
    requests,
    shouldNormalizeAsSet,
  );
}

function completeCancelledPrompt(item: QueueItem): void {
  if (item.kind === "static") {
    item.complete(false);
  } else {
    item.complete(item.requests.map(() => false));
  }
}

export class PermissionPromptQueue {
  readonly #items: Array<QueueItem> = [];

  get length(): number {
    return this.#items.length;
  }

  requestStatic(
    principal: PluginPrincipal,
    requests: ReadonlyArray<PermissionPromptRequest>,
  ): Promise<boolean> {
    const normalizedPrincipal = createPluginPrincipal(principal);
    const normalizedRequests = preparePromptRequests(requests, true);

    return new Promise((resolve, reject) => {
      const item: StaticQueueItem = {
        "kind"        : "static",
        "principal"   : normalizedPrincipal,
        "principalKey": createPluginPrincipalKey(normalizedPrincipal),
        "requests"    : normalizedRequests,
        "cancelled"   : false,
        "complete"    : resolve,
        "fail"        : reject,
      };

      this.#items.push(item);
    });
  }

  requestDynamic(
    principal: PluginPrincipal,
    requests: ReadonlyArray<PermissionPromptRequest>,
  ): Promise<ReadonlyArray<boolean>> {
    const normalizedPrincipal = createPluginPrincipal(principal);
    const normalizedRequests = preparePromptRequests(requests, false);

    return new Promise((resolve, reject) => {
      const item: DynamicQueueItem = {
        "kind"        : "dynamic",
        "principal"   : normalizedPrincipal,
        "principalKey": createPluginPrincipalKey(normalizedPrincipal),
        "requests"    : normalizedRequests,
        "cancelled"   : false,
        "complete"    : resolve,
        "fail"        : reject,
      };

      this.#items.push(item);
    });
  }

  take(): QueueItem | undefined {
    return this.#items.shift();
  }

  cancel(principalKey?: PluginPrincipalKey): void {
    for (let index = this.#items.length - 1; index >= 0; index--) {
      const item = this.#items[index];

      if (
        item !== undefined &&
        (principalKey === undefined || item.principalKey === principalKey)
      ) {
        this.#items.splice(index, 1);
        completeCancelledPrompt(item);
      }
    }
  }
}
