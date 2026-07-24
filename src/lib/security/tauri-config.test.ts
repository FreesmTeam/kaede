import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Hardener, URLSink } from "ark-of-atrahasis";
import { describe, expect, test } from "vitest";

import {
  createStaticDocumentOptions,
} from "@/lib/extensions-manager/scopes/sandbox-ui-boundary.ts";
import type { PermissionRequest } from "@/types/extensions/permission.type.ts";

type Csp = Record<string, string[]>;

interface Capability {
  "identifier"  : string;
  "permissions" : string[];
  "webviews"   ?: string[];
  "windows"    ?: string[];
}

interface TauriConfig {
  "app": {
    "withGlobalTauri"?: boolean;
    "security": {
      "assetProtocol"?: {
        "enable"?: boolean;
        "scope" ?: unknown;
      };
      "capabilities"?: string[];
      "csp"         ?: Csp | string | null;
      "devCsp"      ?: Csp | string | null;
    };
  };
}

const EXPECTED_PERMISSIONS = [
  "allow-bootstrap-capability-broker",
  "allow-capability-call",
  "core:app:allow-name",
  "core:app:allow-tauri-version",
  "core:app:allow-version",
  "core:path:allow-basename",
  "core:path:allow-dirname",
  "core:path:allow-extname",
  "core:path:allow-is-absolute",
  "core:path:allow-join",
  "core:path:allow-normalize",
  "core:path:allow-resolve",
  "core:window:allow-show",
].sort();

const EXPECTED_CSP: Csp = {
  "default-src"    : ["'self'"],
  "script-src"     : ["'self'", "'unsafe-eval'"],
  "style-src"      : ["'self'", "'unsafe-inline'"],
  "img-src"        : ["'self'", "data:", "blob:", "https:", "http:"],
  "media-src"      : ["'self'", "data:", "blob:", "https:", "http:"],
  "font-src"       : ["'self'", "data:"],
  "connect-src"    : ["'self'", "ipc:", "http://ipc.localhost"],
  "worker-src"     : ["'none'"],
  "child-src"      : ["'none'"],
  "object-src"     : ["'none'"],
  "frame-src"      : ["'none'"],
  "frame-ancestors": ["'none'"],
  "form-action"    : ["'none'"],
  "base-uri"       : ["'none'"],
};

const REMOTE_URL_SINK_CSP_DIRECTIVES = [
  ["image.src", "img-src"],
  ["video.poster", "img-src"],
  ["video.src", "media-src"],
  ["audio.src", "media-src"],
  ["source.src", "media-src"],
  ["track.src", "media-src"],
] as const satisfies ReadonlyArray<readonly [URLSink, "img-src" | "media-src"]>;
const NON_SELF_REMOTE_ORIGINS = [
  "http://images.example.test:8080",
  "https://media.example.test",
] as const;
const TEST_HARDENER: Hardener = <Value>(value: Value): Value => value;

const repositoryRoot = process.cwd();
const capabilitiesDirectory = path.resolve(repositoryRoot, "src-tauri/capabilities");

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

const config = readJson<TauriConfig>(path.resolve(repositoryRoot, "src-tauri/tauri.conf.json"));
const capabilities = readdirSync(capabilitiesDirectory)
  .filter(fileName => fileName.endsWith(".json"))
  .sort()
  .map(fileName => readJson<Capability>(path.resolve(capabilitiesDirectory, fileName)));
const buildWorkflow = readFileSync(
  path.resolve(repositoryRoot, ".github/workflows/build.yml"),
  "utf8",
);

function requireCsp(value: Csp | string | null | undefined): Csp {
  expect(value).toBeTypeOf("object");
  expect(value).not.toBeNull();

  return value as Csp;
}

describe("Tauri security boundary", () => {
  test("disables global Tauri and the asset protocol", () => {
    expect(config.app.withGlobalTauri).toBe(false);
    expect(config.app.security.assetProtocol).toEqual({ "enable": false });
    expect(buildWorkflow).not.toContain("**/*");
  });

  test("loads only the exact main WebView capability", () => {
    expect(config.app.security.capabilities).toEqual(["main"]);
    expect(capabilities).toHaveLength(1);
    expect(capabilities[0]?.identifier).toBe("main");
    expect(capabilities[0]?.webviews).toEqual(["main"]);
    expect(capabilities[0]?.windows).toBeUndefined();
  });

  test("rejects raw privileged APIs outside the minimal bootstrap allowlist", () => {
    expect([...(capabilities[0]?.permissions ?? [])].sort()).toEqual(EXPECTED_PERMISSIONS);
  });

  test("keeps production CSP closed and isolates the Vite HMR exception to development", () => {
    const csp = requireCsp(config.app.security.csp);
    const developmentCsp = requireCsp(config.app.security.devCsp);

    expect(csp).toEqual(EXPECTED_CSP);
    expect(developmentCsp).toEqual({
      ...EXPECTED_CSP,
      "connect-src": [...EXPECTED_CSP["connect-src"], "ws://localhost:5173"],
    });
  });

  test("covers each SafeDocument image and media URL scheme while Ark keeps exact origins", () => {
    const csp = requireCsp(config.app.security.csp);
    const developmentCsp = requireCsp(config.app.security.devCsp);
    const permissions = [{
      "id"   : "network/http",
      "scope": {
        "origins": NON_SELF_REMOTE_ORIGINS,
        "methods": ["GET"],
      },
    }] satisfies ReadonlyArray<PermissionRequest>;
    const remoteSinks = REMOTE_URL_SINK_CSP_DIRECTIVES.map(([sink]) => sink);
    const documentOptions = createStaticDocumentOptions(
      permissions,
      [],
      remoteSinks,
      TEST_HARDENER,
    );

    for (const [sink, directive] of REMOTE_URL_SINK_CSP_DIRECTIVES) {
      const sinkPolicy = documentOptions.urlPolicy?.sinks[sink];

      expect(sinkPolicy?.allowedOrigins).toEqual(NON_SELF_REMOTE_ORIGINS);
      expect(sinkPolicy?.allowedProtocols).toEqual(["http:", "https:"]);

      for (const effectiveCsp of [csp, developmentCsp]) {
        expect(effectiveCsp[directive]).toEqual(
          expect.arrayContaining([...(sinkPolicy?.allowedProtocols ?? [])]),
        );
      }
    }
  });
});
