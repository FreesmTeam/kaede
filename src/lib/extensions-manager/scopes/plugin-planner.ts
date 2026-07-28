import { copyAndSort } from "@/lib/collections/copy-array.ts";
import {
  normalizePermissionRequests,
} from "@/lib/extensions-manager/scopes/permission-contract.ts";
import {
  createPluginPrincipal,
  createPluginPrincipalKey,
  isSafePluginId,
  type PluginPrincipal,
  type PluginPrincipalKey,
} from "@/lib/extensions-manager/scopes/principal.ts";
import {
  findTrustedArtifactCatalogEntry,
} from "@/lib/extensions-manager/scopes/trusted-artifact-catalog.ts";
import type { ExtensionInfoType } from "@/types/extensions/extension-info.type.ts";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";
import type { PermissionRequest } from "@/types/extensions/permission.type.ts";

export {
  TRUSTED_EXTENSIONS_REPOSITORY,
} from "@/lib/extensions-manager/scopes/trusted-artifact-catalog.ts";

export type PlannedPluginMetadata = Readonly<{
  "id"          : string;
  "logo"        : string;
  "name"        : string;
  "type"        : ExtensionMetadataType["type"];
  "source"      : string;
  "version"     : string;
  "authors"     : ReadonlyArray<string>;
  "languages"   : ReadonlyArray<string>;
  "categories"  : ReadonlyArray<string>;
  "description"?: string;
  "enabled"     : boolean;
  "permissions" : ReadonlyArray<PermissionRequest>;
}>;

export type PlannedPlugin = Readonly<{
  "code"           : string;
  "metadataIndex"  : number;
  "metadata"       : PlannedPluginMetadata;
  "principal"      : PluginPrincipal;
  "principalKey"   : PluginPrincipalKey;
  "trustedArtifact": boolean;
}>;

export type PluginExecutionPlan = Readonly<{

  /** Every joined artifact, including disabled entries, in metadata order. */
  "plugins": ReadonlyArray<PlannedPlugin>;

  /** Enabled unrestricted plugins that cooperatively execute before lockdown. */
  "cooperativeTcb": ReadonlyArray<PlannedPlugin>;

  /** Enabled untrusted plugins that execute only after successful lockdown. */
  "sandboxed": ReadonlyArray<PlannedPlugin>;
}>;

export type PluginPlannerOptions = Readonly<{
  "extensions": ReadonlyArray<ExtensionInfoType>;
  "metadata"  : ReadonlyArray<ExtensionMetadataType>;
}>;

function compareStrings(left: string, right: string): number {
  return Number(left > right) - Number(left < right);
}

function assertUniqueSafeIds<Item extends { readonly "id": string }>(
  items: ReadonlyArray<Item>,
  label: string,
): Map<string, Item> {
  const byId = (new Map<string, Item>);

  for (const item of items) {
    if (!isSafePluginId(item.id)) {
      throw new TypeError(`Unsafe ${label} plugin ID: ${JSON.stringify(item.id)}`);
    }

    if (byId.has(item.id)) {
      throw new TypeError(`Duplicate ${label} plugin ID: ${JSON.stringify(item.id)}`);
    }

    byId.set(item.id, item);
  }

  return byId;
}

function mismatchError(label: string, pluginIds: ReadonlyArray<string>): TypeError {
  return new TypeError(`${label}: ${pluginIds.map(pluginId => {
    return JSON.stringify(pluginId);
  }).join(", ")}`);
}

function snapshotMetadata(
  metadata: ExtensionMetadataType,
  permissions: ReadonlyArray<PermissionRequest>,
): PlannedPluginMetadata {
  const snapshot: {
    "id"          : string;
    "logo"        : string;
    "name"        : string;
    "type"        : ExtensionMetadataType["type"];
    "source"      : string;
    "version"     : string;
    "authors"     : ReadonlyArray<string>;
    "languages"   : ReadonlyArray<string>;
    "categories"  : ReadonlyArray<string>;
    "description"?: string;
    "enabled"     : boolean;
    "permissions" : ReadonlyArray<PermissionRequest>;
  } = {
    "id"         : metadata.id,
    "logo"       : metadata.logo,
    "name"       : metadata.name,
    "type"       : metadata.type,
    "source"     : metadata.source,
    "version"    : metadata.version,
    "authors"    : Object.freeze([...metadata.authors]),
    "languages"  : Object.freeze([...metadata.languages]),
    "categories" : Object.freeze([...metadata.categories]),
    "enabled"    : metadata.enabled === true,
    "permissions": permissions,
  };

  if (metadata.description !== undefined) {
    snapshot.description = metadata.description;
  }

  return Object.freeze(snapshot);
}

export function planPlugins({
  extensions,
  metadata,
}: PluginPlannerOptions): PluginExecutionPlan {
  const extensionsById = assertUniqueSafeIds(extensions, "artifact");
  const metadataById = assertUniqueSafeIds(metadata, "metadata");
  const unknownArtifacts = copyAndSort(
    [...extensionsById.keys()].filter(pluginId => !metadataById.has(pluginId)),
    compareStrings,
  );

  if (unknownArtifacts.length > 0) {
    throw mismatchError("Artifacts without metadata", unknownArtifacts);
  }

  const missingArtifacts = copyAndSort(
    [...metadataById.keys()].filter(pluginId => !extensionsById.has(pluginId)),
    compareStrings,
  );

  if (missingArtifacts.length > 0) {
    throw mismatchError("Metadata without artifacts", missingArtifacts);
  }

  const plugins: Array<PlannedPlugin> = [];
  const cooperativeTcb: Array<PlannedPlugin> = [];
  const sandboxed: Array<PlannedPlugin> = [];

  for (const [metadataIndex, metadataEntry] of metadata.entries()) {
    const extension = extensionsById.get(metadataEntry.id);

    if (extension === undefined) {
      // The complete join was checked above. This guard keeps indexed access explicit.
      throw mismatchError("Metadata without artifact", [metadataEntry.id]);
    }

    const trustedArtifact = findTrustedArtifactCatalogEntry({
      "pluginId"      : metadataEntry.id,
      "version"       : metadataEntry.version,
      "artifactSha256": extension.artifactSha256,
    });
    const principal = createPluginPrincipal({
      "repositoryOrigin": trustedArtifact?.repositoryOrigin ?? metadataEntry.source,
      "pluginId"        : metadataEntry.id,
      "version"         : metadataEntry.version,
      "artifactSha256"  : extension.artifactSha256,
    });
    const isTrustedArtifact = trustedArtifact !== undefined;

    const normalizedPermissions = normalizePermissionRequests(metadataEntry.permissions ?? []);
    const plannedPlugin = Object.freeze({
      "code"           : extension.code,
      metadataIndex,
      "metadata"       : snapshotMetadata(metadataEntry, normalizedPermissions),
      principal,
      "principalKey"   : createPluginPrincipalKey(principal),
      "trustedArtifact": isTrustedArtifact,
    });

    plugins.push(plannedPlugin);

    if (!plannedPlugin.metadata.enabled) {
      continue;
    }

    if (plannedPlugin.metadata.type === "unrestricted") {
      if (!plannedPlugin.trustedArtifact) {
        throw new TypeError(
          "Untrusted unrestricted plugin is forbidden: " +
          JSON.stringify(plannedPlugin.metadata.id),
        );
      }

      cooperativeTcb.push(plannedPlugin);
    } else {
      sandboxed.push(plannedPlugin);
    }
  }

  return Object.freeze({
    "plugins"       : Object.freeze(plugins),
    "cooperativeTcb": Object.freeze(cooperativeTcb),
    "sandboxed"     : Object.freeze(sandboxed),
  });
}
