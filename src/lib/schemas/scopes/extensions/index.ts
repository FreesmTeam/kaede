import { type TSchema, Type } from "typebox";

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
import {
  hasUniquePermissionIds,
} from "@/lib/schemas/scopes/extensions/refinements.ts";

const HttpMethodSchema = Type.Union([
  Type.Literal("DELETE"),
  Type.Literal("GET"),
  Type.Literal("HEAD"),
  Type.Literal("OPTIONS"),
  Type.Literal("PATCH"),
  Type.Literal("POST"),
  Type.Literal("PUT"),
]);
const HttpOriginCodegenSchema = Type.String();
const HttpOriginSchema = Type.Refine(
  HttpOriginCodegenSchema,
  isExactHttpOrigin,
  () => "Expected an exact HTTP(S) origin",
);

const CanonicalAbsolutePathCodegenSchema = Type.String();
const CanonicalAbsolutePathSchema = Type.Refine(
  CanonicalAbsolutePathCodegenSchema,
  isCanonicalAbsolutePath,
  () => "Expected a canonical absolute filesystem path",
);

const ProcessArgumentCodegenSchema = Type.String();
const ProcessArgumentSchema = Type.Refine(
  ProcessArgumentCodegenSchema,
  argument => !argument.includes("\u{0}"),
  () => "Process arguments cannot contain NUL",
);
const PluginIdCodegenSchema = Type.String({
  "minLength": 1,
  "maxLength": 128,
});
const PluginIdSchema = Type.Refine(
  PluginIdCodegenSchema,
  isSafePluginId,
  () => "Plugin ID is unsafe or reserved",
);

const RepositoryOriginCodegenSchema = Type.String();
const RepositoryOriginSchema = Type.Refine(
  RepositoryOriginCodegenSchema,
  isCanonicalRepositoryOrigin,
  () => "Repository origin must use the canonical plugin principal form",
);

const PluginVersionCodegenSchema = Type.String({ "minLength": 1 });
const PluginVersionSchema = Type.Refine(
  PluginVersionCodegenSchema,
  isValidPluginVersion,
  () => "Plugin version must contain at most 128 Unicode scalar values and no controls",
);

const ExtensionTypeSchema = Type.Union([
  Type.Literal("sandbox"),
  Type.Literal("unrestricted"),
]);
const StringArraySchema = Type.Array(Type.String());

function createPermissionRequestSchema(
  httpOriginSchema: TSchema,
  canonicalAbsolutePathSchema: TSchema,
  processArgumentSchema: TSchema,
): TSchema {
  const networkPermissionRequestSchema = Type.Object({
    "id"   : Type.Literal("network/http"),
    "scope": Type.Object({
      "origins": Type.Array(httpOriginSchema, { "minItems": 1, "uniqueItems": true }),
      "methods": Type.Array(HttpMethodSchema, { "minItems": 1, "uniqueItems": true }),
    }, { "additionalProperties": false }),
  }, { "additionalProperties": false });
  const internalStoragePermissionRequestSchema = Type.Object({
    "id": Type.Union([
      Type.Literal("storage/internal/read"),
      Type.Literal("storage/internal/write"),
    ]),
    "scope": Type.Object({
      "directory": Type.Literal("principal"),
    }, { "additionalProperties": false }),
  }, { "additionalProperties": false });
  const externalStoragePermissionRequestSchema = Type.Object({
    "id": Type.Union([
      Type.Literal("storage/external/read"),
      Type.Literal("storage/external/write"),
    ]),
    "scope": Type.Object({
      "roots": Type.Array(canonicalAbsolutePathSchema, {
        "minItems"   : 1,
        "uniqueItems": true,
      }),
    }, { "additionalProperties": false }),
  }, { "additionalProperties": false });
  const processExecutableSchema = Type.Object({
    "path"     : canonicalAbsolutePathSchema,
    "arguments": Type.Array(processArgumentSchema),
  }, { "additionalProperties": false });
  const processPermissionRequestSchema = Type.Object({
    "id"   : Type.Literal("system/process/spawn"),
    "scope": Type.Object({
      "executables": Type.Array(processExecutableSchema, {
        "minItems"   : 1,
        "uniqueItems": true,
      }),
    }, { "additionalProperties": false }),
  }, { "additionalProperties": false });

  return Type.Union([
    Type.Literal("ui/basic"),
    Type.Literal("ui/forms/non-credential"),
    Type.Literal("system/shell"),
    Type.Literal("events/subscribe"),
    Type.Literal("logging/write"),
    networkPermissionRequestSchema,
    internalStoragePermissionRequestSchema,
    externalStoragePermissionRequestSchema,
    processPermissionRequestSchema,
  ]);
}

function createExtensionMetadataSchema(
  pluginIdSchema: TSchema,
  repositoryOriginSchema: TSchema,
  pluginVersionSchema: TSchema,
  permissionsSchema: TSchema,
): TSchema {
  const optionalMetadataSchema = Type.Object({
    "description": Type.String(),
    "permissions": permissionsSchema,
    "enabled"    : Type.Boolean(),
  });

  return Type.Intersect([
    Type.Object({
      "id"        : pluginIdSchema,
      "logo"      : Type.String(),
      "name"      : Type.String(),
      "type"      : ExtensionTypeSchema,
      "source"    : repositoryOriginSchema,
      "version"   : pluginVersionSchema,
      "authors"   : StringArraySchema,
      "languages" : StringArraySchema,
      "categories": StringArraySchema,
    }),
    Type.Partial(optionalMetadataSchema),
  ]);
}

const PermissionRequestCodegenSchema = createPermissionRequestSchema(
  HttpOriginCodegenSchema,
  CanonicalAbsolutePathCodegenSchema,
  ProcessArgumentCodegenSchema,
);
const PermissionRequestSchema = createPermissionRequestSchema(
  HttpOriginSchema,
  CanonicalAbsolutePathSchema,
  ProcessArgumentSchema,
);
const PermissionsCodegenSchema = Type.Array(PermissionRequestCodegenSchema);
const PermissionsSchema = Type.Refine(
  Type.Array(PermissionRequestSchema),
  hasUniquePermissionIds,
  () => "Permission IDs must be unique",
);

export const ExtensionMetadataCodegenSchema = createExtensionMetadataSchema(
  PluginIdCodegenSchema,
  RepositoryOriginCodegenSchema,
  PluginVersionCodegenSchema,
  PermissionsCodegenSchema,
);
export const ExtensionMetadataSchema = createExtensionMetadataSchema(
  PluginIdSchema,
  RepositoryOriginSchema,
  PluginVersionSchema,
  PermissionsSchema,
);
