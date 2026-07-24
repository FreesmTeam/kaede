import type {
  BrowserStorage,
  BrowserStorageValue,
} from "@/lib/browser/scopes/browser-storage.ts";
import type { DirectoryEntry } from "@/lib/capability-broker/types.ts";
import type { ExternalStorageTarget } from "@/types/extensions/permission.type.ts";

export function normalizeBrowserPath(filePath: string): string {
  const prefix = filePath.startsWith("/") ? "/" : "";
  const segments: Array<string> = [];

  for (const segment of filePath.replace(/\\/gu, "/").split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }

    if (segment === "..") {
      segments.pop();
    } else {
      segments.push(segment);
    }
  }

  return prefix + segments.join("/");
}

export function joinBrowserPath(...parts: ReadonlyArray<string>): string {
  return normalizeBrowserPath(parts.join("/"));
}

export function cloneStorageValue(value: BrowserStorageValue): BrowserStorageValue {
  return typeof value === "string" ? value : Uint8Array.from(value);
}

export function storageValueToBytes(value: BrowserStorageValue): Uint8Array {
  return typeof value === "string" ? (new TextEncoder).encode(value) : Uint8Array.from(value);
}

export async function storageExists(storage: BrowserStorage, path: string): Promise<boolean> {
  const normalized = normalizeBrowserPath(path);
  const keys = await storage.keys();

  return keys.some(key => {
    const normalizedKey = normalizeBrowserPath(key);

    return normalizedKey === normalized || normalizedKey.startsWith(normalized + "/");
  });
}

export async function readRequiredValue(
  storage: BrowserStorage,
  path: string,
): Promise<BrowserStorageValue> {
  const result = await storage.read(normalizeBrowserPath(path));

  if (result.kind === "missing") {
    throw new Error(`Browser preview file does not exist: ${JSON.stringify(path)}`);
  }

  return result.value;
}

export async function readBrowserDirectory(
  storage: BrowserStorage,
  directory: string,
): Promise<ReadonlyArray<DirectoryEntry>> {
  const normalizedDirectory = normalizeBrowserPath(directory).replace(/\/$/u, "");
  const prefix = normalizedDirectory === "" ? "" : normalizedDirectory + "/";
  const entries = new Map<string, DirectoryEntry>;

  for (const key of await storage.keys()) {
    const normalizedKey = normalizeBrowserPath(key);

    if (!normalizedKey.startsWith(prefix)) {
      continue;
    }

    const remainder = normalizedKey.slice(prefix.length);
    const [name, ...descendants] = remainder.split("/");

    if (name === "") {
      continue;
    }

    const isDirectory = descendants.length > 0;
    const existing = entries.get(name);

    entries.set(name, Object.freeze({
      name,
      "isDirectory": isDirectory || existing?.isDirectory === true,
      "isFile"     : !isDirectory || existing?.isFile === true,
      "isSymlink"  : false,
    }));
  }

  return Object.freeze([...entries.values()].sort((left, right) => {
    return left.name.localeCompare(right.name);
  }));
}

export function externalStoragePath(target: ExternalStorageTarget): string {
  if (
    target.relativePath.startsWith("/") ||
    target.relativePath.startsWith("\\") ||
    target.relativePath.split(/[\\/]/u).some(segment => {
      return segment === "" || segment === "." || segment === "..";
    })
  ) {
    throw new TypeError(
      `Invalid external storage relative path: ${JSON.stringify(target.relativePath)}`,
    );
  }

  return joinBrowserPath(target.root, target.relativePath);
}
