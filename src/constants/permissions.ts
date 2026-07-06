import type { PermissionType } from "@/types/extensions/permission.type.ts";

/* 'any' is required since 'GrantedScopes[string]' will contain literally anything */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GrantedScopes: Record<string, any> = {};
export const IgnoredExtensionPermissions: Record<string, Partial<{
  [Key in PermissionType]: boolean;
}>> = {};
export const Permissions = {
  "UI": {
    "Basic": "ui-basic",
    "Style": "ui-style",
  },
  "Events": {
    "All": "all-events",
  },
  "Internet": {
    "General": "internet",
  },
  "ExternalStorage": {
    "Read" : "read-external-storage",
    "Write": "write-external-storage",
  },
  "InternalStorage": {
    "Read"   : "read-internal-storage",
    "Write"  : "write-internal-storage",
    "Logging": "write-to-log-file",
  },
} as const;
export const PermissionsList: Array<PermissionType> = Object
  .values(Permissions)
  .flatMap(scope => Object.values(scope));

export default {
  GrantedScopes,
  IgnoredExtensionPermissions,
  Permissions,
  PermissionsList,
} as const;