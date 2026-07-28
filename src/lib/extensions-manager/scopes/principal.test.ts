import { describe, expect, test } from "vitest";

import {
  canonicalizeRepositoryOrigin,
  computeArtifactSha256,
  createPluginPrincipal,
  createPluginPrincipalFromArtifact,
  createPluginPrincipalKey,
} from "@/lib/extensions-manager/scopes/principal.ts";

describe("plugin principal", () => {
  test("canonicalizes an HTTP(S) repository origin", () => {
    expect(
      canonicalizeRepositoryOrigin("HTTPS://Example.COM:443/owner/plugin"),
    ).toBe("https://example.com/owner/plugin");
    expect(
      canonicalizeRepositoryOrigin("http://Example.COM:80/Owner/Plugin"),
    ).toBe("http://example.com/Owner/Plugin");
  });

  test("uses Rust's dotted-tail form for IPv4-mapped IPv6 hosts", () => {
    const canonical = "https://[::ffff:192.0.2.128]/owner/plugin";

    expect(canonicalizeRepositoryOrigin(canonical)).toBe(canonical);
    expect(
      canonicalizeRepositoryOrigin("https://[::ffff:c000:280]/owner/plugin"),
    ).toBe(canonical);
  });

  test("preserves canonical percent encoding accepted by the backend", () => {
    expect(
      canonicalizeRepositoryOrigin("https://example.com/owner/my%20plugin"),
    ).toBe("https://example.com/owner/my%20plugin");
    expect(
      canonicalizeRepositoryOrigin("https://example.com/owner/caf%C3%A9-plugin"),
    ).toBe("https://example.com/owner/caf%C3%A9-plugin");
  });

  test("keeps canonical repository origins idempotent", () => {
    const canonical = canonicalizeRepositoryOrigin(
      "https://example.com/owner/caf%C3%A9-plugin",
    );

    expect(canonicalizeRepositoryOrigin(canonical)).toBe(canonical);
  });

  test.each([
    "ssh://example.com/owner/plugin.git",
    "https://user@example.com/owner/plugin",
    "https://example.com/owner/plugin?ref=nightly",
    "https://example.com/owner/plugin#readme",
    "https://example.com/",
    "https://example.com/owner/../plugin",
    "https://example.com/owner/%2e%2e/plugin",
    "https://example.com/owner/%2E%2E/plugin",
    "https://example.com/owner/%2F/plugin",
    "https://example.com/owner/%5C/plugin",
    "https://example.com/owner/%C2%85plugin",
    "https://example.com/owner/café-plugin",
    "https://example.com/owner/my plugin",
    "https://example.com/owner/plugin.git",
    "https://example.com/owner/plugin.GIT",
    "https://example.com/owner/plugin.git.git",
    "https://example.com/owner/plugin.%67it",
    "https://example.com/owner//plugin",
    "https://example.com/owner/plugin/",
    "https://example.com./owner/plugin",
    "https://foo_bar.example/owner/plugin",
    "https://-bad.example/owner/plugin",
    "https://bad-.example/owner/plugin",
  ])("rejects an unsafe repository origin: %s", repositoryOrigin => {
    expect(() => canonicalizeRepositoryOrigin(repositoryOrigin)).toThrow(TypeError);
  });

  test("changes the principal when the exact artifact changes", async () => {
    const first = await createPluginPrincipalFromArtifact({
      "repositoryOrigin": "https://example.com/owner/plugin",
      "pluginId"        : "Example.Plugin",
      "version"         : "1.0.0",
      "code"            : "export default 1;\n",
    });
    const second = await createPluginPrincipalFromArtifact({
      "repositoryOrigin": "https://example.com/owner/plugin",
      "pluginId"        : "Example.Plugin",
      "version"         : "1.0.0",
      "code"            : "export default 1;",
    });

    expect(first.artifactSha256).not.toBe(second.artifactSha256);
    expect(createPluginPrincipalKey(first)).not.toBe(createPluginPrincipalKey(second));
    expect(Object.isFrozen(first)).toBe(true);
  });

  test("hashes the exact UTF-8 JavaScript artifact", async () => {
    expect(await computeArtifactSha256("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  test.each([
    "__proto__",
    "Prototype",
    "CONSTRUCTOR",
    "contains/slash",
    String.raw`contains\backslash`,
    "-leading-dash",
  ])("rejects unsafe or reserved plugin ID: %s", pluginId => {
    expect(() => createPluginPrincipal({
      "repositoryOrigin": "https://example.com/owner/plugin",
      pluginId,
      "version"         : "1.0.0",
      "artifactSha256"  : "0".repeat(64),
    })).toThrow(TypeError);
  });

  test("keeps case as part of plugin identity", () => {
    const common = {
      "repositoryOrigin": "https://example.com/owner/plugin",
      "version"         : "1.0.0",
      "artifactSha256"  : "0".repeat(64),
    };
    const lower = createPluginPrincipal({ ...common, "pluginId": "plugin" });
    const upper = createPluginPrincipal({ ...common, "pluginId": "Plugin" });

    expect(createPluginPrincipalKey(lower)).not.toBe(createPluginPrincipalKey(upper));
  });

  test("creates a bounded SHA-256 key for a valid multi-kilobyte origin", () => {
    const common = {
      "pluginId"      : "plugin",
      "version"       : "1.0.0",
      "artifactSha256": "0".repeat(64),
    };
    const first = createPluginPrincipal({
      ...common,
      "repositoryOrigin": `https://example.com/${"a".repeat(5200)}`,
    });
    const second = createPluginPrincipal({
      ...common,
      "repositoryOrigin": `https://example.com/${"a".repeat(5199)}b`,
    });
    const firstKey = createPluginPrincipalKey(first);

    expect(first.repositoryOrigin.length).toBeGreaterThan(5000);
    expect(firstKey).toMatch(/^plugin-principal-v2:sha256:[a-f0-9]{64}$/u);
    expect((new TextEncoder).encode(firstKey).byteLength).toBeLessThan(128);
    expect(firstKey).not.toBe(createPluginPrincipalKey(second));
  });

  test("bounds plugin versions by Unicode scalar values", () => {
    const common = {
      "repositoryOrigin": "https://example.com/owner/plugin",
      "pluginId"        : "plugin",
      "artifactSha256"  : "0".repeat(64),
    };

    expect(() => createPluginPrincipal({
      ...common,
      "version": "🚀".repeat(128),
    })).not.toThrow();
    expect(() => createPluginPrincipal({
      ...common,
      "version": "🚀".repeat(129),
    })).toThrow(TypeError);
  });
});
