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

import type { DeepPartial } from "unocss";
import { type ShallowReactive, shallowReactive, shallowRef } from "vue";

import type ExtensionAPI from "@/lib/extension-api";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";

type SandboxedAPI = {
  "enable" : () => void | Promise<void>;
  "disable": () => void | Promise<void>;
};

export const extensionStates: ShallowReactive<{
  "valid"   : Array<ExtensionType>;
  "invalid" : Array<DeepPartial<ExtensionType>>;
  "executed": Array<{
    "extension": ExtensionType;
    // Contains lifecycle handlers
    "api"      : ExtensionAPI | SandboxedAPI;
  }>;
}> = shallowReactive({
  "valid"   : [],
  "invalid" : [],
  "executed": [],
});

// Updated on successful fetch of trusted hashes from GitHub
export const trustedExtensionHashes = shallowRef<Set<string>>(
  new Set([
    "cf7b2186a639ea1d80d5908b7653d8fd49aa0848aae94f2bcb781edc6a1362ea",
    "2b753d9824b62dde0b5f035544183bfce6972c9051cdc5d85c227945c5198745",
    "a3a9150daf3acbc6e83dc3ed14aa49d8e6479b81d76ea743ecd32842eee81bcd",
  ]),
);
