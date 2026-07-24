import type {
  Hardener,
  SafeDocumentOptions,
  SafeStyleProperty,
  SafeURLPolicy,
  URLProtocol,
  URLSink,
  URLSinkPolicy,
} from "ark-of-atrahasis";

import {
  createBasicUIStylePolicy,
  NON_CREDENTIAL_FORM_CONTROL_POLICY,
} from "@/lib/extensions-manager/scopes/permissions/ui.ts";
import type {
  SandboxHostBoundary,
  SandboxMaxBounds,
} from "@/lib/extensions-manager/scopes/sandbox-runtime-types.ts";
import type { PermissionRequest } from "@/types/extensions/permission.type.ts";

export function normalizeSandboxMaxBounds(maxBounds: SandboxMaxBounds): SandboxMaxBounds {
  if (maxBounds === null || typeof maxBounds !== "object") {
    throw new TypeError("Sandbox max bounds must be an own-data record");
  }

  const expectedKeys = ["inlineSizePx", "blockSizePx"] as const;
  const ownKeys = Reflect.ownKeys(maxBounds);

  if (
    ownKeys.length !== expectedKeys.length ||
    expectedKeys.some(key => !ownKeys.includes(key))
  ) {
    throw new TypeError("Sandbox max bounds must contain exactly inlineSizePx and blockSizePx");
  }

  const normalized: Record<string, number> = Object.create(null);

  for (const label of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(maxBounds, label);

    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(`Sandbox ${label} must be an own-data property`);
    }

    const { value } = descriptor;

    if (!Number.isSafeInteger(value) || value <= 0 || value > 100_000) {
      throw new TypeError(`Invalid sandbox ${label}: ${JSON.stringify(value)}`);
    }

    normalized[label] = value;
  }

  return Object.freeze(normalized) as SandboxMaxBounds;
}

export function createSandboxHostBoundary(
  trustedContainer: HTMLElement,
  maxBounds: SandboxMaxBounds,
): SandboxHostBoundary {
  const host = trustedContainer.ownerDocument.createElement("div");

  host.style.contain = "paint";
  host.style.display = "block";
  host.style.boxSizing = "border-box";
  host.style.inlineSize = "100%";
  host.style.maxInlineSize = `${maxBounds.inlineSizePx}px`;
  host.style.maxBlockSize = `${maxBounds.blockSizePx}px`;
  host.style.overflow = "auto";
  trustedContainer.append(host);

  const root = host.attachShadow({ "mode": "closed" });

  return Object.freeze({
    root,
    "remove": (): void => host.remove(),
  });
}

function buildStaticURLPolicy(
  permissions: ReadonlyArray<PermissionRequest>,
  urlSinks: ReadonlyArray<URLSink>,
): SafeURLPolicy | undefined {
  const networkPermission = permissions.find(permission => {
    return typeof permission !== "string" && permission.id === "network/http";
  });

  if (
    networkPermission === undefined ||
    typeof networkPermission === "string" ||
    networkPermission.id !== "network/http" ||
    !networkPermission.scope.methods.includes("GET")
  ) {
    return undefined;
  }

  const allowedProtocols = Object.freeze([
    ...new Set(networkPermission.scope.origins.map(origin => {
      return new URL(origin).protocol as URLProtocol;
    })),
  ]);
  const sinkPolicy = Object.freeze({
    "allowedOrigins"  : networkPermission.scope.origins,
    allowedProtocols,
    "allowCredentials": false,
    "allowQuery"      : true,
    "allowFragment"   : true,
    "maxLength"       : 65_536,
  }) satisfies URLSinkPolicy;
  const sinks: Partial<Record<URLSink, URLSinkPolicy>> = {};

  for (const sink of urlSinks) {
    sinks[sink] = sinkPolicy;
  }

  return Object.freeze({
    "baseURL": `${networkPermission.scope.origins[0]}/`,
    "sinks"  : Object.freeze(sinks),
  });
}

export function createStaticDocumentOptions(
  permissions: ReadonlyArray<PermissionRequest>,
  safeStyleProperties: ReadonlyArray<SafeStyleProperty>,
  urlSinks: ReadonlyArray<URLSink>,
  hardener: Hardener,
): SafeDocumentOptions {
  const documentOptions: SafeDocumentOptions = {
    "harden"     : hardener,
    "stylePolicy": createBasicUIStylePolicy(safeStyleProperties),
  };
  const urlPolicy = buildStaticURLPolicy(permissions, urlSinks);

  if (urlPolicy !== undefined) {
    Object.assign(documentOptions, { urlPolicy });
  }

  if (permissions.includes("ui/forms/non-credential")) {
    Object.assign(documentOptions, {
      "formControlPolicy": NON_CREDENTIAL_FORM_CONTROL_POLICY,
    });
  }

  return documentOptions;
}
