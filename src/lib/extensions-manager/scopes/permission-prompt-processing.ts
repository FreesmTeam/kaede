import type {
  PermissionDecisionRepository,
} from "@/lib/extensions-manager/scopes/permission-decision-repository.ts";
import {
  getDynamicPermissionBatchFingerprint,
  getPermissionRequestFingerprint,
  getStaticPermissionSetFingerprint,
} from "@/lib/extensions-manager/scopes/permission-prompt-fingerprints.ts";
import {
  type DynamicQueueItem,
  PERMISSION_PROMPT_CANCELLED,
  type PermissionDecisionKind,
  type PermissionDecisionStoreKey,
  type PermissionPromptSessionOperations,
  type PromptResponse,
  type QueueItem,
  type StaticQueueItem,
} from "@/lib/extensions-manager/scopes/permission-prompt-types.ts";

function storeKey(
  item: QueueItem,
  kind: PermissionDecisionKind,
  requestFingerprint: string,
): PermissionDecisionStoreKey {
  return { kind, "principalKey": item.principalKey, requestFingerprint };
}

export async function processStaticPermissionPrompt(
  item: StaticQueueItem,
  repository: PermissionDecisionRepository,
  operations: PermissionPromptSessionOperations,
): Promise<void> {
  const fingerprint = getStaticPermissionSetFingerprint(item.requests);
  const decisionStoreKey = storeKey(item, "static", fingerprint);
  const remembered = await operations.waitForOperation(repository.load(decisionStoreKey));

  if (remembered === PERMISSION_PROMPT_CANCELLED || item.cancelled) {
    item.complete(false);

    return;
  }

  if (remembered !== undefined) {
    item.complete(remembered);

    return;
  }

  const response = await operations.showPrompt({
    "kind"        : "static",
    "principal"   : item.principal,
    "principalKey": item.principalKey,
    "requests"    : item.requests,
    fingerprint,
  });

  if (response.kind !== "static" || item.cancelled) {
    item.complete(false);

    return;
  }

  const rememberedDecision = await operations.waitForOperation(repository.remember(
    decisionStoreKey,
    response.decision,
    () => !item.cancelled,
  ));

  if (rememberedDecision === PERMISSION_PROMPT_CANCELLED || item.cancelled) {
    item.complete(false);

    return;
  }

  item.complete(response.decision);
}

export async function processDynamicPermissionPrompt(
  item: DynamicQueueItem,
  repository: PermissionDecisionRepository,
  operations: PermissionPromptSessionOperations,
): Promise<void> {
  const fingerprints = item.requests.map(request => getPermissionRequestFingerprint(request));
  const storeKeys = fingerprints.map(fingerprint => storeKey(item, "dynamic", fingerprint));
  const loadedDecisions = await operations.waitForOperation(repository.loadUnique(storeKeys));

  if (loadedDecisions === PERMISSION_PROMPT_CANCELLED || item.cancelled) {
    item.complete(item.requests.map(() => false));

    return;
  }

  const rememberedDecisions = loadedDecisions;

  if (rememberedDecisions.every(decision => decision !== undefined)) {
    item.complete(rememberedDecisions);

    return;
  }

  const response = await operations.showPrompt({
    "kind"               : "dynamic",
    "principal"          : item.principal,
    "principalKey"       : item.principalKey,
    "requests"           : item.requests,
    "rememberedDecisions": rememberedDecisions,
    "fingerprint"        : getDynamicPermissionBatchFingerprint(item.requests),
  });

  if (response.kind !== "dynamic" || item.cancelled) {
    item.complete(item.requests.map(() => false));

    return;
  }

  const decisions = response.decisions.map((decision, index) => {
    return rememberedDecisions[index] ?? decision;
  });

  if (response.remember) {
    const remembered = await operations.waitForOperation(repository.rememberMissing(
      storeKeys,
      rememberedDecisions,
      decisions,
      () => !item.cancelled,
    ));

    if (remembered === PERMISSION_PROMPT_CANCELLED || item.cancelled) {
      item.complete(item.requests.map(() => false));

      return;
    }
  }

  item.complete(decisions);
}

export function validateDynamicPromptResponse(
  item: DynamicQueueItem,
  decisions: ReadonlyArray<boolean>,
  remember: boolean,
): PromptResponse {
  if (
    decisions.length !== item.requests.length ||
    decisions.some(decision => typeof decision !== "boolean")
  ) {
    throw new RangeError("Dynamic decisions must positionally match every permission request");
  }

  if (remember) {
    const decisionsByFingerprint = (new Map<string, boolean>);

    for (const [index, request] of item.requests.entries()) {
      const fingerprint = getPermissionRequestFingerprint(request);
      const decision = decisions[index] ?? false;

      if (
        decisionsByFingerprint.has(fingerprint) &&
        decisionsByFingerprint.get(fingerprint) !== decision
      ) {
        throw new RangeError(
          "Remembered decisions for identical permission requests must match",
        );
      }

      decisionsByFingerprint.set(fingerprint, decision);
    }
  }

  return { "kind": "dynamic", "decisions": [...decisions], remember };
}
