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
    if (argument.includes("\u{0}")) {
      throw invalidScope("process argument", argument);
    }
  }

  return Object.freeze([...argumentsList]);
}

function executableKey(executable: ProcessExecutableScope): string {
  const segments = [executable.path, ...executable.arguments];

  return segments.map(segment => `${segment.length}:${segment}`).join("|");
}

function compareExecutables(left: ProcessExecutableScope, right: ProcessExecutableScope): number {
  return compareStrings(executableKey(left), executableKey(right));
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

  permissionRequests: for (const request of requests) {
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
        continue permissionRequests;
      }
      case "storage/internal/read":
      case "storage/internal/write": {
        if (request.scope.directory !== "principal") {
          throw invalidScope("internal storage directory", request.scope.directory);
        }

        internalStoragePermissions.add(request.id);
        continue permissionRequests;
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
        continue permissionRequests;
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
        continue permissionRequests;
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
    const origins = Object.freeze(copyAndSort([...networkOrigins], compareStrings));
    const methods = Object.freeze(copyAndSort([...networkMethods], compareStrings));
    const scope = Object.freeze({ origins, methods });
    const networkRequest: NetworkPermissionRequest = Object.freeze({
      "id": "network/http",
      scope,
    });

    normalized.push(networkRequest);
  }

  for (const permissionId of internalStoragePermissions) {
    const scope = Object.freeze({ "directory": "principal" as const });
    const request = Object.freeze({
      "id": permissionId,
      scope,
    });

    normalized.push(request);
  }

  for (const permissionId of EXTERNAL_STORAGE_PERMISSION_IDS) {
    const roots = externalRoots.get(permissionId);

    if (roots !== undefined && roots.size > 0) {
      const normalizedRoots = Object.freeze(copyAndSort([...roots], compareStrings));
      const scope = Object.freeze({ "roots": normalizedRoots });
      const request = Object.freeze({
        "id": permissionId,
        scope,
      });

      normalized.push(request);
    }
  }

  if (hasProcessPermission) {
    const executables = copyAndSort([...processExecutables.values()], compareExecutables);
    const scope = Object.freeze({ "executables": Object.freeze(executables) });
    const processRequest: ProcessPermissionRequest = Object.freeze({
      "id": "system/process/spawn",
      scope,
    });

    normalized.push(processRequest);
  }

  normalized.sort((left, right) => {
    return compareStrings(permissionRequestId(left), permissionRequestId(right));
  });

  return Object.freeze(normalized);
}
