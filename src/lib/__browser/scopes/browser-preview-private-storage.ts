import { normalizeBrowserPath } from "@/lib/browser/scopes/browser-preview-paths.ts";

export const BROWSER_BROKER_PRIVATE_STORAGE_ROOT =
  "indexed_db/capability-broker";

export function isBrowserBrokerPrivateStoragePath(path: string): boolean {
  const normalizedPath = normalizeBrowserPath(path);

  return normalizedPath === BROWSER_BROKER_PRIVATE_STORAGE_ROOT ||
    normalizedPath.startsWith(`${BROWSER_BROKER_PRIVATE_STORAGE_ROOT}/`);
}
