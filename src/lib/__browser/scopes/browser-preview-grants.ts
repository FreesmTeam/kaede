import {
  assertPermissionGrantIdsCompatibility,
} from "@/lib/extensions-manager/scopes/permission-grant-families.ts";
import type {
  PermissionId,
  PermissionRequest,
} from "@/types/extensions/permission.type.ts";

export type BrowserGrantStore = Map<
  PermissionId,
  ReadonlyArray<PermissionRequest>
>;

export type BrowserGrantGuard = (
  id: PermissionId,
) => ReadonlyArray<PermissionRequest>;

function permissionId(request: PermissionRequest): PermissionId {
  return typeof request === "string" ? request : request.id;
}

export function storeBrowserGrant(
  grants: BrowserGrantStore,
  descriptor: PermissionRequest,
): void {
  storeBrowserGrants(grants, [descriptor]);
}

export function storeBrowserGrants(
  grants: BrowserGrantStore,
  descriptors: ReadonlyArray<PermissionRequest>,
): void {
  assertPermissionGrantIdsCompatibility([
    ...grants.keys(),
    ...descriptors.map(descriptor => permissionId(descriptor)),
  ]);

  for (const descriptor of descriptors) {
    const id = permissionId(descriptor);
    const current = grants.get(id) ?? [];

    grants.set(id, Object.freeze([...current, descriptor]));
  }
}
