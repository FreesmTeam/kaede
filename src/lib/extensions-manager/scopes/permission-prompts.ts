export {
  getDynamicPermissionBatchFingerprint,
  getDynamicBatchDecisions,
  getPermissionRequestFingerprint,
  getPermissionRequestId,
  getStaticPermissionSetFingerprint,
  reconcileDynamicDraftDecisions,
} from "@/lib/extensions-manager/scopes/permission-prompt-fingerprints.ts";
export {
  InMemoryPermissionDecisionStore,
} from "@/lib/extensions-manager/scopes/permission-decision-repository.ts";
export {
  PermissionPromptController,
} from "@/lib/extensions-manager/scopes/permission-prompt-controller.ts";
export type {
  DynamicPermissionPrompt,
  PermissionDecisionKind,
  PermissionDecisionStore,
  PermissionDecisionStoreKey,
  PermissionPrompt,
  PermissionPromptListener,
  StaticPermissionPrompt,
} from "@/lib/extensions-manager/scopes/permission-prompt-types.ts";

import {
  PermissionPromptController,
} from "@/lib/extensions-manager/scopes/permission-prompt-controller.ts";
import type {
  PermissionDecisionStore,
} from "@/lib/extensions-manager/scopes/permission-prompt-types.ts";

export const permissionPromptController = (new PermissionPromptController);

export function configurePermissionDecisionStore(store: PermissionDecisionStore): void {
  permissionPromptController.setDecisionStore(store);
}
