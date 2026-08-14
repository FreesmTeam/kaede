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

import "ses";

import Errors from "@/lib/errors";
import Extensions from "@/lib/extensions";
import { log } from "@/lib/logging/log.ts";
import Permissions from "@/lib/permissions";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export function runInSandbox({
  id,
  code,
  permissions = [],
}: {
  "id"          : string;
  "code"        : string;
  "permissions"?: Array<PermissionType>;
}): void | {
  "enable" : () => void | Promise<void>;
  "disable": () => void | Promise<void>;
} {
  const scopedThis = Permissions.grantStaticPermissions({ id, permissions });

  /*
   * Create a plugin-scoped handler for requesting permissions
   * to prevent the 'ExtensionsManager#requestPermissions' tampering
   */
  const wrappedPermissionsRequest = async (
    permissions: Array<PermissionType>,
  ): Promise<Array<unknown>> => {
    return await Extensions.requestPermissions(permissions, id);
  };
  const api: {
    "enable" : () => void | Promise<void>;
    "disable": () => void | Promise<void>;
  } = { "enable": (): void => {}, "disable": (): void => {} };

  try {
    // It will not lock down more than once
    Extensions.lockdownEnvironment();

    const compartment = new Compartment({
      "globals": harden({
        "requestPermissions": wrappedPermissionsRequest,

        /*
         * Provide a reference to the plugin-scoped 'GrantedScopes' object to make it
         * modifiable from other JavaScript scopes, i.e. from 'ExtensionsManager#handlePermission'
         */
        "scopedThis": scopedThis,

        /*
         * Provide a reference to the plugin-scoped 'EventListeners' object to make it
         * modifiable from other JavaScript scopes, i.e. from 'ExtensionsManager#handleEvent'
         */
        // TODO: DO NOT DO THIS; CHANGE LATER --- "EventListeners": EventListeners[id],
      }),

      /*
       * Code execution does not work without this property,
       * and the documentation does not explain what '__options__' exactly do
       */
      "__options__": true,
    });

    /*
     * Compartments run using the same JavaScript interpreter as the WebView uses itself,
     * so the performance of sandboxed plugins vs. unrestricted should equal
     */
    const result: unknown | {
      "enable" : () => void | Promise<void>;
      "disable": () => void | Promise<void>;
    } = compartment.evaluate(code);

    if (typeof result !== "object" || result === null) {
      // Lifecycle handlers are optional, so we can safely return placeholder handlers
      return api;
    }

    if (("enable" in result) && typeof result.enable === "function") {
      api.enable = result.enable as () => void | Promise<void>;
    }

    if (("disable" in result) && typeof result.disable === "function") {
      api.disable = result.disable as () => void | Promise<void>;
    }
  } catch (error: unknown) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      `An error occurred while running the '${id}' extension in the compartment:`,
      Errors.prettify(error),
    );
  }

  return api;
}
