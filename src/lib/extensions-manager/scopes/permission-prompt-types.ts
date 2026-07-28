import type {
  PermissionDecisionStoreKey,
  PreparedPermissionRequest,
} from "@/lib/capability-broker/types.ts";
import type {
  PluginPrincipal,
  PluginPrincipalKey,
} from "@/lib/extensions-manager/scopes/principal.ts";

export type MaybePromise<Value> = Promise<Value> | Value;
export const PERMISSION_PROMPT_CANCELLED = Symbol("permission-prompt-cancelled");

export type PermissionDecisionKind = "dynamic" | "static";

export interface PermissionDecisionStore {
  load(key: PermissionDecisionStoreKey): MaybePromise<boolean | undefined>;
  save(key: PermissionDecisionStoreKey, isAllowed: boolean): MaybePromise<void>;
}

export type StaticPermissionPrompt = Readonly<{
  "kind"        : "static";
  "principal"   : PluginPrincipal;
  "principalKey": PluginPrincipalKey;
  "requests"    : ReadonlyArray<PreparedPermissionRequest>;
  "fingerprint" : string;
}>;

export type DynamicPermissionPrompt = Readonly<{
  "kind"               : "dynamic";
  "principal"          : PluginPrincipal;
  "principalKey"       : PluginPrincipalKey;
  "requests"           : ReadonlyArray<PreparedPermissionRequest>;
  "rememberedDecisions": ReadonlyArray<boolean | undefined>;
  "fingerprint"        : string;
}>;

export type PermissionPrompt = DynamicPermissionPrompt | StaticPermissionPrompt;
export type PermissionPromptListener = (prompt: PermissionPrompt | undefined) => void;

export type PromptResponse =
  | Readonly<{ "kind": "cancel" }>
  | Readonly<{ "kind": "dynamic"; "decisions": ReadonlyArray<boolean>; "remember": boolean }>
  | Readonly<{ "kind": "static"; "decision": boolean }>;

type QueueItemBase = {
  "cancelled"   : boolean;
  "fail"        : (error: unknown) => void;
  "principal"   : PluginPrincipal;
  "principalKey": PluginPrincipalKey;
  "requests"    : ReadonlyArray<PreparedPermissionRequest>;
};

export type StaticQueueItem = QueueItemBase & {
  "kind"    : "static";
  "complete": (isAllowed: boolean) => void;
};

export type DynamicQueueItem = QueueItemBase & {
  "kind"    : "dynamic";
  "complete": (decisions: ReadonlyArray<boolean>) => void;
};

export type QueueItem = DynamicQueueItem | StaticQueueItem;

export interface PermissionPromptSessionOperations {
  waitForOperation<Value>(
    operation: Promise<Value>,
  ): Promise<Value | typeof PERMISSION_PROMPT_CANCELLED>;
  showPrompt(prompt: PermissionPrompt): Promise<PromptResponse>;
}
