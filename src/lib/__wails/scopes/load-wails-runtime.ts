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

/*
 * The Wails runtime is not taken from '@wailsio/runtime' on purpose.
 *
 * A Wails v3 application serves its own runtime at '/wails/runtime.js'
 * through an application-level middleware, which means the runtime always
 * matches the Go binary that is hosting the page. Importing it from there
 * removes an npm dependency that would otherwise have to be kept in lockstep
 * with the backend, and it doubles as the environment probe: outside of a
 * Wails webview that module simply does not exist
 */

export type WailsEventType = {
  "name": string;
  "data": unknown;
};

export type WailsRuntimeType = {
  "Call": {
    "ByName": (name: string, ...parameters: Array<unknown>) => Promise<unknown>;
  };
  "Events": {
    "On"  : (event: string, handler: (event: WailsEventType) => void) => () => void;
    "Emit": (event: string, data: unknown) => Promise<boolean>;
  };
};

/*
 * Kept in a variable so that the bundler treats it as a runtime value.
 * Vite would otherwise try to resolve the path at build time and fail,
 * since the file only exists while the Go backend is serving the page
 */
const RuntimeModuleSpecifier: string = "/wails/runtime.js";

let runtimeRequest: Promise<WailsRuntimeType | undefined> | undefined;

function isWailsRuntime(module: unknown): module is WailsRuntimeType {
  const candidate = module as Partial<WailsRuntimeType> | undefined;

  return (
    typeof candidate?.Call?.ByName === "function" &&
    typeof candidate?.Events?.On === "function"
  );
}

async function requestWailsRuntime(): Promise<WailsRuntimeType | undefined> {
  try {
    const module: unknown = await import(/* @vite-ignore */ RuntimeModuleSpecifier);

    if (!isWailsRuntime(module)) {
      return;
    }

    return module;
  } catch {
    /*
     * A plain browser answers this request with the index page (or a 404),
     * neither of which parses as a module, so the failure is the answer
     */
    return;
  }
}

/**
 * Loads the runtime that the Wails backend serves alongside the frontend.
 *
 * @returns The runtime, or `undefined` when the page is not hosted by Wails.
 */
export function loadWailsRuntime(): Promise<WailsRuntimeType | undefined> {
  runtimeRequest ??= requestWailsRuntime();

  return runtimeRequest;
}
