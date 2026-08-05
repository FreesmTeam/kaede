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

import type { ComputedRef } from "vue";

export type SettingsRowType = {
  "idRoot"   : string;
  "separate"?: string;
  "title"   ?: string;
  "empty"   ?: Omit<SettingsRowType, "inner">;
  "disabled"?: boolean;
  "onClick" ?: (event: MouseEvent) => void | Promise<void>;
  "image"   ?: string;
  "icon"    ?: string | "__kaede-do-not-render";
  "subtitle"?: string;
  "inner"   ?: {
    "kind" : "toggle";
    "value": boolean;
  } | {
    "kind"     : "select";
    "options"  : Array<string>;
    "value"   ?: string;
    "onSelect"?: (value: string) => void;
  } | {
    "icon"         : string;
    "placeholder"  : string;
    "kind"         : "input";
    "debounceTime" : number;
    "defaultValue"?: string | number;
    "onInput"     ?: (value: string) => void;
    "filePicker"  ?: {
      "icon"     : string;
      "onPick"   : (value: string) => void;
      "title"   ?: string;
      "filters" ?: Array<{ "name": string; "extensions": Array<string> }>;
    };
  } | {
    "kind"    : "color";
    // Since this takes a JSON value, the value can also be 'null'
    "value"  ?: string | null;
    "default"?: string;
    "onColor"?: (value: string) => void;
  } | Array<SettingsRowType>;
};
export type SettingsRowCollectionType = Array<ComputedRef<SettingsRowType>>;
