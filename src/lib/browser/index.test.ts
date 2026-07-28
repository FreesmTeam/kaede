import { expect, test } from "vitest";

import DesktopBrowser from "./index.ts";
import {
  createBrowserCapabilityBroker,
} from "./scopes/create-browser-capability-broker.ts";

test("desktop browser adapter stays fail-closed", async () => {
  expect(DesktopBrowser.detectIsBrowser()).toBe(false);
  await expect(DesktopBrowser.readStoragePath("private/path")).resolves.toBe("");
  await expect(DesktopBrowser.writeToStoragePath("private/path", "value")).resolves.toBeUndefined();
  await expect(createBrowserCapabilityBroker((): never => {
    throw new Error("Desktop browser stub must not request an event factory");
  })).rejects.toThrow(
    "browser capability broker in a desktop build is unsupported in browser preview",
  );
});
