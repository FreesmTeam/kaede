/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * ATTENTION: AI-generated (by Claude Opus 5 on 'max' reasoning)
 */

import {
  loadWailsRuntime,
  type WailsRuntimeType,
} from "@/lib/wails/scopes/load-wails-runtime.ts";

/*
 * Wails addresses a bound method by a fully qualified name built from the
 * package path of the receiver, its type and the method. Every Kaede service
 * is declared in the 'main' package of 'src-wails', so the prefix is constant
 */
const ServiceNamespace: string = "main.";

/*
 * Tauri commands reject with a bare string, and the application relies on
 * that: it interpolates rejections straight into log lines. Wails rejects
 * with an 'Error' instead, so rejections are flattened back to strings to
 * keep the contract the frontend was written against
 */
function toTauriRejection(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Calls a method of a Go service.
 *
 * @param method - The service and method, e.g. `HashService.Sha256`.
 * @param parameters - The arguments, in the order the Go method declares them.
 *
 * @returns Whatever the Go method returned, decoded from JSON.
 */
export async function callService(
  method: string,
  ...parameters: Array<unknown>
): Promise<unknown> {
  const runtime: WailsRuntimeType | undefined = await loadWailsRuntime();

  if (runtime === undefined) {
    throw `Failed to call ${method}: the Wails runtime is unavailable`;
  }

  try {
    return await runtime.Call.ByName(ServiceNamespace + method, ...parameters);
  } catch (error: unknown) {
    throw toTauriRejection(error);
  }
}
