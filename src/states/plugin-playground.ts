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

import { ref } from "vue";

export const codeOutput = ref<string>("");
export const codeToEvaluate = ref<string>(`// Imports, basically
const { Txiki } = window.__KAEDE__.libs;

const answer = await confirm("Do you want to host a txiki.js server?");

if (!answer) {
  return;
}

const name = "Txiki Server Test";
// Unfortunately, the autocomplete only works when you directly use 'window.__KAEDE__'
const globalStates = window.__KAEDE__.libs.GlobalStateHelpers.get();
const server = await new Txiki()
  .defineGlobal("globalStates", globalStates)
  .get("/hi", () => {
    return globalStates;
  })
  .listen(3001);

alert("Done");
`);
