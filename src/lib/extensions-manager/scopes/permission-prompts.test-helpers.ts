import type {
  PermissionPrompt,
  PermissionPromptController,
} from "@/lib/extensions-manager/scopes/permission-prompts.ts";
import type { PluginPrincipal } from "@/lib/extensions-manager/scopes/principal.ts";
import type { PermissionRequest } from "@/types/extensions/permission.type.ts";

export const BASIC_UI = "ui/basic" satisfies PermissionRequest;
export const LOGGING = "logging/write" satisfies PermissionRequest;
export const SHELL = "system/shell" satisfies PermissionRequest;

export function principal(
  artifactCharacter: string,
  pluginId = "test-plugin",
): PluginPrincipal {
  return {
    "repositoryOrigin": "https://example.com/plugins",
    pluginId,
    "version"         : "1.0.0",
    "artifactSha256"  : artifactCharacter.repeat(64),
  };
}

export async function waitForPrompt(
  controller: PermissionPromptController,
): Promise<PermissionPrompt> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const prompt = controller.currentPrompt;

    if (prompt !== undefined) {
      return prompt;
    }

    await Promise.resolve();
  }

  throw new Error("Expected a permission prompt");
}
