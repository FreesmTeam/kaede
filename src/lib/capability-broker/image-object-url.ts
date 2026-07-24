const imageObjectUrls = new Map<string, string>;
const imageObjectUrlSubscribers = new Map<string, Set<(source: string) => void>>;
const STORED_IMAGE_PREFIX = "kaede-storage-image:";
const LEGACY_TAURI_ASSET_PREFIXES = [
  "asset://localhost/",
  "http://asset.localhost/",
  "https://asset.localhost/",
] as const;
let cleanupRegistered = false;

function legacyTauriAssetPath(source: string): string | undefined {
  const prefix = LEGACY_TAURI_ASSET_PREFIXES.find(candidate => source.startsWith(candidate));

  if (prefix === undefined) {
    return undefined;
  }

  const encodedPath = source.slice(prefix.length);

  if (encodedPath.length === 0) {
    return undefined;
  }

  try {
    const path = decodeURIComponent(encodedPath);

    return path.length > 0 && encodeURIComponent(path) === encodedPath ? path : undefined;
  } catch {
    return undefined;
  }
}

function imageMimeType(path: string): string {
  const extension = path.split(".").pop()
    ?.toLowerCase();

  return ({
    "apng": "image/apng",
    "avif": "image/avif",
    "gif" : "image/gif",
    "jpeg": "image/jpeg",
    "jpg" : "image/jpeg",
    "png" : "image/png",
    "svg" : "image/svg+xml",
    "webp": "image/webp",
  } as const)[extension as "apng" | "avif" | "gif" | "jpeg" | "jpg" | "png" | "svg" | "webp"]
  ?? "application/octet-stream";
}

function revokeAllImageObjectUrls(): void {
  for (const url of imageObjectUrls.values()) {
    URL.revokeObjectURL(url);
  }

  imageObjectUrls.clear();
}

function allocateImageObjectUrl(path: string, bytes: Uint8Array): string {
  const previous = imageObjectUrls.get(path);

  if (previous !== undefined) {
    URL.revokeObjectURL(previous);
  }

  const url = URL.createObjectURL(new Blob([bytes], { "type": imageMimeType(path) }));

  imageObjectUrls.set(path, url);

  if (!cleanupRegistered) {
    cleanupRegistered = true;
    window.addEventListener("pagehide", revokeAllImageObjectUrls, { "once": true });
  }

  return url;
}

export function createImageObjectUrl(path: string, bytes: Uint8Array): string {
  return imageObjectUrls.get(path) ?? allocateImageObjectUrl(path, bytes);
}

export function replaceImageObjectUrl(path: string, bytes: Uint8Array): void {
  const source = allocateImageObjectUrl(path, bytes);

  for (const subscriber of imageObjectUrlSubscribers.get(path) ?? []) {
    subscriber(source);
  }
}

export function subscribeImageObjectUrl(
  path: string,
  subscriber: (source: string) => void,
): () => void {
  const subscribers = imageObjectUrlSubscribers.get(path) ?? new Set;

  subscribers.add(subscriber);
  imageObjectUrlSubscribers.set(path, subscribers);

  return (): void => {
    subscribers.delete(subscriber);

    if (subscribers.size === 0) {
      imageObjectUrlSubscribers.delete(path);
    }
  };
}

export function createStoredImageReference(path: string): string {
  if (path.length === 0) {
    throw new TypeError("A stored image path cannot be empty");
  }

  return STORED_IMAGE_PREFIX + encodeURIComponent(path);
}

export function storedImagePath(source: string): string | undefined {
  if (!source.startsWith(STORED_IMAGE_PREFIX)) {
    return legacyTauriAssetPath(source);
  }

  const path = decodeURIComponent(source.slice(STORED_IMAGE_PREFIX.length));

  if (path.length === 0) {
    throw new TypeError("A stored image reference cannot contain an empty path");
  }

  return path;
}
