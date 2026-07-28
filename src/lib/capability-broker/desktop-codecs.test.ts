import { expect, test } from "vitest";

import {
  toInitializationFinalizationReport,
  toInitialState,
  toResponse,
} from "@/lib/capability-broker/desktop-codecs.ts";

test("maps initialization DTOs into immutable host values", () => {
  const state = toInitialState({
    "basic": {
      "launcherVersion": "1.2.3",
      "baseDirectory"  : "/app/data",
      "launchCount"    : 3,
      "separator"      : "/",
      "portable"       : false,
    },
    "parsed": {
      "config"      : { "status": "loaded", "data": { "layout": "test" } },
      "accounts"    : { "status": "missing" },
      "instances"   : { "status": "missing" },
      "translations": { "status": "corrupt", "raw": "{", "error": "invalid JSON" },
    },
  });
  const createdDirectories = ["/app/data/assets"];
  const report = toInitializationFinalizationReport({
    createdDirectories,
    "javaMajor"      : 21,
    "javaMajorSource": "release-file",
  });

  createdDirectories.push("/app/data/libraries");

  expect(state.parsed.translations).toEqual({
    "status": "corrupt",
    "raw"   : "{",
    "error" : "invalid JSON",
  });
  expect(Object.isFrozen(state)).toBe(true);
  expect(Object.isFrozen(state.basic)).toBe(true);
  expect(Object.isFrozen(state.parsed)).toBe(true);
  expect(Object.isFrozen(state.parsed.translations)).toBe(true);
  expect(report.createdDirectories).toEqual(["/app/data/assets"]);
  expect(Object.isFrozen(report)).toBe(true);
  expect(Object.isFrozen(report.createdDirectories)).toBe(true);
});

test("rejects HTTP statuses that a standard Response cannot represent", () => {
  expect(() => toResponse({
    "status"    : 101,
    "statusText": "Switching Protocols",
    "headers"   : [],
    "body"      : [],
    "url"       : "https://example.test/upgrade",
    "redirected": false,
  })).toThrow("status 101 cannot be represented as a Response");
});

test("maps bodyless HTTP statuses without constructing an invalid response body", () => {
  const response = toResponse({
    "status"    : 204,
    "statusText": "No Content",
    "headers"   : [],
    "body"      : [],
    "url"       : "https://example.test/no-content",
    "redirected": false,
  });

  expect(response.status).toBe(204);
  expect(response.body).toBeNull();
});
