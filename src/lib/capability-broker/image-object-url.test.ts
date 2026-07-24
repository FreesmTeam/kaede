import { describe, expect, test, vi } from "vitest";

import {
  createImageObjectUrl,
  createStoredImageReference,
  replaceImageObjectUrl,
  storedImagePath,
  subscribeImageObjectUrl,
} from "@/lib/capability-broker/image-object-url.ts";

test("notifies mounted image consumers when the same path gets new bytes", () => {
  const path = "/kaede/resources/reused-name.png";

  Object.defineProperty(window, "addEventListener", {
    "configurable": true,
    "value"       : vi.fn(),
  });
  const createObjectUrl = vi.spyOn(URL, "createObjectURL")
    .mockReturnValueOnce("blob:first-image")
    .mockReturnValueOnce("blob:second-image");
  const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL")
    .mockImplementation(() => {});
  let renderedSource = "";
  const firstSource = createImageObjectUrl(path, Uint8Array.of(1));

  renderedSource = firstSource;

  const unsubscribe = subscribeImageObjectUrl(path, source => {
    renderedSource = source;
  });

  expect(firstSource).toBe("blob:first-image");

  replaceImageObjectUrl(path, Uint8Array.of(2));

  expect(renderedSource).toBe("blob:second-image");
  expect(revokeObjectUrl).toHaveBeenCalledWith("blob:first-image");

  unsubscribe();
  createObjectUrl.mockRestore();
  revokeObjectUrl.mockRestore();
  Reflect.deleteProperty(window, "addEventListener");
});

test("stored image references survive JSON persistence with their durable path", () => {
  const path = "/kaede/resources/custom icon.webp";
  const icon = createStoredImageReference(path);
  const persisted = JSON.stringify({ icon });
  const restored = JSON.parse(persisted) as Readonly<{ "icon": string }>;

  expect(restored.icon).not.toMatch(/^blob:/u);
  expect(storedImagePath(restored.icon)).toBe(path);
});

describe("legacy Tauri asset image references", () => {
  test("resolves a persisted Unix asset URL for the Image broker read", () => {
    const path = "/home/kaede/Application Support/resources/custom icon.webp";
    const icon = `asset://localhost/${encodeURIComponent(path)}`;
    const persisted = JSON.stringify({ icon });
    const restored = JSON.parse(persisted) as Readonly<{ "icon": string }>;

    expect(storedImagePath(restored.icon)).toBe(path);
  });

  test.each([
    "http://asset.localhost/",
    "https://asset.localhost/",
  ])("resolves a persisted Windows asset URL using %s", prefix => {
    const path = String.raw`C:\Users\Kaede User\AppData\Roaming\kaede\custom icon.png`;
    const icon = prefix + encodeURIComponent(path);

    expect(storedImagePath(icon)).toBe(path);
  });

  test("decodes the encoded path exactly once", () => {
    const path = "/home/kaede/resources/literal-%2F-icon.png";
    const icon = `asset://localhost/${encodeURIComponent(path)}`;

    expect(storedImagePath(icon)).toBe(path);
  });

  test.each([
    "asset://localhost/",
    "asset://localhost/%",
    "asset://localhost/%ED%A0%80",
    "asset://localhost//home/kaede/icon.png",
    "asset://localhost/%2Fhome%2Fkaede%2Ficon.png?version=1",
    "asset://localhost/%2Fhome%2Fkaede%2Ficon.png#preview",
    "asset://user@localhost/%2Fhome%2Fkaede%2Ficon.png",
    "asset://localhost:80/%2Fhome%2Fkaede%2Ficon.png",
    "asset://localhost.evil.example/%2Fhome%2Fkaede%2Ficon.png",
    "http://asset.localhost.evil.example/C%3A%5Cicon.png",
    "https://user@asset.localhost/C%3A%5Cicon.png",
    "https://asset.localhost:443/C%3A%5Cicon.png",
    "https://example.com/icon.png",
  ])("rejects malformed, confused-host, or unrelated source %s", source => {
    expect(storedImagePath(source)).toBeUndefined();
  });
});
