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
import { type Reactive, reactive, shallowRef } from "vue";

import type ExtensionAPI from "@/lib/extension-api";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";

export const extensionStates: Reactive<{
  "valid"   : Array<ExtensionType>;
  "invalid" : Array<DeepPartial<ExtensionType>>;
  "executed": Array<ExtensionAPI>;
}> = reactive({
  "valid"   : [],
  "invalid" : [],
  "executed": [],
});

// Updated on successful fetch of trusted hashes from GitHub
export const trustedExtensionHashes = shallowRef<Set<string>>(
  new Set([
    "455cf7502f56262694606107c239fcd954037aee774947815e693a44e5f618e1",
  ]),
);
