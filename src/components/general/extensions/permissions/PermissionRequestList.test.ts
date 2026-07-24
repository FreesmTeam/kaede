import { renderToString } from "@vue/server-renderer";
import { expect, test, vi } from "vitest";
import { createSSRApp } from "vue";

import PermissionRequestList from
  "@/components/general/extensions/permissions/PermissionRequestList.vue";
import type { PreparedPermissionRequest } from "@/lib/capability-broker";
import type { PermissionPrompt } from
  "@/lib/extensions-manager/scopes/permission-prompts.ts";
import {
  createPluginPrincipal,
  createPluginPrincipalKey,
} from "@/lib/extensions-manager/scopes/principal.ts";

vi.mock("@/components/general/base/MaterialRipple.vue", () => ({
  "default": (): null => null,
}));

const principal = createPluginPrincipal({
  "repositoryOrigin": "https://example.com/plugins",
  "pluginId"        : "identity-render-test",
  "version"         : "1.0.0",
  "artifactSha256"  : "a".repeat(64),
});
const principalKey = createPluginPrincipalKey(principal);
const TARGET_ID_PREFIX = "__extensions-loader__permission-request-target";

function externalWriteRequest(
  path: string,
  inode: string,
): PreparedPermissionRequest {
  return {
    "descriptor": {
      "id"   : "storage/external/write",
      "scope": { "roots": [path] },
    },
    "targetIdentities": [{
      "kind"            : "external_storage_root",
      path,
      "identityProvider": "desktop-filesystem-v1",
      "device"          : "41",
      inode,
    }],
  };
}

function processRequest(
  path: string,
  contentSha256: string,
): PreparedPermissionRequest {
  return {
    "descriptor": {
      "id"   : "system/process/spawn",
      "scope": { "executables": [{ path, "arguments": ["--version"] }] },
    },
    "targetIdentities": [{
      "kind"            : "process_executable",
      path,
      "identityProvider": "desktop-executable-sha256-v1",
      "device"          : "51",
      "inode"           : "7001",
      contentSha256,
    }],
  };
}

function promptFor(
  kind: PermissionPrompt["kind"],
  requests: ReadonlyArray<PreparedPermissionRequest>,
): PermissionPrompt {
  if (kind === "static") {
    return {
      kind,
      principal,
      principalKey,
      requests,
      "fingerprint": `test-${kind}`,
    };
  }

  return {
    kind,
    principal,
    principalKey,
    requests,
    "rememberedDecisions": requests.map((): undefined => {}),
    "fingerprint"        : `test-${kind}`,
  };
}

async function renderPrompt(prompt: PermissionPrompt): Promise<string> {
  return renderToString(createSSRApp(PermissionRequestList, {
    prompt,
    "dynamicDecisions": prompt.kind === "dynamic"
      ? [...prompt.rememberedDecisions]
      : [],
    "onChooseDynamic": (): void => {},
  }));
}

test.each(["static", "dynamic"] as const)(
  "renders distinguishable OS identities for an equal path in a %s prompt",
  async kind => {
    const path = "/srv/plugins/replaceable-target";
    const first = await renderPrompt(promptFor(kind, [externalWriteRequest(path, "1001")]));
    const second = await renderPrompt(promptFor(kind, [externalWriteRequest(path, "2002")]));

    expect(first).toContain("OS-confirmed filesystem identity");
    expect(first).toContain("Canonical path");
    expect(first).toContain(path);
    expect(first).toContain("desktop-filesystem-v1");
    expect(first).toContain("external_storage_root");
    expect(first).toContain(`id="${TARGET_ID_PREFIX}-device-0-0"`);
    expect(first).toContain(">41</dd>");
    expect(first).toContain(`id="${TARGET_ID_PREFIX}-inode-0-0"`);
    expect(first).toContain(">1001</dd>");
    expect(second).toContain(">2002</dd>");
    expect(first).not.toBe(second);

    expect(first).toContain(
      "id=\"__extensions-loader__permission-request-target-item-0-0\"",
    );
    expect(first).toContain(
      "aria-labelledby=\"__extensions-loader__permission-request-target-heading-0-0\"",
    );
    expect(first).toContain("aria-label=\"Requested permissions\"");
    expect(first).toContain(
      "aria-label=\"Target identities for storage/external/write\"",
    );
    expect(first).toContain(
      "id=\"__extensions-loader__permission-request-target-path-0-0\"",
    );
    expect(first).toContain("data-permission-danger=\"critical\"");
    expect(first).toContain("border-red-700");

    if (kind === "dynamic") {
      expect(first).toContain(
        "id=\"__extensions-loader__permission-request-controls-0\"",
      );
      expect(first).toContain(
        "id=\"__extensions-loader__permission-request-deny-0\"",
      );
      expect(first).toContain("data-permission-action=\"deny\"");
      expect(first).toContain(
        "id=\"__extensions-loader__permission-request-allow-wrapper-item-0\"",
      );
      expect(first).toContain("data-permission-action=\"allow\"");
    } else {
      expect(first).not.toContain(
        "id=\"__extensions-loader__permission-request-controls-0\"",
      );
    }
  },
);

test.each(["static", "dynamic"] as const)(
  "renders distinguishable executable digests for an equal path in a %s prompt",
  async kind => {
    const path = "/usr/bin/replaceable-tool";
    const firstDigest = "b".repeat(64);
    const secondDigest = "c".repeat(64);
    const first = await renderPrompt(promptFor(kind, [processRequest(path, firstDigest)]));
    const second = await renderPrompt(promptFor(kind, [processRequest(path, secondDigest)]));

    expect(first).toContain("OS-confirmed executable identity and content digest");
    expect(first).toContain("desktop-executable-sha256-v1");
    expect(first).toContain("process_executable");
    expect(first).toContain("Canonical path");
    expect(first).toContain(path);
    expect(first).toContain(`id="${TARGET_ID_PREFIX}-device-0-0"`);
    expect(first).toContain(">51</dd>");
    expect(first).toContain(`id="${TARGET_ID_PREFIX}-inode-0-0"`);
    expect(first).toContain(">7001</dd>");
    expect(first).toContain("Content SHA-256");
    expect(first).toContain(`id="${TARGET_ID_PREFIX}-content-sha256-0-0"`);
    expect(first).toContain(firstDigest);
    expect(second).toContain(secondDigest);
    expect(first).not.toBe(second);
  },
);

test("labels browser identities without claiming OS confirmation", async () => {
  const logicalPath = "/preview/logical-root";
  const processPath = "/usr/bin/tool";
  const logicalStorage: PreparedPermissionRequest = {
    "descriptor": {
      "id"   : "storage/external/read",
      "scope": { "roots": [logicalPath] },
    },
    "targetIdentities": [{
      "kind"            : "external_storage_root",
      "path"            : logicalPath,
      "identityProvider": "browser-preview-logical-v1",
    }],
  };
  const unsupportedProcess: PreparedPermissionRequest = {
    "descriptor": {
      "id"   : "system/process/spawn",
      "scope": { "executables": [{ "path": processPath, "arguments": [] }] },
    },
    "targetIdentities": [{
      "kind"            : "process_executable",
      "path"            : processPath,
      "identityProvider": "browser-preview-unsupported-v1",
    }],
  };
  const rendered = await renderPrompt(promptFor(
    "dynamic",
    [logicalStorage, unsupportedProcess],
  ));

  expect(rendered).toContain("Browser preview logical identity — not OS-confirmed");
  expect(rendered).toContain("Logical storage key");
  expect(rendered).toContain("Unsupported in browser preview — not OS-confirmed");
  expect(rendered).toContain("Requested path");
  expect(rendered).toContain(
    "aria-label=\"Target identities for storage/external/read\"",
  );
  expect(rendered).toContain(
    "aria-label=\"Target identities for system/process/spawn\"",
  );

  for (const requestIndex of [0, 1]) {
    expect(rendered).not.toContain(
      `id="${TARGET_ID_PREFIX}-device-${requestIndex}-0"`,
    );
    expect(rendered).not.toContain(
      `id="${TARGET_ID_PREFIX}-inode-${requestIndex}-0"`,
    );
  }

  expect(rendered).not.toContain(principalKey);
  expect(rendered).not.toContain("test-dynamic");
});
