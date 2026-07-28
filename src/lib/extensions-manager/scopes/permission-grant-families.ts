import type { PermissionId } from "@/types/extensions/permission.type.ts";

export function assertPermissionGrantFamilyCompatibility(
  hasProcessPermission: boolean,
  hasStorageWritePermission: boolean,
): void {
  if (hasProcessPermission && hasStorageWritePermission) {
    throw new TypeError("system/process/spawn cannot be combined with storage write permissions");
  }
}

export function assertPermissionGrantIdsCompatibility(
  permissionIds: Iterable<PermissionId>,
): void {
  const ids = new Set(permissionIds);

  assertPermissionGrantFamilyCompatibility(
    ids.has("system/process/spawn"),
    ids.has("storage/internal/write") || ids.has("storage/external/write"),
  );
}
