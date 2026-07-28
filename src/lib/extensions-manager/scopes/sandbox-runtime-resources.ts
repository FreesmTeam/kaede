import type { SafeDocument } from "ark-of-atrahasis";

import type { SandboxHostBoundary } from "@/lib/extensions-manager/scopes/sandbox-runtime-types.ts";

export class SandboxResourceError extends Error {
  readonly errors: ReadonlyArray<unknown>;

  constructor(message: string, errors: ReadonlyArray<unknown>) {
    super(message);
    this.name = "SandboxResourceError";
    this.errors = Object.freeze([...errors]);
  }
}

export function cleanupRuntimeResources(
  safeDocument: SafeDocument | undefined,
  disposeEvents: (() => void) | undefined,
  hostBoundary: SandboxHostBoundary | undefined,
): void {
  const errors: Array<unknown> = [];

  for (const cleanup of [
    safeDocument === undefined ? undefined : (): void => safeDocument.dispose(),
    disposeEvents,
    hostBoundary === undefined ? undefined : hostBoundary.remove,
  ]) {
    if (cleanup === undefined) {
      continue;
    }

    try {
      cleanup();
    } catch (error: unknown) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    throw new SandboxResourceError("Sandbox runtime resource disposal failed", errors);
  }
}
