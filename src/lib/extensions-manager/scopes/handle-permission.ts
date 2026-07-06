import { GrantedScopes } from "@/constants/permissions.ts";
import { grantEventListeners } from "@/lib/extensions-manager/scopes/grant-event-listeners.ts";
import { handleInternetPermission } from "@/lib/extensions-manager/scopes/permissions/internet.ts";
import { handleLoggingPermission } from "@/lib/extensions-manager/scopes/permissions/logging.ts";
import {
  handleBasicUIPermission,
  handleUIStyle,
} from "@/lib/extensions-manager/scopes/permissions/ui.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export function handlePermission(permission: PermissionType, id: string): void {
  if (!GrantedScopes[id]["__allowed"]) {
    GrantedScopes[id]["__allowed"] = [];
  }

  if (GrantedScopes[id]["__allowed"].includes(permission)) {
    return;
  }

  GrantedScopes[id]["__allowed"].push(permission);

  switch (permission) {
    case "ui-basic": {
      return handleBasicUIPermission({ id });
    }
    case "ui-style": {
      return handleUIStyle({ id });
    }
    case "all-events": {
      return grantEventListeners({ id });
    }
    case "internet": {
      return handleInternetPermission(id);
    }
    case "write-to-log-file": {
      return handleLoggingPermission(id);
    }
  }
}