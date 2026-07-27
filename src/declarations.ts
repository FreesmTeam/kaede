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

import type { App } from "vue";

import type {
  KaedeInternalsSurfaceType,
} from "@/declarations/kaede-internals.type.ts";
import type {
  KaedeNamespaceSurfaceType,
} from "@/declarations/kaede-namespace.type.ts";

/* Describe the temporary bootstrap aliases installed before extension isolation */
declare global {

  /* This variable is replaced to the source code file name at build time */
  const __PRE_BUNDLED_FILENAME__: string;

  /* Installed during bootstrap and revoked before sandbox evaluation */
  interface Window {

    /**
     * Bootstrap-only application internals.
     *
     * This alias is absent after extension isolation and is never a sandbox API.
     */
    "__KAEDE_INTERNALS__"?: KaedeInternalsSurfaceType<App<Element>>;

    /**
     * Bootstrap-only application namespace alias.
     *
     * Trusted extensions receive the namespace explicitly as `scopedThis.Kaede`.
     * Sandboxed extensions cannot access this optional window alias.
     */
    "__KAEDE__"?: KaedeNamespaceSurfaceType;
  }
}

/* Export the Kaede namespace type */
export type KaedeNamespaceType = NonNullable<Window["__KAEDE__"]>;
export type KaedeInternalsType = NonNullable<Window["__KAEDE_INTERNALS__"]>;
