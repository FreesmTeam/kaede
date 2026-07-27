import { copyAndSort } from "@/lib/collections/copy-array.ts";
import {
  isCanonicalAbsolutePath,
} from "@/lib/extensions-manager/scopes/canonical-absolute-path.ts";
import {
  assertPermissionGrantFamilyCompatibility,
} from "@/lib/extensions-manager/scopes/permission-grant-families.ts";
import type {
  ExternalStoragePermissionRequest, HttpMethod, InternalStoragePermissionRequest,
  NetworkPermissionRequest, PermissionRequest, ProcessExecutableScope,
  ProcessPermissionRequest, SimplePermissionId,
} from "@/types/extensions/permission.type.ts";

const HTTP_METHODS: ReadonlySet<string> = new Set(
  ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
);
const SIMPLE_PERMISSION_IDS: ReadonlySet<string> = new Set(
  ["ui/basic", "ui/forms/non-credential", "system/shell", "events/subscribe", "logging/write"],
);
const EXTERNAL_STORAGE_PERMISSION_IDS = [
  "storage/external/read",
  "storage/external/write",
] as const;

function compareStrings(left: string, right: string): number {
  return Number(left > right) - Number(left < right);
}

function invalidScope(label: string, value: string): TypeError {
  return new TypeError(`Invalid ${label}: ${JSON.stringify(value)}`);
}

function isSimplePermissionId(permissionId: string): permissionId is SimplePermissionId {
  return SIMPLE_PERMISSION_IDS.has(permissionId);
}

function isHttpMethod(method: string): method is HttpMethod {
  return HTTP_METHODS.has(method);
}

function canonicalizeHttpOrigin(origin: string): string {
  if (origin.trim() !== origin || origin.includes("\\")) {
    throw invalidScope("HTTP origin", origin);
  }

  let parsed: URL;

  try {
    parsed = new URL(origin);
  } catch {
    throw invalidScope("HTTP origin", origin);
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw invalidScope("HTTP origin", origin);
  }

  return parsed.origin;
}

export function isExactHttpOrigin(origin: string): boolean {
  try {
    return canonicalizeHttpOrigin(origin) === origin;
  } catch {
    return false;
  }
}

function validateCanonicalAbsolutePath(filePath: string, label: string): string {
  if (!isCanonicalAbsolutePath(filePath)) {
    throw invalidScope(label, filePath);
  }

  return filePath;
}

function validateArguments(argumentsList: ReadonlyArray<string>): ReadonlyArray<string> {
  for (const argument of argumentsList) {
    if (argument.includes("\u0000")) {
      throw invalidScope("process argument", argument);
    }
  }

  return Object.freeze([...argumentsList]);
}

function executableKey(executable: ProcessExecutableScope): string {
  const segments = [executable.path, ...executable.arguments];

  return segments.map(segment => `${segment.length}:${segment}`).join("|");
}

function permissionRequestId(request: PermissionRequest): string {
  return typeof request === "string" ? request : request.id;
}

export function normalizePermissionRequests(
  requests: ReadonlyArray<PermissionRequest>,
): ReadonlyArray<PermissionRequest> {
  const simplePermissions = (new Set<SimplePermissionId>);
  const internalStoragePermissions = (new Set<InternalStoragePermissionRequest["id"]>);
  const externalRoots = new Map<ExternalStoragePermissionRequest["id"], Set<string>>(
    EXTERNAL_STORAGE_PERMISSION_IDS.map(permissionId => [permissionId, (new Set<string>)]),
  );
  const networkOrigins = (new Set<string>);
  const networkMethods = (new Set<HttpMethod>);
  const processExecutables = (new Map<string, ProcessExecutableScope>);
  let hasNetworkPermission = false;
  let hasProcessPermission = false;

  for (const request of requests) {
    if (typeof request === "string") {
      if (!isSimplePermissionId(request)) {
        throw invalidScope("simple permission ID", request);
      }

      simplePermissions.add(request);
      continue;
    }

    switch (request.id) {
      case "network/http": {
        if (hasNetworkPermission) {
          throw new TypeError("Only one network/http descriptor is allowed per permission request");
        }

        if (request.scope.origins.length === 0 || request.scope.methods.length === 0) {
          throw invalidScope("network permission scope", request.id);
        }

        hasNetworkPermission = true;

        for (const origin of request.scope.origins) {
          networkOrigins.add(canonicalizeHttpOrigin(origin));
        }

        for (const method of request.scope.methods) {
          if (!isHttpMethod(method)) {
            throw invalidScope("HTTP method", method);
          }

          networkMethods.add(method);
        }
        break;
      }
      case "storage/internal/read":
      case "storage/internal/write": {
        if (request.scope.directory !== "principal") {
          throw invalidScope("internal storage directory", request.scope.directory);
        }

        internalStoragePermissions.add(request.id);
        break;
      }
      case "storage/external/read":
      case "storage/external/write": {
        if (request.scope.roots.length === 0) {
          throw invalidScope("external storage scope", request.id);
        }

        const roots = externalRoots.get(request.id);

        if (roots === undefined) {
          throw invalidScope("external storage permission ID", request.id);
        }

        for (const root of request.scope.roots) {
          roots.add(validateCanonicalAbsolutePath(root, "external storage root"));
        }
        break;
      }
      case "system/process/spawn": {
        if (request.scope.executables.length === 0) {
          throw invalidScope("process permission scope", request.id);
        }

        hasProcessPermission = true;

        for (const executable of request.scope.executables) {
          const normalizedExecutable = Object.freeze({
            "path"     : validateCanonicalAbsolutePath(executable.path, "executable path"),
            "arguments": validateArguments(executable.arguments),
          });

          processExecutables.set(executableKey(normalizedExecutable), normalizedExecutable);
        }
        break;
      }
      default: {
        throw new TypeError(
          `Invalid structured permission request: ${JSON.stringify(request)}`,
        );
      }
    }
  }

  const hasStorageWritePermission = internalStoragePermissions.has("storage/internal/write") ||
    (externalRoots.get("storage/external/write")?.size ?? 0) > 0;

  assertPermissionGrantFamilyCompatibility(hasProcessPermission, hasStorageWritePermission);

  const normalized: Array<PermissionRequest> = [...simplePermissions];

  if (hasNetworkPermission) {
    const networkRequest: NetworkPermissionRequest = Object.freeze({
      "id"   : "network/http",
      "scope": Object.freeze({
        "origins": Object.freeze(copyAndSort([...networkOrigins], compareStrings)),
        "methods": Object.freeze(copyAndSort([...networkMethods], compareStrings)),
      }),
    });

    normalized.push(networkRequest);
  }

  for (const permissionId of internalStoragePermissions) {
    normalized.push(Object.freeze({
      "id"   : permissionId,
      "scope": Object.freeze({ "directory": "principal" }),
    }));
  }

  for (const permissionId of EXTERNAL_STORAGE_PERMISSION_IDS) {
    const roots = externalRoots.get(permissionId);

    if (roots !== undefined && roots.size > 0) {
      normalized.push(Object.freeze({
        "id"   : permissionId,
        "scope": Object.freeze({
          "roots": Object.freeze(copyAndSort([...roots], compareStrings)),
        }),
      }));
    }
  }

  if (hasProcessPermission) {
    const processRequest: ProcessPermissionRequest = Object.freeze({
      "id"   : "system/process/spawn",
      "scope": Object.freeze({
        "executables": Object.freeze(
          copyAndSort([...processExecutables.values()], (left, right) => {
            return compareStrings(executableKey(left), executableKey(right));
          }),
        ),
      }),
    });

    normalized.push(processRequest);
  }

  normalized.sort((left, right) => {
    return compareStrings(permissionRequestId(left), permissionRequestId(right));
  });

  return Object.freeze(normalized);
}
