import { Type } from "typebox";

import {
  isCanonicalAbsolutePath,
  isExactHttpOrigin,
} from "@/lib/extensions-manager/scopes/permission-contract.ts";
import {
  isCanonicalRepositoryOrigin,
  isSafePluginId,
  isValidPluginVersion,
} from "@/lib/extensions-manager/scopes/principal.ts";

const HttpMethodSchema = Type.Union([
  Type.Literal("DELETE"),
  Type.Literal("GET"),
  Type.Literal("HEAD"),
  Type.Literal("OPTIONS"),
  Type.Literal("PATCH"),
  Type.Literal("POST"),
  Type.Literal("PUT"),
]);

const NetworkPermissionRequestSchema = Type.Object({
  "id"   : Type.Literal("network/http"),
  "scope": Type.Object({
    "origins": Type.Array(
      Type.Refine(Type.String(), isExactHttpOrigin, "Expected an exact HTTP(S) origin"),
      { "minItems": 1, "uniqueItems": true },
    ),
    "methods": Type.Array(HttpMethodSchema, { "minItems": 1, "uniqueItems": true }),
  }, { "additionalProperties": false }),
}, { "additionalProperties": false });

const InternalStoragePermissionRequestSchema = Type.Object({
  "id": Type.Union([
    Type.Literal("storage/internal/read"),
    Type.Literal("storage/internal/write"),
  ]),
  "scope": Type.Object({
    "directory": Type.Literal("principal"),
  }, { "additionalProperties": false }),
}, { "additionalProperties": false });

const CanonicalAbsolutePathSchema = Type.Refine(
  Type.String(),
  isCanonicalAbsolutePath,
  "Expected a canonical absolute filesystem path",
);

const ExternalStoragePermissionRequestSchema = Type.Object({
  "id": Type.Union([
    Type.Literal("storage/external/read"),
    Type.Literal("storage/external/write"),
  ]),
  "scope": Type.Object({
    "roots": Type.Array(CanonicalAbsolutePathSchema, {
      "minItems"   : 1,
      "uniqueItems": true,
    }),
  }, { "additionalProperties": false }),
}, { "additionalProperties": false });

const ProcessPermissionRequestSchema = Type.Object({
  "id"   : Type.Literal("system/process/spawn"),
  "scope": Type.Object({
    "executables": Type.Array(Type.Object({
      "path"     : CanonicalAbsolutePathSchema,
      "arguments": Type.Array(Type.Refine(
        Type.String(),
        argument => !argument.includes("\u0000"),
        "Process arguments cannot contain NUL",
      )),
    }, { "additionalProperties": false }), {
      "minItems"   : 1,
      "uniqueItems": true,
    }),
  }, { "additionalProperties": false }),
}, { "additionalProperties": false });

export const PermissionRequestSchema = Type.Union([
  Type.Literal("ui/basic"),
  Type.Literal("ui/forms/non-credential"),
  Type.Literal("system/shell"),
  Type.Literal("events/subscribe"),
  Type.Literal("logging/write"),
  NetworkPermissionRequestSchema,
  InternalStoragePermissionRequestSchema,
  ExternalStoragePermissionRequestSchema,
  ProcessPermissionRequestSchema,
]);

const PermissionsSchema = Type.Refine(
  Type.Array(PermissionRequestSchema),
  permissions => {
    const permissionIds = permissions.map(permission => {
      return typeof permission === "string" ? permission : permission.id;
    });

    return new Set(permissionIds).size === permissionIds.length;
  },
  "Permission IDs must be unique",
);

const PluginIdSchema = Type.Refine(
  Type.String({
    "minLength": 1,
    "maxLength": 128,
    "pattern"  : "^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$",
  }),
  isSafePluginId,
  "Plugin ID is unsafe or reserved",
);

const RepositoryOriginSchema = Type.Refine(
  Type.String(),
  isCanonicalRepositoryOrigin,
  "Repository origin must use the canonical plugin principal form",
);

const PluginVersionSchema = Type.Refine(
  Type.String({ "minLength": 1 }),
  isValidPluginVersion,
  "Plugin version must contain at most 128 Unicode scalar values and no controls",
);

export const ExtensionMetadataSchema = Type.Intersect([
  Type.Object({
    "id"  : PluginIdSchema,
    "logo": Type.String(),
    "name": Type.String(),
    "type": Type.Union([
      Type.Literal("sandbox"),
      Type.Literal("unrestricted"),
    ]),
    "source"    : RepositoryOriginSchema,
    "version"   : PluginVersionSchema,
    "authors"   : Type.Array(Type.String()),
    "languages" : Type.Array(Type.String()),
    "categories": Type.Array(Type.String()),
  }),
  Type.Partial(Type.Object({
    "description": Type.String(),
    "permissions": PermissionsSchema,
    "enabled"    : Type.Boolean(),
  })),
]);
