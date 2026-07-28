export const PERMISSION_CATALOG = {
  "ui/basic": {
    "description": "Render basic, non-interactive user interface content.",
    "dangerLevel": "low",
    "scoped"     : false,
  },
  "ui/forms/non-credential": {
    "description": "Render forms that must not collect credentials or other secrets.",
    "dangerLevel": "medium",
    "scoped"     : false,
  },
  "network/http": {
    "description": "Send HTTP requests to the explicitly granted origins and methods.",
    "dangerLevel": "high",
    "scoped"     : true,
  },
  "storage/internal/read": {
    "description": "Read files in storage isolated to this exact plugin principal.",
    "dangerLevel": "low",
    "scoped"     : true,
  },
  "storage/internal/write": {
    "description": "Write files in storage isolated to this exact plugin principal.",
    "dangerLevel": "medium",
    "scoped"     : true,
  },
  "storage/external/read": {
    "description": "Read files below explicitly granted absolute filesystem roots.",
    "dangerLevel": "high",
    "scoped"     : true,
  },
  "storage/external/write": {
    "description": "Write files below explicitly granted absolute filesystem roots.",
    "dangerLevel": "critical",
    "scoped"     : true,
  },
  "system/process/spawn": {
    "description": "Spawn exact executable paths with exact argument arrays.",
    "dangerLevel": "critical",
    "scoped"     : true,
  },
  "system/shell": {
    "description": "Execute unrestricted shell commands outside the capability sandbox.",
    "dangerLevel": "critical",
    "scoped"     : false,
  },
  "events/subscribe": {
    "description": "Subscribe to launcher lifecycle and state-change events.",
    "dangerLevel": "low",
    "scoped"     : false,
  },
  "logging/write": {
    "description": "Write entries to the launcher log.",
    "dangerLevel": "low",
    "scoped"     : false,
  },
} as const;

export const PERMISSION_IDS = [
  "ui/basic",
  "ui/forms/non-credential",
  "network/http",
  "storage/internal/read",
  "storage/internal/write",
  "storage/external/read",
  "storage/external/write",
  "system/process/spawn",
  "system/shell",
  "events/subscribe",
  "logging/write",
] as const satisfies ReadonlyArray<keyof typeof PERMISSION_CATALOG>;

export type PermissionDangerLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

export default {
  PERMISSION_CATALOG,
  PERMISSION_IDS,
} as const;
