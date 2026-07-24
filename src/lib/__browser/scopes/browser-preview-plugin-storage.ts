import type { BrowserGrantGuard } from "@/lib/browser/scopes/browser-preview-grants.ts";
import {
  externalStoragePath,
  joinBrowserPath,
  readRequiredValue,
  storageValueToBytes,
} from "@/lib/browser/scopes/browser-preview-paths.ts";
import {
  BROWSER_BROKER_PRIVATE_STORAGE_ROOT,
  isBrowserBrokerPrivateStoragePath,
} from "@/lib/browser/scopes/browser-preview-private-storage.ts";
import type {
  BrowserSessionOperationRunner,
} from "@/lib/browser/scopes/browser-preview-session-operations.ts";
import type { BrowserStorage } from "@/lib/browser/scopes/browser-storage.ts";
import type { PluginCapabilityFactories } from "@/lib/capability-broker/types.ts";
import {
  createPluginPrincipalKey,
  type PluginPrincipal,
} from "@/lib/extensions-manager/scopes/principal.ts";
import type {
  BrokerBytes,
  ExternalStorageTarget,
  PermissionId,
} from "@/types/extensions/permission.type.ts";

export type BrowserPluginStorageFactories = Pick<
  PluginCapabilityFactories,
  | "storage/internal/read"
  | "storage/internal/write"
  | "storage/external/read"
  | "storage/external/write"
>;

export function createBrowserPluginStorageFactories(
  principal: PluginPrincipal,
  storage: BrowserStorage,
  requireGrant: BrowserGrantGuard,
  runOperation: BrowserSessionOperationRunner,
): BrowserPluginStorageFactories {
  const internalRoot = joinBrowserPath(
    BROWSER_BROKER_PRIVATE_STORAGE_ROOT,
    "plugin-data",
    encodeURIComponent(createPluginPrincipalKey(principal)),
  );
  const internalPath = (relativePath: string, id: PermissionId): string => {
    requireGrant(id);

    if (relativePath.split(/[\\/]/u).some(segment => {
      return segment === "" || segment === "." || segment === "..";
    })) {
      throw new TypeError(`Invalid internal storage path: ${JSON.stringify(relativePath)}`);
    }

    return joinBrowserPath(internalRoot, relativePath);
  };
  const readBytes = async (path: string): Promise<BrokerBytes> => {
    const value = await readRequiredValue(storage, path);

    return Object.freeze([...storageValueToBytes(value)]);
  };
  const requireExternalTarget = (
    id: "storage/external/read" | "storage/external/write",
    target: ExternalStorageTarget,
  ): string => {
    const grants = requireGrant(id);

    if (!grants.some(grant => {
      return typeof grant !== "string" &&
        (grant.id === "storage/external/read" || grant.id === "storage/external/write") &&
        grant.id === id &&
        grant.scope.roots.includes(target.root);
    })) {
      throw new Error(
        `Browser preview external storage root is outside its grant: ${target.root}`,
      );
    }

    const path = externalStoragePath(target);

    if (isBrowserBrokerPrivateStoragePath(path)) {
      throw new Error("Browser preview private broker storage is outside plugin grants");
    }

    return path;
  };

  return Object.freeze({
    "storage/internal/read": () => Object.freeze({
      "read": (relativePath: string): Promise<BrokerBytes> => {
        return runOperation(() => {
          return readBytes(internalPath(relativePath, "storage/internal/read"));
        });
      },
      "readText": (relativePath: string): Promise<string> => {
        return runOperation(async () => {
          const bytes = await readBytes(internalPath(relativePath, "storage/internal/read"));

          return (new TextDecoder).decode(Uint8Array.from(bytes));
        });
      },
    }),
    "storage/internal/write": () => Object.freeze({
      "write": (relativePath: string, contents: BrokerBytes): Promise<void> => {
        return runOperation(async () => {
          await storage.write(
            internalPath(relativePath, "storage/internal/write"),
            Uint8Array.from(contents),
          );
        });
      },
      "writeText": (relativePath: string, contents: string): Promise<void> => {
        return runOperation(async () => {
          await storage.write(internalPath(relativePath, "storage/internal/write"), contents);
        });
      },
      "remove": (relativePath: string): Promise<void> => {
        return runOperation(async () => {
          await storage.remove(internalPath(relativePath, "storage/internal/write"));
        });
      },
    }),
    "storage/external/read": () => Object.freeze({
      "read": (target: ExternalStorageTarget): Promise<BrokerBytes> => {
        return runOperation(() => {
          return readBytes(requireExternalTarget("storage/external/read", target));
        });
      },
      "readText": (target: ExternalStorageTarget): Promise<string> => {
        return runOperation(async () => {
          const bytes = await readBytes(requireExternalTarget("storage/external/read", target));

          return (new TextDecoder).decode(Uint8Array.from(bytes));
        });
      },
    }),
    "storage/external/write": () => Object.freeze({
      "write": (target: ExternalStorageTarget, contents: BrokerBytes): Promise<void> => {
        return runOperation(async () => {
          await storage.write(
            requireExternalTarget("storage/external/write", target),
            Uint8Array.from(contents),
          );
        });
      },
      "writeText": (target: ExternalStorageTarget, contents: string): Promise<void> => {
        return runOperation(async () => {
          await storage.write(requireExternalTarget("storage/external/write", target), contents);
        });
      },
      "remove": (target: ExternalStorageTarget): Promise<void> => {
        return runOperation(async () => {
          await storage.remove(requireExternalTarget("storage/external/write", target));
        });
      },
    }),
  });
}
