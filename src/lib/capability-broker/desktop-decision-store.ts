import type { BrokerCall } from "@/lib/capability-broker/desktop-codecs.ts";
import { expectResponse } from "@/lib/capability-broker/desktop-codecs.ts";
import type {
  BrokerDecisionStore,
  PermissionDecisionStoreKey,
} from "@/lib/capability-broker/types.ts";

export function createDecisionStore(call: BrokerCall): BrokerDecisionStore {
  return Object.freeze({
    "load": async (key: PermissionDecisionStoreKey): Promise<boolean | undefined> => {
      const response = expectResponse(await call({
        "kind"              : "decision_load",
        "decisionKind"      : key.kind,
        "principalKey"      : key.principalKey,
        "requestFingerprint": key.requestFingerprint,
      }), "decision");

      return response.decision ?? undefined;
    },
    "save": async (key: PermissionDecisionStoreKey, decision: boolean): Promise<void> => {
      expectResponse(await call({
        "kind"              : "decision_save",
        "decisionKind"      : key.kind,
        "principalKey"      : key.principalKey,
        "requestFingerprint": key.requestFingerprint,
        decision,
      }), "decision_saved");
    },
  });
}
