import type {
  PermissionGrant,
  PermissionRequest,
  PluginCapabilities,
} from "../../src/types/extensions/permission.type.ts";

export type SandboxPluginContext = Readonly<Partial<PluginCapabilities>>;
export type RequestPermissions = (
  permissions: ReadonlyArray<PermissionRequest>,
) => Promise<PermissionGrant>;

declare global {
  const scopedThis: SandboxPluginContext;
  const requestPermissions: RequestPermissions;
}
