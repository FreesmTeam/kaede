import type { PermissionType } from "@/types/extensions/permission.type.ts";

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
  Permissions,
  PermissionsList,
} as const;
