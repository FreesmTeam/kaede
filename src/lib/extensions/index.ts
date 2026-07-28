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

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { readExtensions } from "@/lib/extensions/read-extensions.ts";
import { runInUnrestricted } from "@/lib/extensions/run-in-unrestricted.ts";
import { onGlobalStateChange } from "@/lib/extensions/sandbox/events/on-global-state-change.ts";
import { onInstanceStateChange } from "@/lib/extensions/sandbox/events/on-instance-state-change.ts";
import { grantEventListeners } from "@/lib/extensions/sandbox/grant-event-listeners.ts";
import { lockdownEnvironment } from "@/lib/extensions/sandbox/lockdown-environment.ts";
import { runInSandbox } from "@/lib/extensions/sandbox/run-in-sandbox.ts";
import { showWebviewWindow } from "@/lib/extensions/show-webview-window.ts";

export default {
  "requestPermissions": GlobalInternals.requestPermissions,
  readExtensions,
  runInUnrestricted,
  onGlobalStateChange,
  onInstanceStateChange,
  grantEventListeners,
  lockdownEnvironment,
  runInSandbox,
  showWebviewWindow,
} as const;
