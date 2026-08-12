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

import { callService } from "@/lib/wails/scopes/call-service.ts";

/*
 * The platform description is asked for once, during the environment setup,
 * because several Tauri surfaces need it synchronously afterwards:
 * 'window.__TAURI_OS_PLUGIN_INTERNALS__' is read as a plain object, and
 * 'plugin:path|join' has to answer without awaiting anything
 */

export type EnvironmentType = {
  "osType"      : string;
  "platform"    : string;
  "family"      : string;
  "version"     : string;
  "arch"        : string;
  "exeExtension": string;
  "eol"         : string;
  "separator"   : string;
  "delimiter"   : string;
  "appVersion"  : string;
};

const FallbackEnvironment: EnvironmentType = {
  "osType"      : "linux",
  "platform"    : "linux",
  "family"      : "unix",
  "version"     : "unknown",
  "arch"        : "x86_64",
  "exeExtension": "",
  "eol"         : "\n",
  "separator"   : "/",
  "delimiter"   : ":",
  "appVersion"  : "0.0.0",
};

let environment: EnvironmentType = FallbackEnvironment;

/**
 * Reads the platform description from the backend and caches it.
 *
 * @returns The description that every later synchronous read will see.
 */
export async function loadEnvironment(): Promise<EnvironmentType> {
  const info = await callService("EnvironmentService.Info") as Partial<EnvironmentType> | undefined;

  environment = { ...FallbackEnvironment, ...info };

  return environment;
}

/**
 * Returns the cached platform description.
 *
 * @returns The description, or safe defaults before the setup has run.
 */
export function getEnvironment(): EnvironmentType {
  return environment;
}
