import {
  isCanonicalAbsolutePath,
} from "@/lib/extensions-manager/scopes/canonical-absolute-path.ts";
import {
  isExactHttpOrigin,
} from "@/lib/extensions-manager/scopes/permission-contract.ts";
import {
  isCanonicalRepositoryOrigin,
  isSafePluginId,
  isValidPluginVersion,
} from "@/lib/extensions-manager/scopes/principal.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValidNetworkOrigins(permission: Record<string, unknown>): boolean {
  const scope = permission.scope;

  return isRecord(scope) &&
    Array.isArray(scope.origins) &&
    scope.origins.every(origin => {
      return typeof origin === "string" && isExactHttpOrigin(origin);
    });
}

function hasValidStorageRoots(permission: Record<string, unknown>): boolean {
  const scope = permission.scope;

  return isRecord(scope) &&
    Array.isArray(scope.roots) &&
    scope.roots.every(root => {
      return typeof root === "string" && isCanonicalAbsolutePath(root);
    });
}

function hasValidProcessScope(permission: Record<string, unknown>): boolean {
  const scope = permission.scope;

  if (!isRecord(scope) || !Array.isArray(scope.executables)) {
    return false;
  }

  return scope.executables.every(executable => {
    if (
      !isRecord(executable) ||
      typeof executable.path !== "string" ||
      !isCanonicalAbsolutePath(executable.path)
    ) {
      return false;
    }

    return Array.isArray(executable.arguments) && executable.arguments.every(argument => {
      return typeof argument === "string" && !argument.includes("\u{0}");
    });
  });
}

function permissionId(permission: unknown): string | undefined {
  if (typeof permission === "string") {
    return permission;
  }

  return isRecord(permission) && typeof permission.id === "string"
    ? permission.id
    : undefined;
}

export function hasUniquePermissionIds(permissions: ReadonlyArray<unknown>): boolean {
  const permissionIds = permissions.map(permission => permissionId(permission));

  return permissionIds.every(id => id !== undefined) &&
    (new Set(permissionIds)).size === permissionIds.length;
}

function hasValidPermissionRefinements(permission: unknown): boolean {
  if (typeof permission === "string") {
    return true;
  }

  if (!isRecord(permission)) {
    return false;
  }

  switch (permission.id) {
    case "network/http": { return hasValidNetworkOrigins(permission); }
    case "storage/external/read":
    case "storage/external/write": { return hasValidStorageRoots(permission); }
    case "system/process/spawn": { return hasValidProcessScope(permission); }
    default: { return true; }
  }
}

export function hasValidExtensionMetadataRefinements(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.source !== "string" ||
    typeof value.version !== "string" ||
    !isSafePluginId(value.id) ||
    !isCanonicalRepositoryOrigin(value.source) ||
    !isValidPluginVersion(value.version)
  ) {
    return false;
  }

  if (value.permissions === undefined) {
    return true;
  }

  if (!Array.isArray(value.permissions)) {
    return false;
  }

  return hasUniquePermissionIds(value.permissions) &&
    value.permissions.every(hasValidPermissionRefinements);
}
